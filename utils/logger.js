/**
 * Structured JSON logger for Node.js / container environments.
 *
 * Usage:
 *   import logger from "./logger.js";
 *
 *   logger.info("Server started");
 *   logger.warn("Something may be wrong");
 *   logger.error("Something failed");
 *   logger.debug("Debug information");
 *
 * Environment variables:
 *   LOG_LEVEL=error|warn|info|debug
 *   LOG_SERVICE=agriculture-prediction
 *   LOG_STACK=true
 *   LOG_SILENT=true
 */

class Logger {
  constructor(options = {}) {
    this.levels = Object.freeze({
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    });

    const configuredLevel =
      options.level ||
      process.env.LOG_LEVEL ||
      "info";

    this.level = this.normalizeLevel(configuredLevel);

    this.currentLevel = this.levels[this.level];

    this.service =
      options.service ||
      process.env.LOG_SERVICE ||
      "agriculture-prediction";

    this.environment =
      options.environment ||
      process.env.NODE_ENV ||
      "development";

    this.silent =
      options.silent !== undefined
        ? Boolean(options.silent)
        : process.env.LOG_SILENT === "true";

    this.includeStack =
      options.includeStack !== undefined
        ? Boolean(options.includeStack)
        : process.env.LOG_STACK === "true";
  }

  /**
   * Validate the configured log level.
   */
  normalizeLevel(level) {
    const normalized = String(level).trim().toLowerCase();

    if (Object.prototype.hasOwnProperty.call(this.levels, normalized)) {
      return normalized;
    }

    return "info";
  }

  /**
   * Check whether a message should be logged.
   */
  shouldLog(level) {
    if (this.silent) {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(this.levels, level)) {
      return false;
    }

    return this.levels[level] <= this.currentLevel;
  }

  /**
   * Check whether a key contains sensitive information.
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      "password",
      "passwd",
      "token",
      "accessToken",
      "refreshToken",
      "idToken",
      "authorization",
      "cookie",
      "secret",
      "apiKey",
      "apikey",
      "privateKey",
      "clientSecret",
    ];

    const normalizedKey = String(key).toLowerCase();

    return sensitiveKeys.some((sensitiveKey) =>
      normalizedKey.includes(sensitiveKey.toLowerCase())
    );
  }

  /**
   * Safely serialize metadata.
   */
  sanitize(value, seen = new WeakSet()) {
    if (value === null || value === undefined) {
      return value;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Error) {
      const errorData = {
        name: value.name || "Error",
        message: value.message || "Unknown error",
      };

      if (value.code !== undefined) {
        errorData.code = value.code;
      }

      if (value.status !== undefined) {
        errorData.status = value.status;
      }

      if (value.statusCode !== undefined) {
        errorData.statusCode = value.statusCode;
      }

      if (this.includeStack && value.stack) {
        errorData.stack = value.stack;
      }

      return errorData;
    }

    if (typeof value === "function") {
      return "[Function]";
    }

    if (typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value === "object") {
      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((item) =>
          this.sanitize(item, seen)
        );
      }

      const result = {};

      for (const [key, item] of Object.entries(value)) {
        if (this.isSensitiveKey(key)) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = this.sanitize(item, seen);
        }
      }

      return result;
    }

    return String(value);
  }

  /**
   * Normalize the message.
   */
  normalizeMessage(message) {
    if (message instanceof Error) {
      return message.message || "Unknown error";
    }

    if (typeof message === "string") {
      return message;
    }

    if (
      typeof message === "number" ||
      typeof message === "boolean"
    ) {
      return String(message);
    }

    try {
      return JSON.stringify(this.sanitize(message));
    } catch {
      return "[Unable to serialize message]";
    }
  }

  /**
   * Create the structured log object.
   */
  formatLog(level, message, meta = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.service,
      environment: this.environment,
      message: this.normalizeMessage(message),
    };

    if (meta !== null && meta !== undefined) {
      const safeMeta = this.sanitize(meta);

      if (
        safeMeta &&
        typeof safeMeta === "object" &&
        !Array.isArray(safeMeta)
      ) {
        Object.assign(log, safeMeta);
      } else {
        log.meta = safeMeta;
      }
    }

    return JSON.stringify(log);
  }

  /**
   * Write a log message.
   */
  write(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const output = this.formatLog(level, message, meta);

    switch (level) {
      case "error":
        console.error(output);
        break;

      case "warn":
        console.warn(output);
        break;

      case "debug":
        console.debug(output);
        break;

      case "info":
      default:
        console.log(output);
        break;
    }
  }

  /**
   * Log an error.
   */
  error(message, meta = {}) {
    if (message instanceof Error) {
      this.write("error", message.message, {
        ...meta,
        error: this.sanitize(message),
      });

      return;
    }

    this.write("error", message, meta);
  }

  /**
   * Log a warning.
   */
  warn(message, meta = {}) {
    this.write("warn", message, meta);
  }

  /**
   * Log normal information.
   */
  info(message, meta = {}) {
    this.write("info", message, meta);
  }

  /**
   * Log debugging information.
   */
  debug(message, meta = {}) {
    this.write("debug", message, meta);
  }

  /**
   * Create a child logger with additional context.
   */
  child(context = {}) {
    const parent = this;

    return {
      error(message, meta = {}) {
        parent.error(message, {
          ...context,
          ...meta,
        });
      },

      warn(message, meta = {}) {
        parent.warn(message, {
          ...context,
          ...meta,
        });
      },

      info(message, meta = {}) {
        parent.info(message, {
          ...context,
          ...meta,
        });
      },

      debug(message, meta = {}) {
        parent.debug(message, {
          ...context,
          ...meta,
        });
      },
    };
  }

  /**
   * Create a logger with a request ID.
   */
  withRequest(requestId, context = {}) {
    return this.child({
      requestId,
      ...context,
    });
  }

  /**
   * Change log level while the application is running.
   */
  setLevel(level) {
    this.level = this.normalizeLevel(level);
    this.currentLevel = this.levels[this.level];
  }

  /**
   * Get logger configuration.
   */
  getConfig() {
    return {
      level: this.level,
      service: this.service,
      environment: this.environment,
      silent: this.silent,
      includeStack: this.includeStack,
    };
  }
}

const logger = new Logger();

export default logger;