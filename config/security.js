// Security middleware and Firebase authentication helpers.
let rateLimit;
try {
  const mod = await import("express-rate-limit");
  rateLimit = mod.default || mod.rateLimit || mod;
} catch (err) {
  console.warn("⚠️ [Security] express-rate-limit not found; using built-in in-memory rate limiter fallback.");
  rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 60000;
    const max = options.max || 120;
    const hits = new Map();
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of hits.entries()) if (now > record.resetTime) hits.delete(key);
    }, Math.min(windowMs, 60000));
    cleanupInterval.unref?.();
    return (req, res, next) => {
      if (options.skip && options.skip(req)) return next();
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "global";
      const now = Date.now();
      let record = hits.get(ip);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
        hits.set(ip, record);
      }
      record.count++;
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - record.count));
      res.setHeader("RateLimit-Reset", Math.ceil((record.resetTime - now) / 1000));
      if (record.count > max) return res.status(429).json(options.message || { success: false, error: "Too many requests, please try again shortly." });
      next();
    };
  };
}

let cors;
try {
  const mod = await import("cors");
  cors = mod.default || mod;
} catch (err) {
  console.warn("⚠️ [Security] cors not found; using fallback CORS middleware.");
  cors = () => (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}

let helmet;
try {
  const mod = await import("helmet");
  helmet = mod.default || mod;
} catch (err) {
  console.warn("⚠️ [Security] helmet not found; using fallback headers middleware.");
  helmet = () => (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "0");
    next();
  };
}

let firebaseAdminAuthPromise = null;

async function getFirebaseAdminAuth() {
  if (firebaseAdminAuthPromise) return firebaseAdminAuthPromise;
  firebaseAdminAuthPromise = (async () => {
    const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");

    if (getApps().length === 0) {
      let credential;
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        let serviceAccount;
        try { serviceAccount = JSON.parse(serviceAccountJson); }
        catch (_) { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
        if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        credential = cert(serviceAccount);
      } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        credential = cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
      } else {
        credential = applicationDefault();
      }
      initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    }
    return getAuth();
  })().catch(error => {
    firebaseAdminAuthPromise = null;
    throw error;
  });
  return firebaseAdminAuthPromise;
}

function readRequestBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (_) { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

// /set_session runs before express.json() in this project, so this middleware
// parses that small JSON body itself and leaves only verified identity data on req.body.
export const firebaseSessionGuard = async (req, res, next) => {
  if (req.method !== "POST" || req.path !== "/set_session") return next();

  try {
    const incoming = await readRequestBody(req);
    const idToken = incoming?.idToken;
    if (!idToken || typeof idToken !== "string" || idToken.length < 100) {
      return res.status(401).json({ success: false, error: "Missing Firebase ID token. Please sign in again." });
    }

    const decodedToken = await (await getFirebaseAdminAuth()).verifyIdToken(idToken, true);
    const requestedProvider = incoming.provider === "google" ? "google" : "password";

    req.body = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "Smart Farmer",
      photo: decodedToken.picture || null,
      provider: requestedProvider,
      emailVerified: Boolean(decodedToken.email_verified),
      firebaseVerified: true
    };
    return next();
  } catch (error) {
    console.warn("🔐 Firebase session verification failed:", error.code || error.message);
    return res.status(401).json({ success: false, error: "Authentication token is invalid or expired. Please sign in again." });
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
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
  };
  const missing = ["apiKey", "authDomain", "projectId", "appId"].filter(key => !config[key]);
  if (missing.length) return res.status(503).json({ error: "Firebase is not configured on the server.", missing });
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json(config);
};

export const corsConfig = () => {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)
    : [];
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      const isAllowedHostedOrigin = origin.includes("localhost") || origin.includes("127.0.0.1") || origin.endsWith(".run.app") || origin.endsWith(".render.com") || origin.endsWith(".ai.studio");
      if (isAllowedHostedOrigin) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 204,
    maxAge: 86400
  });
};

export const createRateLimiter = (windowMs = 60000, max = 120) => rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || windowMs, 10),
  max: parseInt(process.env.RATE_LIMIT_REQUESTS || max, 10),
  message: { success: false, error: "Too many requests from this IP, please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === "/health" || req.path === "/sw.js"
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: "Too many requests. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false
});

export const helmetConfig = () => helmet({
  contentSecurityPolicy: false,
  frameguard: false,
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
  secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true",
  sameSite: process.env.SESSION_SAMESITE || "lax",
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000
};
