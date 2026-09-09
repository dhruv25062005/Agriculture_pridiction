/**
 * Simple structured console logger
 * Standard stream logger for container & Cloud Run environments
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
   * Log error level
   */
  error(message, meta = {}) {
    if (this.levels.error <= this.currentLevel) {
      console.error(this.formatLog("error", message, meta));
    }
  }

  /**
   * Log warning level
   */
  warn(message, meta = {}) {
    if (this.levels.warn <= this.currentLevel) {
      console.warn(this.formatLog("warn", message, meta));
    }
  }

  /**
   * Log info level
   */
  info(message, meta = {}) {
    if (this.levels.info <= this.currentLevel) {
      console.log(this.formatLog("info", message, meta));
    }
  }

  /**
   * Log debug level
   */
  debug(message, meta = {}) {
    if (this.levels.debug <= this.currentLevel) {
      console.debug(this.formatLog("debug", message, meta));
    }
  }
}

export default new Logger();
