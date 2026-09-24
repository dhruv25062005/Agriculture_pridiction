import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { getFirebaseAdminAuth } from "./config/security.js";

/*
|--------------------------------------------------------------------------
| KisanAI Production Disease Detection API
|--------------------------------------------------------------------------
| Endpoint:
|   POST /predict
|
| Flow:
|   Browser
|      ↓
|   /predict
|      ↓
|   Firebase session authentication
|      ↓
|   Image validation
|      ↓
|   Server-side Gemini rate limiter
|      ↓
|   Gemini Vision analysis
|      ↓
|   JSON validation
|      ↓
|   Diagnosis response
|
| Important:
| - GEMINI_API_KEY must exist in environment variables.
| - GEMINI_FAST_MODEL can override the default model.
| - The timeout is intentionally generous for image analysis.
|--------------------------------------------------------------------------
*/

const COOKIE = "agri_session";

/*
|--------------------------------------------------------------------------
| Preserve Express's original POST handler
|--------------------------------------------------------------------------
*/

const previousPost = express.application.post;

/*
|--------------------------------------------------------------------------
| Upload configuration
|--------------------------------------------------------------------------
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB
    files: 1
  }
});

/*
|--------------------------------------------------------------------------
| Gemini configuration
|--------------------------------------------------------------------------
*/

/*
 * Your current Gemini project is limited to approximately 5 RPM.
 *
 * We intentionally allow only 4 requests/minute from this application
 * so the application does not immediately consume the complete quota.
 */
const SERVER_RPM_LIMIT = 4;
const RPM_WINDOW_MS = 60_000;

/*
 * Maximum time we allow Gemini to process one image.
 *
 * Previous value:
 *   10 seconds
 *
 * New value:
 *   30 seconds
 */
const GEMINI_TIMEOUT_MS = 30_000;

/*
 * Keep a simple in-memory request timestamp list.
 *
 * This is suitable for one Node process.
 * If you later run multiple Render instances, use Redis instead.
 */
const geminiRequestTimes = [];

/*
|--------------------------------------------------------------------------
| Gemini client
|--------------------------------------------------------------------------
*/

let ai;

function getAI() {
  if (ai) {
    return ai;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  ai = new GoogleGenAI({
    apiKey
  });

  return ai;
}

/*
|--------------------------------------------------------------------------
| Cookie parser
|--------------------------------------------------------------------------
*/

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((item) => {
        const index = item.indexOf("=");

        if (index < 0) {
          return ["", ""];
        }

        const key = item.slice(0, index).trim();

        const value = decodeURIComponent(
          item.slice(index + 1).trim()
        );

        return [key, value];
      })
      .filter(([key]) => key)
  );
}

/*
|--------------------------------------------------------------------------
| Image validation
|--------------------------------------------------------------------------
*/

function isImage(buffer) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  /*
   * JPEG
   */
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  /*
   * PNG
   */
  const isPng =
    buffer.length >= 8 &&
    Buffer.from(buffer.subarray(0, 8)).equals(
      Buffer.from([
        137,
        80,
        78,
        71,
        13,
        10,
        26,
        10
      ])
    );

  /*
   * WEBP
   */
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}

/*
|--------------------------------------------------------------------------
| Firebase authentication
|--------------------------------------------------------------------------
*/

async function auth(req, res, next) {
  const cookies = parseCookies(
    req.headers.cookie || ""
  );

  const token = cookies[COOKIE];

  if (!token) {
    return res.status(401).json({
      success: false,
      retryable: false,
      error: "Authentication required. Please sign in again."
    });
  }

  try {
    const firebaseAuth = await getFirebaseAdminAuth();

    const decoded = await firebaseAuth.verifySessionCookie(
      token,
      true
    );

    req.diseaseUser = {
      uid: decoded.uid,
      name:
        decoded.name ||
        decoded.email?.split("@")[0] ||
        "Farmer"
    };

    next();
  } catch (error) {
    console.warn(
      "Disease authentication failed:",
      error?.message || error
    );

    return res.status(401).json({
      success: false,
      retryable: false,
      error:
        "Your session has expired. Please sign in again."
    });
  }
}

/*
|--------------------------------------------------------------------------
| Gemini JSON parser
|--------------------------------------------------------------------------
|
| Gemini should return JSON, but this parser also protects against:
|
| ```json
| {...}
| ```
|
| and accidental text surrounding the JSON object.
|--------------------------------------------------------------------------
*/

