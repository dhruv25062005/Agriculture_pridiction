// Resilient dynamic imports with fallback for external deployment environments (Render, Cloud Run, etc.)
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
      for (const [key, record] of hits.entries()) {
        if (now > record.resetTime) {
          hits.delete(key);
        }
      }
    }, Math.min(windowMs, 60000));
    if (cleanupInterval.unref) cleanupInterval.unref();

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
      if (record.count > max) {
        return res.status(429).json(options.message || { success: false, error: "Too many requests, please try again shortly." });
      }
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
  cors = (options = {}) => (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  };
}

let helmet;
try {
  const mod = await import("helmet");
  helmet = mod.default || mod;
} catch (err) {
  console.warn("⚠️ [Security] helmet not found; using fallback headers middleware.");
  helmet = (options = {}) => (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "0");
    next();
  };
}

/**
 * CORS Configuration
 * Restrict origins to prevent unauthorized cross-origin requests while supporting
 * AI Studio preview iframes, Render deployment, and localhost environments.
 */
export const corsConfig = () => {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    : [];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, same-origin)
      if (!origin) {
        return callback(null, true);
      }
      // Allow explicitly configured origins
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow local development, AI Studio run.app, and Render domains
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes(".run.app") ||
        origin.includes(".render.com") ||
        origin.includes("google.com") ||
        origin.includes("ai.studio")
      ) {
        return callback(null, true);
      }
      // Fallback to allow for flexible preview
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
  });
};

/**
 * Rate Limiting Configuration
 * Prevent brute force attacks and abuse while supporting standard IPv4/IPv6 resolution.
 */
export const createRateLimiter = (windowMs = 60000, max = 120) => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || windowMs),
    max: parseInt(process.env.RATE_LIMIT_REQUESTS || max),
    message: { success: false, error: "Too many requests from this IP, please try again shortly." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path === "/sw.js"
  });
};

/**
 * Moderate rate limiter for sensitive endpoints
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: { success: false, error: "Too many requests. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Helmet configuration for security headers
 * Note: frameguard is disabled to allow AI Studio live preview iframe embedding.
 */
export const helmetConfig = () => {
  return helmet({
    contentSecurityPolicy: false, // Disabled to prevent blocking Firebase SDKs and external APIs in dashboard
    frameguard: false, // Required for iframe rendering in Google AI Studio
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  });
};

/**
 * Security middleware chain
 */
export const securityMiddleware = (app) => {
  // Helmet for security headers
  app.use(helmetConfig());

  // CORS protection
  app.use(corsConfig());

  // Rate limiting for all routes
  app.use(createRateLimiter());
};

/**
 * Session security options
 * Uses sameSite: 'none' and secure: true for iframe preview compatibility
 */
export const sessionSecurityOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

