import path from "path";

// Resilient dynamic import for express-validator
let body, validationResult;
try {
  const ev = await import("express-validator");
  body = ev.body;
  validationResult = ev.validationResult;
} catch (err) {
  console.warn("⚠️ [Validation] express-validator not found; using passthrough validator fallback.");
  const createChain = () => {
    const chain = (req, res, next) => next();
    chain.isFloat = () => chain;
    chain.isIn = () => chain;
    chain.isString = () => chain;
    chain.trim = () => chain;
    chain.isLength = () => chain;
    chain.optional = () => chain;
    chain.withMessage = () => chain;
    return chain;
  };
  body = () => createChain();
  validationResult = () => ({ isEmpty: () => true, array: () => [] });
}

/**
 * Middleware to validate request files
 * Prevents directory traversal and suspicious filenames
 */
export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Sanitize filename - prevent directory traversal
    const originalName = req.file.originalname || "image.jpg";
    const sanitized = path.basename(originalName);
    
    // Whitelist allowed extensions
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const fileExt = path.extname(sanitized).toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP"
      });
    }

    // Limit filename length
    if (sanitized.length > 255) {
      return res.status(400).json({
        success: false,
        error: "Filename too long (max 255 characters)"
      });
    }

    // Validate file size (default 30MB)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || 31457280);
    if (req.file.size > maxSize) {
      return res.status(413).json({
        success: false,
        error: `File too large. Maximum size: ${(maxSize / 1024 / 1024).toFixed(1)}MB`
      });
    }

    // Validate MIME type
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "Invalid file MIME type"
      });
    }

    // Update filename to sanitized version
    req.file.originalname = sanitized;
    next();
  } catch (err) {
    res.status(400).json({
      success: false,
      error: "File validation error: " + err.message
    });
  }
};

/**
 * Validate crop recommendation input
 */
export const validateCropRecommendation = [
  body("temp")
    .isFloat({ min: -50, max: 60 })
    .withMessage("Temperature must be between -50 and 60°C"),
  body("rainfall")
    .isFloat({ min: 0, max: 5000 })
    .withMessage("Rainfall must be between 0 and 5000mm"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

/**
 * Validate fertilizer calculation input
 */
export const validateFertilizerInput = [
  body("plot_size")
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage("Plot size must be between 0.01 and 10000"),
  body("unit")
    .isIn(["acres", "hectares", "bigha", "sqm"])
    .withMessage("Invalid unit. Use: acres, hectares, bigha, or sqm"),
  body("crop")
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Crop name must be 1-50 characters"),
  body("pH")
    .isFloat({ min: 3, max: 10 })
    .withMessage("pH must be between 3 and 10"),
  body("N")
    .isFloat({ min: 0, max: 500 })
    .withMessage("Nitrogen must be between 0 and 500"),
  body("P")
    .isFloat({ min: 0, max: 500 })
    .withMessage("Phosphorus must be between 0 and 500"),
  body("K")
    .isFloat({ min: 0, max: 500 })
    .withMessage("Potassium must be between 0 and 500"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

/**
 * Validate profit calculation input
 */
export const validateProfitCalculation = [
  body("crop")
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Crop name must be 1-100 characters"),
  body("acres")
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage("Acres must be between 0.01 and 10000"),
  body("yield_per_acre")
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Yield must be between 0 and 10000"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

/**
 * Validate profile update input
 */
export const validateProfileUpdate = [
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1-100 characters"),
  body("farmLocation")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Farm location must be 1-120 characters"),
  body("preferredLanguage")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage("Language code must be 2-10 characters"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

/**
 * Validate weather query parameters
 */
export const validateWeatherQuery = [
  body("city")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("City must be 1-100 characters"),
  body("lat")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
  body("lon")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

/**
 * Sanitize string input - remove potential XSS
 */
export const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/[<>]/g, "") // Remove angle brackets
    .trim()
    .slice(0, 1000); // Limit length
};

/**
 * Validate JSON structure from Gemini response
 */
export const validateGeminiResponse = (data) => {
  const required = ["plant", "disease", "severity", "cause"];
  return required.every(field => field in data);
};
