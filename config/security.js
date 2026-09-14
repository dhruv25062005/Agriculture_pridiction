// Security middleware and Firebase authentication helpers.

import "dotenv/config";

import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.RENDER === "true";

const DEFAULT_BODY_LIMIT = 256 * 1024; // 256 KB
const DEFAULT_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const DEFAULT_RATE_LIMIT_MAX = 120;
const SESSION_MAX_AGE = 5 * 24 * 60 * 60 * 1000; // 5 days;

/* -------------------------------------------------------------------------- */
/* Environment / session security                                             */
/* -------------------------------------------------------------------------- */

function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return;
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "SESSION_SECRET must be configured in production."
    );
  }

  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
}

ensureSessionSecret();

/* -------------------------------------------------------------------------- */
/* Firebase Admin                                                             */
/* -------------------------------------------------------------------------- */

let firebaseAdminAuthPromise = null;

/**
 * Get the Firebase Admin Auth instance.
 *
 * Supported credential methods:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 3. GOOGLE_APPLICATION_CREDENTIALS
 */
export async function getFirebaseAdminAuth() {
  if (firebaseAdminAuthPromise) {
    return firebaseAdminAuthPromise;
  }

  firebaseAdminAuthPromise = initializeFirebaseAdmin().catch((error) => {
    firebaseAdminAuthPromise = null;
    throw error;
  });

  return firebaseAdminAuthPromise;
}

async function initializeFirebaseAdmin() {
  const { getApps, initializeApp, cert, applicationDefault } =
    await import("firebase-admin/app");

  const { getAuth } = await import("firebase-admin/auth");

  // Reuse an existing Firebase Admin application.
  if (getApps().length === 0) {
    const credential = getFirebaseCredential({
      cert,
      applicationDefault
    });

    initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || undefined
    });
  }

  return getAuth();
}

function getFirebaseCredential({ cert, applicationDefault }) {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountJson) {
    return createCredentialFromServiceAccount(
      serviceAccountJson,
      cert
    );
  }

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY
  } = process.env;

  if (
    FIREBASE_PROJECT_ID &&
    FIREBASE_CLIENT_EMAIL &&
    FIREBASE_PRIVATE_KEY
  ) {
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(FIREBASE_PRIVATE_KEY)
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  throw new Error(
    "Firebase Admin credentials are not configured. " +
    "Set FIREBASE_SERVICE_ACCOUNT_JSON, " +
    "FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, " +
    "or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

function createCredentialFromServiceAccount(serviceAccountJson, cert) {
  let account;

  try {
    account = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
    );
  }

  if (!account.project_id && !process.env.FIREBASE_PROJECT_ID) {
    throw new Error(
      "Firebase service account is missing project_id."
    );
  }

  if (!account.client_email || !account.private_key) {
    throw new Error(
      "Firebase service account must contain client_email and private_key."
    );
  }

  return cert({
    ...account,
    projectId:
      account.project_id ||
      process.env.FIREBASE_PROJECT_ID,
    privateKey: normalizePrivateKey(account.private_key)
  });
}

function normalizePrivateKey(privateKey) {
  return privateKey.replace(/\\n/g, "\n").trim();
}

/* -------------------------------------------------------------------------- */
/* Request body handling                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Read a JSON request body only when Express has not already parsed it.
 *
 * Normally server.js should use express.json(), so this is only a fallback.
 */
function readRequestBody(req, maxBytes = DEFAULT_BODY_LIMIT) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const fail = (error) => {
      if (settled) return;

      settled = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      if (settled) return;

      size += chunk.length;

      if (size > maxBytes) {
        fail(new Error("Request body too large."));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;

      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");

        settled = true;
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        fail(new Error("Invalid JSON body."));
      }
    });

    req.on("error", fail);
    req.on("aborted", () => {
      fail(new Error("Request was aborted."));
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Firebase session middleware                                                */
/* -------------------------------------------------------------------------- */

export const firebaseSessionGuard = async (req, res, next) => {
  // Only protect POST /set_session.
  if (req.method !== "POST" || req.path !== "/set_session") {
    return next();
  }

  try {
    const body = await readRequestBody(req);
    const idToken = body?.idToken;

    if (!isValidFirebaseTokenFormat(idToken)) {
      return res.status(401).json({
        success: false,
        error: "Missing Firebase ID token. Please sign in again."
      });
    }

    const auth = await getFirebaseAdminAuth();

    const decodedToken = await auth.verifyIdToken(idToken, true);

    // Store the verified token separately.
    req.firebaseIdToken = idToken;

    // Store only trusted Firebase information.
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      name:
        decodedToken.name ||
        decodedToken.email?.split("@")[0] ||
        "Smart Farmer",
      photo: decodedToken.picture || null,
      provider:
        decodedToken.firebase?.sign_in_provider ||
        "password",
      emailVerified: Boolean(decodedToken.email_verified),
      firebaseVerified: true
    };

    /*
     * Keep req.body compatible with existing /set_session routes.
     *
     * If your route expects req.body.uid/email/etc., this preserves
     * that behavior while also exposing req.firebaseUser.
     */
    req.body = req.firebaseUser;

    return next();
  } catch (error) {
    console.warn(
      "Firebase session verification failed:",
      error?.code || error?.message || error
    );

    return res.status(401).json({
      success: false,
      error:
        "Authentication token is invalid, expired, or revoked. " +
        "Please sign in again."
    });
  }
};

function isValidFirebaseTokenFormat(token) {
  return (
    typeof token === "string" &&
    token.length >= 100 &&
    token.length <= 10_000
  );
}

/* -------------------------------------------------------------------------- */
/* Firebase client configuration                                              */
/* -------------------------------------------------------------------------- */

export const firebaseConfigMiddleware = (req, res, next) => {
  if (req.method !== "GET" || req.path !== "/firebase_config") {
    return next();
  }

  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId:
      process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
    measurementId:
      process.env.FIREBASE_MEASUREMENT_ID || "",
    firestoreDatabaseId:
      process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
      "(default)"
  };

  const requiredFields = [
    "apiKey",
    "authDomain",
    "projectId",
    "appId"
  ];

  const missing = requiredFields.filter(
    (field) => !config[field]
  );

  if (missing.length > 0) {
    return res.status(503).json({
      success: false,
      error: "Firebase is not configured on the server.",
      missing
    });
  }

  res.setHeader(
    "Cache-Control",
    "public, max-age=3600"
  );

  return res.json(config);
};

