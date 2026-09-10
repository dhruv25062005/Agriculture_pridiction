import path from "node:path";
import { body, query, validationResult } from "express-validator";

const finish = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

export const validateFileUpload = (req, res, next) => {
  if (!req.file) return next();
  try {
    const name = path.basename(req.file.originalname || "image.jpg");
    const ext = path.extname(name).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowed.includes(ext)) return res.status(400).json({ success: false, error: "Invalid file type. Allowed: JPG, PNG, WebP" });
    const max = Number(process.env.MAX_FILE_SIZE || 8 * 1024 * 1024);
    if (!Number.isFinite(max) || max <= 0) return res.status(500).json({ success: false, error: "Upload size configuration is invalid." });
    if (req.file.size > max) return res.status(413).json({ success: false, error: `File too large. Maximum size: ${(max / 1024 / 1024).toFixed(1)}MB` });
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) return res.status(400).json({ success: false, error: "Invalid file MIME type" });

    const b = req.file.buffer;
    const isJpeg = b?.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
    const isPng = b?.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = b?.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    if (!isJpeg && !isPng && !isWebp) return res.status(400).json({ success: false, error: "File contents do not match a supported image format" });

    // Require the extension, MIME and magic bytes to describe the same format.
    const compatible = (ext === ".jpg" || ext === ".jpeg") ? isJpeg : ext === ".png" ? isPng : isWebp;
    if (!compatible) return res.status(400).json({ success: false, error: "File extension does not match its image contents" });
    req.file.originalname = name.slice(0, 120);
    next();
  } catch {
    res.status(400).json({ success: false, error: "File validation failed" });
  }
};

export const validateCropRecommendation = [
  body("temp").isFloat({ min: -50, max: 60 }),
  body("rainfall").isFloat({ min: 0, max: 5000 }),
  finish
];

export const validateFertilizerInput = [
  body("plot_size").isFloat({ min: 0.01, max: 10000 }),
  body("unit").isIn(["acres", "hectares", "bigha", "sqm"]),
  body("crop").isString().trim().isLength({ min: 1, max: 50 }),
  body("pH").isFloat({ min: 3, max: 10 }),
  body("N").isFloat({ min: 0, max: 500 }),
  body("P").isFloat({ min: 0, max: 500 }),
  body("K").isFloat({ min: 0, max: 500 }),
  finish
];

export const validateProfitCalculation = [
  body("crop").isString().trim().isLength({ min: 1, max: 100 }),
  body("acres").isFloat({ min: 0.01, max: 10000 }),
  body("yield_per_acre").optional().isFloat({ min: 0, max: 10000 }),
  finish
];

export const validateProfileUpdate = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 100 }),
  body("farmLocation").optional().isString().trim().isLength({ min: 1, max: 120 }),
  body("preferredLanguage").optional().isString().trim().isLength({ min: 2, max: 10 }),
  body("primaryCrop").optional().isString().trim().isLength({ min: 1, max: 80 }),
  body("farmSize").optional().isString().trim().isLength({ min: 1, max: 60 }),
  finish
];

export const validateWeatherQuery = [
  query("city").optional().isString().trim().isLength({ min: 1, max: 100 }),
  query("place").optional().isString().trim().isLength({ min: 1, max: 100 }),
  query("lat").optional().isFloat({ min: -90, max: 90 }),
  query("lon").optional().isFloat({ min: -180, max: 180 }),
  finish
];

export const sanitizeString = value => typeof value !== "string" ? value : value.replace(/[<>]/g, "").trim().slice(0, 1000);

export const validateGeminiResponse = data => Boolean(
  data &&
  typeof data === "object" &&
  ["plant", "disease", "severity", "cause"].every(field => typeof data[field] === "string" && data[field].length > 0)
);