function parseDiagnosisJSON(text) {
  let cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  /*
   * Remove accidental text before the first {
   * and after the final }.
   */
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error(
      "Gemini returned invalid diagnosis JSON."
    );
  }

  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn(
      "Gemini JSON parse failed:",
      error?.message || error
    );

    throw new Error(
      "Gemini returned malformed diagnosis JSON."
    );
  }
}

/*
|--------------------------------------------------------------------------
| Extract HTTP status from Gemini error
|--------------------------------------------------------------------------
*/

function statusOf(error) {
  return Number(
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.error?.code ||
    0
  );
}

/*
|--------------------------------------------------------------------------
| Extract normalized error message
|--------------------------------------------------------------------------
*/

function messageOf(error) {
  return String(
    error?.message ||
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    ""
  ).toLowerCase();
}

/*
|--------------------------------------------------------------------------
| Gemini request limiter
|--------------------------------------------------------------------------
*/

function pruneRequestTimes(now = Date.now()) {
  while (
    geminiRequestTimes.length > 0 &&
    now - geminiRequestTimes[0] >= RPM_WINDOW_MS
  ) {
    geminiRequestTimes.shift();
  }
}

function reserveGeminiSlot() {
  const now = Date.now();

  pruneRequestTimes(now);

  if (geminiRequestTimes.length >= SERVER_RPM_LIMIT) {
    const oldest = geminiRequestTimes[0];

    const wait = Math.max(
      1,
      Math.ceil(
        (RPM_WINDOW_MS - (now - oldest)) / 1000
      )
    );

    return {
      ok: false,
      wait
    };
  }

  geminiRequestTimes.push(now);

  return {
    ok: true,
    wait: 0
  };
}

/*
|--------------------------------------------------------------------------
| Gemini request with timeout
|--------------------------------------------------------------------------
*/