/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* -------------------------------------------------------------------------- */

export const corsConfig = () => {
  const allowedOrigins = parseOrigins(
    process.env.CORS_ORIGINS
  );

  const renderOrigin = normalizeOrigin(
    process.env.RENDER_EXTERNAL_URL
  );

  const allowDevelopmentCors =
    !IS_PRODUCTION &&
    process.env.ALLOW_DEV_CORS !== "false";

  return cors({
    origin(origin, callback) {
      // Requests without an Origin header are allowed.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (renderOrigin && normalizedOrigin === renderOrigin) ||
        (allowDevelopmentCors &&
          isLocalDevelopmentOrigin(normalizedOrigin))
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS origin not allowed.")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With"
    ],

    maxAge: 86_400
  });
};

function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/$/, "");
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);

    return (
      (url.protocol === "http:" &&
        (url.hostname === "localhost" ||
          url.hostname === "127.0.0.1")) ||
      (url.protocol === "https:" &&
        (url.hostname === "localhost" ||
          url.hostname === "127.0.0.1"))
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

export const createRateLimiter = (
  windowMs = DEFAULT_RATE_LIMIT_WINDOW,
  max = DEFAULT_RATE_LIMIT_MAX
) =>
  rateLimit({
    windowMs: getPositiveNumber(
      process.env.RATE_LIMIT_WINDOW_MS,
      windowMs
    ),

    max: getPositiveNumber(
      process.env.RATE_LIMIT_REQUESTS,
      max
    ),

    standardHeaders: true,
    legacyHeaders: false,

    skip: (req) =>
      req.path === "/health" ||
      req.path === "/sw.js"
  });

export const strictRateLimiter = rateLimit({
  windowMs: DEFAULT_RATE_LIMIT_WINDOW,

  max: getPositiveNumber(
    process.env.STRICT_RATE_LIMIT_REQUESTS,
    60
  ),

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: "Too many requests. Please wait a moment."
  }
});

function getPositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}

/* -------------------------------------------------------------------------- */
/* Helmet                                                                     */
/* -------------------------------------------------------------------------- */

export const helmetConfig = () =>
  helmet({
    contentSecurityPolicy: false,

    frameguard: {
      action: "deny"
    },

    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  });

/* -------------------------------------------------------------------------- */
/* Combined security middleware                                               */
/* -------------------------------------------------------------------------- */

export const securityMiddleware = (app) => {
  app.use(helmetConfig());
  app.use(corsConfig());
  app.use(createRateLimiter());

  app.use(firebaseConfigMiddleware);
  app.use(firebaseSessionGuard);
};

/* -------------------------------------------------------------------------- */
/* Session cookie configuration                                               */
/* -------------------------------------------------------------------------- */

export const sessionSecurityOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: process.env.SESSION_SAMESITE || "lax",
  signed: true,
  maxAge: SESSION_MAX_AGE,
  path: "/"
};