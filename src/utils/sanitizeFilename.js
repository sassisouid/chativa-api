'use strict';

/**
 * Sanitizes a filename to prevent path traversal and shell injection.
 *
 * - Strips path-traversal and shell-special characters (/ \ ? % * : | " < >)
 * - Replaces whitespace runs with underscores
 * - Removes leading dots (prevents hidden files)
 * - Collapses consecutive underscores
 * - Truncates to 255 characters
 * - Falls back to 'attachment' if the result is empty
 *
 * @param {string} original - The original filename from the attachment
 * @returns {string} A safe filename string
 */
function sanitizeFilename(original) {
  if (!original || typeof original !== 'string') return 'attachment';
  return original
    .replace(/[/\\?%*:|"<>]/g, '_')   // strip path traversal and shell chars
    .replace(/\s+/g, '_')              // replace whitespace with underscores
    .replace(/^\.+/, '')               // strip leading dots (hidden files)
    .replace(/_{2,}/g, '_')            // collapse multiple underscores
    .substring(0, 255)                 // enforce max filename length
    || 'attachment';                   // fallback if result is empty
}

module.exports = { sanitizeFilename };
