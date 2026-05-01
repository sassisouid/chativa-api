'use strict';
const sanitizeHtml = require('sanitize-html');

// Tags that must never appear in sanitized output
const BLOCKED_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
const ALLOWED_TAGS = sanitizeHtml.defaults.allowedTags.filter(tag => !BLOCKED_TAGS.includes(tag));

/**
 * Sanitizes an HTML string, removing dangerous tags and event-handler attributes.
 *
 * Blocked tags: script, iframe, object, embed, form, input, button
 * Blocked attributes: all on* event handlers
 *
 * @param {string} html - Raw HTML string to sanitize
 * @returns {string} Sanitized HTML string (empty string if input is falsy)
 */
function sanitize(html) {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['style', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}

module.exports = { sanitize };
