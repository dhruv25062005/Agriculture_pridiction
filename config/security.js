// Security middleware and Firebase authentication helpers.
import "dotenv/config";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
if (!process.env.SESSION_SECRET) {
  if (isProduction) throw new Error("SESSION_SECRET must be configured in production.");
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
}

let firebaseAdminAuthPromise = null;
export async function getFirebaseAdminAuth() {
  if (firebaseAdminAuthPromise) return firebaseAdminAuthPromise;
  firebaseAdminAuthPromise = (async () => {
    const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    if (getApps().length === 0) {
      let credential;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        let account;
        try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
        if (!account.project_id && !process.env.FIREBASE_PROJECT_ID) throw new Error("Firebase service account is missing project_id.");
        if (!account.client_email || !account.private_key) throw new Error("Firebase service account must contain client_email and private_key.");
        account.private_key = account.private_key.replace(/\\n/g, "\n");
        credential = cert(account);
      } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
        credential = cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = applicationDefault();
      } else {
        throw new Error("Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID.");
      }
      initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    }
    return getAuth();
  })().catch(err => { firebaseAdminAuthPromise = null; throw err; });
  return firebaseAdminAuthPromise;
}

function readRequestBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let size = 0;
    const chunks = [];
    let settled = false;
    const fail = err => { if (!settled) { settled = true; reject(err); } };
    req.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) return fail(new Error("Request body too large"));
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      try {
        settled = true;
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch { fail(new Error("Invalid JSON body")); }
    });
    req.on("error", fail);
  });
}

export const firebaseSessionGuard = async (req, res, next) => {
  if (req.method !== "POST" || req.path !== "/set_session") return next();
  try {
    const incoming = await readRequestBody(req);
    const idToken = incoming?.idToken;
    if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 10000) {
      return res.status(401).json({ success: false, error: "Missing Firebase ID token. Please sign in again." });
    }
    const decoded = await (await getFirebaseAdminAuth()).verifyIdToken(idToken, true);
    req.firebaseIdToken = idToken;
    req.body = {
      uid: decoded.uid,
      email: decoded.email || "",
      name: decoded.name || decoded.email?.split("@")[0] || "Smart Farmer",
      photo: decoded.picture || null,
      provider: decoded.firebase?.sign_in_provider || "password",
      emailVerified: Boolean(decoded.email_verified),
      firebaseVerified: true
    };
    next();
  } catch (err) {
    console.warn("Firebase session verification failed:", err.code || err.message);
    return res.status(401).json({ success: false, error: "Authentication token is invalid, expired, or revoked. Please sign in again." });
  }
};

export const firebaseConfigMiddleware = (req, res, next) => {
  if (req.method !== "GET" || req.path !== "/firebase_config") return next();
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() || "(default)"
  };
  const missing = ["apiKey", "authDomain", "projectId", "appId"].filter(k => !config[k]);
  if (missing.length) return res.status(503).json({ success: false, error: "Firebase is not configured on the server.", missing });
  res.setHeader("Cache-Control", "public,max-age=3600");
  res.json(config);
};

export const corsConfig = () => {
  const explicit = (process.env.CORS_ORIGINS || "").split(",").map(x => x.trim().replace(/\/$/, "")).filter(Boolean);
  const own = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  const allowDev = !isProduction && (process.env.ALLOW_DEV_CORS ?? "true") !== "false";
  return cors({
    origin: (origin, cb) => {
      if (!origin || explicit.includes(origin) || (own && origin === own) || (allowDev && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")))) return cb(null, true);
      cb(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400
  });
};

export const createRateLimiter = (windowMs = 60000, max = 120) => rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || windowMs),
  max: Number(process.env.RATE_LIMIT_REQUESTS || max),
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === "/health" || req.path === "/sw.js"
});

export const strictRateLimiter = rateLimit({
  windowMs: 60000,
  max: Number(process.env.STRICT_RATE_LIMIT_REQUESTS || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please wait a moment." }
});

export const helmetConfig = () => helmet({
  contentSecurityPolicy: false,
  frameguard: { action: "deny" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
});

export const securityMiddleware = app => {
  app.use(helmetConfig());
  app.use(corsConfig());
  app.use(createRateLimiter());
  app.use(firebaseConfigMiddleware);
  app.use(firebaseSessionGuard);
};

export const sessionSecurityOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: process.env.SESSION_SAMESITE || "lax",
  signed: true,
  maxAge: 5 * 24 * 60 * 60 * 1000,
  path: "/"
};
