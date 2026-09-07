import logger from "../utils/logger.js";

/**
 * Async error wrapper - catches errors in async route handlers
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    next(err);
  });
};

/**
 * Global error handling middleware
 * Must be defined AFTER all other middleware and routes
 */
export const errorHandler = (err, req, res, next) => {
  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Log error details
  logger.error({
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation error";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized access";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    message = "Access forbidden";
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    message = "Resource not found";
  } else if (err.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests. Please try again later.";
  } else if (err.name === "PayloadTooLargeError") {
    statusCode = 413;
    message = "File size exceeds maximum limit";
  }

  // Don't expose stack trace in production
  const isProduction = process.env.NODE_ENV === "production";
  const errorResponse = {
    success: false,
    error: message,
    ...(! isProduction && { stack: err.stack })
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Should be used AFTER all routes
 */
export const notFoundHandler = (req, res) => {
  logger.warn({
    message: "Route not found",
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: "Route not found"
  });
};

/**
 * Custom error class
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error handler
 */
export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/**
 * Authentication error handler
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Authorization error handler
 */
export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Not found error handler
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Rate limit error handler
 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
    this.name = "RateLimitError";
  }
}
