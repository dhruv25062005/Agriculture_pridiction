import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { getFirebaseAdminAuth } from "./config/security.js";

// Dedicated production wrapper for /predict. It runs after app-hardening.js and
// before server.js, so the legacy disease route cannot replace this implementation.
const COOKIE = "agri_session";
const originalPost = express.application.post;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 8 * 1024 * 1024), files: 1 }
});
const activeUsers = new Map();
let aiClient;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const getAI = () => aiClient || (process.env.GEMINI_API_KEY && (aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })), aiClient);
const cookies = header => Object.fromEntries(String(header || "").split(";").map(part => {
  const i = part.indexOf("=");
  if (i < 0) return ["", ""];
  let value = part.slice(i + 1).trim();
  try { value = decodeURIComponent(value); } catch {}
  return [part.slice(0, i).trim(), value];
}).filter(([key]) => key));

async function requireUser(req, res, next) {
  const token = cookies(req.headers.cookie)[COOKIE];
  if (!token) return res.status(401).json({ success: false, error: "Authentication required. Please sign in again." });
  try {
    const decoded = await (await getFirebaseAdminAuth()).verifySessionCookie(token, true);
    if (!decoded?.uid) throw new Error("Invalid session");
    req.diseaseUser = { uid: decoded.uid, name: decoded.name || decoded.email?.split("@")[0] || "Farmer" };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Your session has expired. Please sign in again." });
  }
}

function imageMime(buffer) {
  if (buffer?.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer?.length >= 8 && Buffer.from(buffer.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer?.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const models = () => [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite"
].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);

const schema = {
  type: "object",
  properties: {
    is_plant: { type: "boolean" },
    detected_subject: { type: "string" },
    plant: { type: "string" },
    disease: { type: "string" },
    severity: { type: "string", enum: ["Healthy", "Mild", "Moderate", "Critical", "N/A"] },
    cause: { type: "string" },
    is_healthy: { type: "boolean" },
    is_insect_caused: { type: "boolean" },
    culprit: { type: "string" },
    damage_mechanism: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    organic_treatment: { type: "string" },
    chemical_treatment: { type: "string" },
    recovery_protocol: { type: "array", items: { type: "string" } },
    prevention_tips: { type: "array", items: { type: "string" } }
  },
  required: ["is_plant", "detected_subject", "plant", "disease", "severity", "cause", "is_healthy", "is_insect_caused", "culprit", "damage_mechanism", "summary", "organic_treatment", "chemical_treatment", "recovery_protocol", "prevention_tips"]
};

const prompt = `You are an agricultural plant-health vision specialist. Analyze the supplied image carefully.

Rules:
1. First decide whether a clear plant/crop specimen is actually visible. If not, set is_plant=false and do not invent a disease.
2. If it is a plant, identify the crop only when visual evidence supports it.
3. Diagnose only visible symptoms. Do not invent a disease from weak evidence.
4. Distinguish disease, insect damage, nutrient stress, physical damage, and healthy tissue when possible.
5. If the exact disease cannot be determined reliably, use disease="Uncertain diagnosis" and explain what additional evidence is needed in summary. Do not guess.
6. confidence must reflect visual certainty, not optimism.
7. For a healthy plant, disease="Healthy" and severity="Healthy".
8. For chemical treatment, never invent a product name or dosage. Say to use only a locally registered crop-specific product according to its current label.
9. Return ONLY the requested JSON object.`;

function parseModelJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Gemini returned no JSON diagnosis");
  return JSON.parse(raw.slice(start, end + 1));
}

function errorCode(error) {
  return Number(error?.status || error?.statusCode || error?.response?.status || 0) || 0;
}
function transient(error) {
  const status = errorCode(error);
  const message = String(error?.message || "").toLowerCase();
  return [408, 429, 500, 502, 503, 504].includes(status) || /unavailable|overloaded|high demand|temporarily|timeout|timed out|rate.?limit|resource.?exhausted/.test(message);
}
function permanent(error) {
  return [400, 401, 403].includes(errorCode(error));
}

async function callGemini(client, model, contents) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingLevel: "low" }
        }
      });
    } catch (error) {
      last = error;
      if (!transient(error) || attempt === 2) throw error;
      await sleep(900 * (2 ** attempt) + Math.floor(Math.random() * 300));
    }
  }
  throw last || new Error("Gemini request failed");
}