async function callGemini(client, contents, model) {
  let timeoutId;

  try {
    const geminiPromise =
      client.models.generateContent({
        model,
        contents,

        config: {
          responseMimeType: "application/json",

          /*
           * We do not need deep reasoning for basic
           * visual crop disease classification.
           */
          thinkingConfig: {
            thinkingLevel: "minimal"
          },

          /*
           * Keep the response compact.
           */
          maxOutputTokens: 700
        }
      });

    const timeoutPromise = new Promise(
      (_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(
            "Gemini analysis timed out after 30 seconds."
          );

          error.code = "TIMEOUT";

          reject(error);
        }, GEMINI_TIMEOUT_MS);
      }
    );

    return await Promise.race([
      geminiPromise,
      timeoutPromise
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/*
|--------------------------------------------------------------------------
| Validate Gemini diagnosis
|--------------------------------------------------------------------------
*/

function normalizeDiagnosis(data) {
  if (!data || typeof data !== "object") {
    throw new Error(
      "Diagnosis response is not an object."
    );
  }

  /*
   * Defaults make the frontend much safer.
   */
  const diagnosis = {
    is_plant:
      typeof data.is_plant === "boolean"
        ? data.is_plant
        : null,

    detected_subject:
      data.detected_subject || null,

    plant:
      data.plant || "Unknown crop",

    disease:
      data.disease || "Uncertain diagnosis",

    severity:
      data.severity || "Unknown",

    cause:
      data.cause || null,

    is_healthy:
      typeof data.is_healthy === "boolean"
        ? data.is_healthy
        : false,

    is_insect_caused:
      typeof data.is_insect_caused === "boolean"
        ? data.is_insect_caused
        : false,

    culprit:
      data.culprit || null,

    damage_mechanism:
      data.damage_mechanism || null,

    confidence:
      data.confidence == null
        ? null
        : Number(data.confidence),

    summary:
      data.summary || "",

    organic_treatment:
      data.organic_treatment || "",

    chemical_treatment:
      data.chemical_treatment || "",

    recovery_protocol:
      Array.isArray(data.recovery_protocol)
        ? data.recovery_protocol.slice(0, 3)
        : [],

    prevention_tips:
      Array.isArray(data.prevention_tips)
        ? data.prevention_tips.slice(0, 3)
        : []
  };

  /*
   * Normalize confidence.
   */
  if (
    diagnosis.confidence !== null &&
    !Number.isFinite(diagnosis.confidence)
  ) {
    diagnosis.confidence = null;
  }

  if (diagnosis.confidence !== null) {
    diagnosis.confidence = Math.max(
      0,
      Math.min(100, diagnosis.confidence)
    );
  }

  return diagnosis;
}

/*
|--------------------------------------------------------------------------
| Main diagnosis handler
|--------------------------------------------------------------------------
*/

async function diagnose(req, res) {
  const requestId = crypto.randomUUID();

  const startedAt = Date.now();

  /*
   * Validate image existence.
   */
  if (!req.file) {
    return res.status(400).json({
      success: false,
      retryable: false,
      error: "Image is required.",
      request_id: requestId
    });
  }

  /*
   * Validate actual image bytes.
   */
  if (!isImage(req.file.buffer)) {
    return res.status(400).json({
      success: false,
      retryable: false,
      error:
        "Invalid image. Upload a JPEG, PNG or WebP image.",
      request_id: requestId
    });
  }

  /*
   * Validate API key.
   */
  const client = getAI();

  if (!client) {
    console.error(
      `[${requestId}] GEMINI_API_KEY is missing.`
    );

    return res.status(503).json({
      success: false,
      retryable: false,
      error:
        "Disease detection is not configured. Add GEMINI_API_KEY to your environment variables.",
      request_id: requestId
    });
  }

  /*
   * Reserve Gemini request slot.
   */
  const slot = reserveGeminiSlot();

  if (!slot.ok) {
    console.warn(
      `[${requestId}] Gemini local rate limit reached. Wait ${slot.wait}s.`
    );

    return res.status(200).json({
      success: false,
      retryable: true,
      rate_limited: true,
      retry_after_seconds: slot.wait,
      error:
        `Gemini request limit reached. Please wait ${slot.wait} seconds before scanning again.`,
      request_id: requestId
    });
  }

  /*
   * Disease-detection prompt.
   *
   * Keep it concise because the output needs to be fast.
   */
  const prompt = `
Analyze this agricultural image for crop/plant health.

Return ONLY valid JSON.

Required JSON keys:
{
  "is_plant": boolean,
  "detected_subject": string|null,
  "plant": string,
  "disease": string,
  "severity": string,
  "cause": string|null,
  "is_healthy": boolean,
  "is_insect_caused": boolean,
  "culprit": string|null,
  "damage_mechanism": string|null,
  "confidence": number|null,
  "summary": string,
  "organic_treatment": string,
  "chemical_treatment": string,
  "recovery_protocol": string[],
  "prevention_tips": string[]
}

Rules:

1. If no clear plant/crop is visible:
   - is_plant = false
   - disease = "Non-Plant Subject"
   - is_healthy = false
   - confidence = null
   - treatments should be empty strings.

2. If a plant is visible but the disease cannot be identified reliably:
   - disease = "Uncertain diagnosis"
   - do not invent a disease.

3. Distinguish plant diseases from insect/pest damage when possible.

4. Keep every text field concise.

5. recovery_protocol must contain at most 3 items.

6. prevention_tips must contain at most 3 items.

7. Never invent pesticide products, chemical doses, or application rates.

8. For chemical treatment, provide only general treatment guidance unless a locally registered product and label are explicitly known.

9. confidence must be between 0 and 100, or null.

10. Do not include Markdown.
`.trim();

  /*
   * Determine MIME type.
   */
  const mime = String(
    req.file.mimetype || ""
  ).toLowerCase();

  const safeMime =
    mime === "image/png"
      ? "image/png"
      : mime === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  /*
   * Convert image to base64 for Gemini.
   */
  const contents = [
    {
      inlineData: {
        mimeType: safeMime,
        data: req.file.buffer.toString("base64")
      }
    },
    {
      text: prompt
    }
  ];

  /*
   * Model selection.
   *
   * You can override this using:
   *
   * GEMINI_FAST_MODEL=your-model-name
   */
  const model =
    process.env.GEMINI_FAST_MODEL ||
    "gemini-3.5-flash-lite";

  console.log(
    `[${requestId}] Disease analysis started | model=${model} | size=${req.file.size} bytes`
  );

  /*
   * Call Gemini.
   */
  try {
    const result = await callGemini(
      client,
      contents,
      model
    );

    /*
     * Gemini SDK responses can differ between versions,
     * so safely extract text.
     */
    const responseText =
      typeof result?.text === "string"
        ? result.text
        : typeof result?.response?.text === "function"
          ? result.response.text()
          : "";

    if (!responseText) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    /*
     * Parse JSON.
     */
    const rawDiagnosis =
      parseDiagnosisJSON(responseText);

    /*
     * Normalize and validate fields.
     */
    const diagnosis =
      normalizeDiagnosis(rawDiagnosis);

    /*
     * Gemini should explicitly tell us whether
     * it sees a plant.
     */
    if (diagnosis.is_plant === false) {
      const duration =
        Date.now() - startedAt;

      console.log(
        `[${requestId}] Non-plant image detected in ${duration}ms`
      );

      return res.status(200).json({
        success: false,
        is_plant: false,
        detected_subject:
          diagnosis.detected_subject ||
          "Non-plant subject",
        plant: diagnosis.plant,
        disease: "Non-Plant Subject",
        severity: diagnosis.severity,
        cause: null,
        is_healthy: false,
        is_insect_caused: false,
        culprit: null,
        damage_mechanism: null,
        confidence: null,
        summary:
          diagnosis.summary ||
          "No reliable agricultural plant specimen was detected.",
        organic_treatment: "",
        chemical_treatment: "",
        recovery_protocol: [],
        prevention_tips: [],
        source: `Gemini AI (${model})`,
        id: requestId,
        request_id: requestId,
        timestamp:
          new Date().toISOString(),
        user: req.diseaseUser.name
      });
    }

    /*
     * If Gemini cannot determine whether the image
     * contains a plant, don't pretend it did.
     */
    if (diagnosis.is_plant === null) {
      diagnosis.is_plant = true;
    }

    const duration =
      Date.now() - startedAt;

    const output = {
      success: true,

      ...diagnosis,

      source:
        `Gemini AI (${model})`,

      id:
        crypto.randomUUID(),

      request_id:
        requestId,

      timestamp:
        new Date().toISOString(),

      user:
        req.diseaseUser.name,

      processing_time_ms:
        duration
    };

    console.log(
      `[${requestId}] Disease analysis completed in ${duration}ms | disease="${diagnosis.disease}" | confidence=${diagnosis.confidence}`
    );

    return res.status(200).json(output);

  } catch (error) {
    const status =
      statusOf(error);

    const errorText =
      messageOf(error);

    const duration =
      Date.now() - startedAt;

    console.error(
      `[${requestId}] Disease detection failed after ${duration}ms`,
      {
        status,
        code: error?.code || null,
        message: error?.message || String(error),
        model
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Authentication / API key
    |--------------------------------------------------------------------------
    */

    if (
      status === 401 ||
      status === 403 ||
      /api.?key|unauthorized|permission denied|authentication/i.test(
        errorText
      )
    ) {
      return res.status(503).json({
        success: false,
        retryable: false,
        error:
          "Gemini API authentication failed. Check GEMINI_API_KEY and project permissions.",
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Rate limit / quota
    |--------------------------------------------------------------------------
    */

    if (
      status === 429 ||
      /resource.?exhausted|rate.?limit|quota/i.test(
        errorText
      )
    ) {
      return res.status(200).json({
        success: false,
        retryable: true,
        rate_limited: true,
        error:
          "Gemini quota/rate limit is currently full. Please wait before scanning again.",
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Gemini overloaded / unavailable
    |--------------------------------------------------------------------------
    */

    if (
      status === 500 ||
      status === 502 ||
      status === 503 ||
      /overloaded|temporarily unavailable|service unavailable|internal server error/i.test(
        errorText
      )
    ) {
      return res.status(200).json({
        success: false,
        retryable: true,
        error:
          "Gemini is temporarily unavailable. Please wait a few seconds and try again.",
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Model doesn't exist / isn't available
    |--------------------------------------------------------------------------
    */

    if (
      status === 404 ||
      /model.?not.?found|not found.*model|unknown model/i.test(
        errorText
      )
    ) {
      return res.status(503).json({
        success: false,
        retryable: false,
        error:
          `Gemini model '${model}' is unavailable. Set GEMINI_FAST_MODEL to a valid vision-capable Gemini model.`,
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Timeout
    |--------------------------------------------------------------------------
    */

    if (error?.code === "TIMEOUT") {
      return res.status(200).json({
        success: false,
        retryable: true,
        timeout: true,
        error:
          "Gemini analysis took longer than 30 seconds. Please try the image again.",
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid Gemini JSON
    |--------------------------------------------------------------------------
    */

    if (
      /invalid diagnosis json|malformed diagnosis json|empty response/i.test(
        errorText
      )
    ) {
      return res.status(200).json({
        success: false,
        retryable: true,
        error:
          "Gemini returned an incomplete diagnosis. Please try the image again.",
        request_id: requestId
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Generic failure
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: false,
      retryable: false,
      error:
        "Gemini could not analyze this image. Please try a clearer crop image.",
      request_id: requestId
    });
  }
}

/*
|--------------------------------------------------------------------------
| Override Express POST only for /predict
|--------------------------------------------------------------------------
*/

express.application.post = function (
  route,
  ...handlers
) {
  if (route === "/predict") {
    return this
      .route(route)
      .post(
        auth,
        upload.single("image"),
        diagnose
      );
  }

  return previousPost.call(
    this,
    route,
    ...handlers
  );
};