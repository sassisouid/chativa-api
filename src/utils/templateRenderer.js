'use strict';
const fs = require('fs');
const path = require('path');
const { NotFoundError } = require('./errors');

const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

/**
 * Renders an HTML email template by replacing {{key}} tokens with provided values.
 *
 * @param {string} name       - Template name (without .html extension)
 * @param {Object} variables  - Key/value map of token substitutions
 * @returns {string} Rendered HTML string
 * @throws {NotFoundError} If the template file does not exist
 */
function renderTemplate(name, variables = {}) {
  const templatePath = path.join(TEMPLATES_DIR, `${name}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new NotFoundError(`Email template '${name}'`);
  }
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
  }
  return html;
}

module.exports = { renderTemplate };