function safeArray(value) {
  return Array.isArray(value) ? value.map(x => String(x || "").trim()).filter(Boolean).slice(0, 8) : [];
}
function normalize(result) {
  const confidence = Number(result?.confidence);
  const isPlant = Boolean(result?.is_plant);
  return {
    is_plant: isPlant,
    detected_subject: String(result?.detected_subject || (isPlant ? "Plant" : "Unknown subject")),
    plant: String(result?.plant || (isPlant ? "Unknown crop" : "N/A")),
    disease: String(result?.disease || (isPlant ? "Uncertain diagnosis" : "Non-Plant Subject")),
    severity: ["Healthy", "Mild", "Moderate", "Critical", "N/A"].includes(result?.severity) ? result.severity : "N/A",
    cause: String(result?.cause || "Insufficient visual evidence"),
    is_healthy: Boolean(result?.is_healthy),
    is_insect_caused: Boolean(result?.is_insect_caused),
    culprit: String(result?.culprit || "Unknown"),
    damage_mechanism: String(result?.damage_mechanism || "Unknown"),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : null,
    summary: String(result?.summary || "No reliable diagnosis could be established from this image."),
    organic_treatment: String(result?.organic_treatment || "No treatment recommendation until the diagnosis is confirmed."),
    chemical_treatment: String(result?.chemical_treatment || "Use only locally registered crop-specific products according to the current label."),
    recovery_protocol: safeArray(result?.recovery_protocol),
    prevention_tips: safeArray(result?.prevention_tips)
  };
}

async function diagnose(req, res) {
  if (!req.file) return res.status(400).json({ success: false, error: "Image is required." });
  const mimeType = imageMime(req.file.buffer);
  if (!mimeType) return res.status(400).json({ success: false, error: "Invalid image. Upload a real JPEG, PNG or WebP image." });

  const userId = req.diseaseUser.uid;
  const now = Date.now();
  const previous = activeUsers.get(userId) || 0;
  if (now - previous < 3200) {
    return res.status(200).json({ success: false, retryable: true, error: "Please wait a moment before running another scan." });
  }
  activeUsers.set(userId, now);
  if (activeUsers.size > 5000) {
    for (const [uid, timestamp] of activeUsers) if (now - timestamp > 60000) activeUsers.delete(uid);
  }

  const client = getAI();
  if (!client) return res.status(200).json({ success: false, retryable: false, error: "Plant diagnosis is unavailable because GEMINI_API_KEY is not configured on the server." });

  const contents = [
    { inlineData: { mimeType, data: req.file.buffer.toString("base64") } },
    { text: prompt }
  ];

  let diagnosis = null;
  let selectedModel = null;
  let lastError = null;
  for (const model of models()) {
    try {
      const response = await callGemini(client, model, contents);
      diagnosis = normalize(parseModelJson(response.text));
      selectedModel = model;
      break;
    } catch (error) {
      lastError = error;
      const status = errorCode(error);
      console.warn(`Disease detection model ${model} failed (${status || "unknown"}): ${error.message}`);
      // Invalid model names should fall through to the next model. Authentication,
      // permission and malformed-request errors are not fixed by retrying the same call.
      if (permanent(error)) break;
    }
  }

  if (!diagnosis) {
    const status = errorCode(lastError);
    if (status === 401 || status === 403) {
      return res.status(200).json({ success: false, retryable: false, error: "Gemini rejected the server API key or project permission. Check GEMINI_API_KEY, billing and API access in Google AI Studio/Google Cloud." });
    }
    if (status === 429) {
      return res.status(200).json({ success: false, retryable: true, error: "Gemini rate limit reached. Please wait a few seconds and scan again." });
    }
    if (status === 400) {
      return res.status(200).json({ success: false, retryable: false, error: "Gemini rejected the image-analysis request. The image was valid, but the AI request could not be processed." });
    }
    return res.status(200).json({ success: false, retryable: true, error: "Plant diagnosis is temporarily unavailable. The AI service did not return a reliable result after retrying available models." });
  }

  if (!diagnosis.is_plant) {
    return res.status(200).json({ success: false, ...diagnosis, confidence: null, error: "No reliable plant specimen was detected. Please aim the camera at a clear crop leaf or upload a clear plant image." });
  }

  return res.status(200).json({
    success: true,
    ...diagnosis,
    source: `Gemini AI (${selectedModel})`,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user: req.diseaseUser.name
  });
}

express.application.post = function (route, ...handlers) {
  if (route === "/predict") return originalPost.call(this, route, requireUser, upload.single("image"), diagnose);
  return originalPost.call(this, route, ...handlers);
};
