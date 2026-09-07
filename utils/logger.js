import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, "../logs");

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Simple structured logger
 * Logs to console and file
 */
class Logger {
  constructor(level = process.env.LOG_LEVEL || "info") {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = this.levels[level] || 2;
  }

  /**
   * Format timestamp as ISO string
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with metadata
   */
  formatLog(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: this.getTimestamp(),
      level: level.toUpperCase(),
      message,
      ...meta
    });
  }

  /**
   * Write log to file
   */
  writeToFile(level, formattedLog) {
    const filename = path.join(logsDir, `${level}.log`);
    const allFilename = path.join(logsDir, "combined.log");

    try {
      fs.appendFileSync(filename, formattedLog + "\n");
      fs.appendFileSync(allFilename, formattedLog + "\n");
    } catch (err) {
      console.error("Failed to write log:", err.message);
    }
  }

  /**
   * Log error level
   */
  error(message, meta = {}) {
    if (this.levels.error <= this.currentLevel) {
      const formattedLog = this.formatLog("error", message, meta);
      console.error(formattedLog);
      this.writeToFile("error", formattedLog);
    }
  }

  /**
   * Log warning level
   */
  warn(message, meta = {}) {
    if (this.levels.warn <= this.currentLevel) {
      const formattedLog = this.formatLog("warn", message, meta);
      console.warn(formattedLog);
      this.writeToFile("warn", formattedLog);
    }
  }

  /**
   * Log info level
   */
  info(message, meta = {}) {
    if (this.levels.info <= this.currentLevel) {
      const formattedLog = this.formatLog("info", message, meta);
      console.log(formattedLog);
      this.writeToFile("info", formattedLog);
    }
  }

  /**
   * Log debug level
   */
  debug(message, meta = {}) {
    if (this.levels.debug <= this.currentLevel) {
      const formattedLog = this.formatLog("debug", message, meta);
      console.debug(formattedLog);
      this.writeToFile("debug", formattedLog);
    }
  }
}

export default new Logger();
