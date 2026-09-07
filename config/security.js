import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

/**
 * CORS Configuration
 * Restrict origins to prevent unauthorized cross-origin requests
 */
export const corsConfig = () => {
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map(o => o.trim());

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Origin not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
  });
};

/**
 * Rate Limiting Configuration
 * Prevent brute force attacks and abuse
 */
export const createRateLimiter = (windowMs = 60000, max = 100) => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || windowMs),
    max: parseInt(process.env.RATE_LIMIT_REQUESTS || max),
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === "/health";
    },
    keyGenerator: (req) => {
      // Use X-Forwarded-For if behind proxy
      return req.ip || req.connection.remoteAddress;
    }
  });
};

/**
 * Strict rate limiter for sensitive endpoints
 * POST endpoints (login, prediction, etc.) get stricter limits
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: "Too many requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Helmet configuration for security headers
 */
export const helmetConfig = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "*.firebase.com", "*.firebaseio.com", "api.openweathermap.org", "api.open-meteo.com"],
      }
    },
    frameguard: {
      action: "deny" // Prevent clickjacking
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin"
    },
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true
    }
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

  // Strict rate limiting for sensitive routes
  app.use("/predict", strictRateLimiter);
  app.use("/set_session", strictRateLimiter);
  app.use("/api/update_profile", strictRateLimiter);
};

/**
 * Session security options
 */
export const sessionSecurityOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict", // CSRF protection (stricter than 'none')
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  signed: true // Require session signature
};
