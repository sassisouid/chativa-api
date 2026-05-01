'use strict';

/**
 * Structured JSON logger.
 * Each log line is a JSON object: { level, msg, ts: ISO string, ...meta }
 */

function formatLog(level, msg, meta) {
  return JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  });
}

const logger = {
  /**
   * Log an informational message.
   * @param {string} msg
   * @param {object} [meta]
   */
  info(msg, meta = {}) {
    console.log(formatLog('info', msg, meta));
  },

  /**
   * Log a warning message.
   * @param {string} msg
   * @param {object} [meta]
   */
  warn(msg, meta = {}) {
    console.warn(formatLog('warn', msg, meta));
  },

  /**
   * Log an error message.
   * @param {string} msg
   * @param {object} [meta]
   */
  error(msg, meta = {}) {
    console.error(formatLog('error', msg, meta));
  },
};

module.exports = logger;
