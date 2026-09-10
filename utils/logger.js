/** Structured JSON logger for container environments. */
class Logger {
  constructor(level = process.env.LOG_LEVEL || "info") {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.currentLevel = this.levels[level] ?? this.levels.info;
  }
  formatLog(level, message, meta = {}) {
    return JSON.stringify({ timestamp: new Date().toISOString(), level: level.toUpperCase(), message, ...meta });
  }
  error(message, meta = {}) { if (this.levels.error <= this.currentLevel) console.error(this.formatLog("error", message, meta)); }
  warn(message, meta = {}) { if (this.levels.warn <= this.currentLevel) console.warn(this.formatLog("warn", message, meta)); }
  info(message, meta = {}) { if (this.levels.info <= this.currentLevel) console.log(this.formatLog("info", message, meta)); }
  debug(message, meta = {}) { if (this.levels.debug <= this.currentLevel) console.debug(this.formatLog("debug", message, meta)); }
}
export default new Logger();
