/**
 * Spam filter service.
 *
 * Scores an inbound email using 6 weighted signals and returns a score in
 * [0, 10] along with the list of triggered signal names.
 *
 * Signal weights are read from environment variables with sensible defaults:
 *   SPAM_W_KEYWORDS          (default 2.0)
 *   SPAM_W_DOMAIN_MISMATCH   (default 1.5)
 *   SPAM_W_LINK_DENSITY      (default 1.5)
 *   SPAM_W_DISPOSABLE_DOMAIN (default 3.0)
 *   SPAM_W_NO_MX             (default 2.0)
 *   SPAM_W_TEXT_LINK_RATIO   (default 1.0)
 */

'use strict';

const dns = require('dns');
const disposableDomains = require('./disposableDomains');

// ---------------------------------------------------------------------------
// Spam keyword list
// ---------------------------------------------------------------------------
const SPAM_KEYWORDS = [
  'viagra',
  'casino',
  'lottery',
  'winner',
  'click here',
  'free money',
  'make money fast',
  'earn $',
  'limited offer',
  'act now',
  'you have been selected',
  'congratulations you won',
  'claim your prize',
  'wire transfer',
  'nigerian prince',
  'inheritance',
  'urgent reply',
];

// ---------------------------------------------------------------------------
// Helper: read a float from an env var with a fallback default
// ---------------------------------------------------------------------------
function envFloat(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ---------------------------------------------------------------------------
// Helper: extract the domain part from an email address string
// e.g. "John Doe <john@example.com>" → "example.com"
//      "john@example.com"            → "example.com"
// ---------------------------------------------------------------------------
function extractSenderDomain(sender) {
  // Try to find an angle-bracket address first
  const angleMatch = sender.match(/<([^>]+)>/);
  const address = angleMatch ? angleMatch[1] : sender.trim();
  const atIndex = address.lastIndexOf('@');
  if (atIndex === -1) return '';
  return address.slice(atIndex + 1).toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Helper: extract the display name (part before '<')
// e.g. "John Doe <john@example.com>" → "John Doe"
//      "john@example.com"            → ""
// ---------------------------------------------------------------------------
function extractDisplayName(sender) {
  const angleIndex = sender.indexOf('<');
  if (angleIndex === -1) return '';
  return sender.slice(0, angleIndex).trim();
}

// ---------------------------------------------------------------------------
// Signal 1: Spam keywords in subject + body text
// ---------------------------------------------------------------------------
function signalKeywords(subject, bodyText) {
  const haystack = `${subject || ''} ${bodyText || ''}`.toLowerCase();
  return SPAM_KEYWORDS.some((kw) => haystack.includes(kw));
}

// ---------------------------------------------------------------------------
// Signal 2: Sender display name vs. domain mismatch
//
// Split the display name into words longer than 3 characters. If none of
// those words appear (case-insensitively) in the sender domain, trigger.
// ---------------------------------------------------------------------------
function signalDomainMismatch(sender) {
  const domain = extractSenderDomain(sender);
  if (!domain) return false;

  const displayName = extractDisplayName(sender);
  if (!displayName) return false;

  const words = displayName
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 3);

  if (words.length === 0) return false;

  return !words.some((word) => domain.includes(word));
}

// ---------------------------------------------------------------------------
// Signal 3: Link density — more than 1 link per 50 words
// ---------------------------------------------------------------------------
function signalLinkDensity(bodyHtml, bodyText) {
  const html = bodyHtml || '';
  const text = bodyText || '';

  const linkCount = (html.match(/<a[\s>]/gi) || []).length;
  if (linkCount === 0) return false;

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  // Trigger when wordCount / linkCount < 50 (i.e. too many links per word)
  return wordCount / linkCount < 50;
}

// ---------------------------------------------------------------------------
// Signal 4: Sender domain is a known disposable email domain
// ---------------------------------------------------------------------------
function signalDisposableDomain(sender) {
  const domain = extractSenderDomain(sender);
  if (!domain) return false;
  return disposableDomains.has(domain);
}

// ---------------------------------------------------------------------------
// Signal 5: Sender domain has no valid MX record
// ---------------------------------------------------------------------------
async function signalNoMxRecord(sender) {
  const domain = extractSenderDomain(sender);
  if (!domain) return true; // no domain → treat as suspicious

  try {
    const records = await dns.promises.resolveMx(domain);
    return !records || records.length === 0;
  } catch (_err) {
    return true; // DNS lookup failed → no MX
  }
}

// ---------------------------------------------------------------------------
// Signal 6: Low text-to-HTML ratio (< 30 %)
// ---------------------------------------------------------------------------
function signalLowTextLinkRatio(bodyText, bodyHtml) {
  const text = bodyText || '';
  const html = bodyHtml || '';
  return text.length / (html.length || 1) < 0.30;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score an inbound email for spam likelihood.
 *
 * @param {object} email
 * @param {string} email.sender    - Full sender string, e.g. "Name <addr@domain>"
 * @param {string} email.subject   - Email subject line
 * @param {string} email.bodyText  - Plain-text body
 * @param {string} email.bodyHtml  - HTML body
 * @returns {Promise<{ score: number, signals: string[] }>}
 */
async function score({ sender = '', subject = '', bodyText = '', bodyHtml = '' }) {
  // Read weights from env (with defaults)
  const weights = {
    keywords:         envFloat('SPAM_W_KEYWORDS',          2.0),
    domainMismatch:   envFloat('SPAM_W_DOMAIN_MISMATCH',   1.5),
    linkDensity:      envFloat('SPAM_W_LINK_DENSITY',      1.5),
    disposableDomain: envFloat('SPAM_W_DISPOSABLE_DOMAIN', 3.0),
    noMxRecord:       envFloat('SPAM_W_NO_MX',             2.0),
    lowTextLinkRatio: envFloat('SPAM_W_TEXT_LINK_RATIO',   1.0),
  };

  // Evaluate all signals (MX check is async, rest are sync)
  const [
    hasKeywords,
    hasDomainMismatch,
    hasLinkDensity,
    hasDisposableDomain,
    hasNoMx,
    hasLowTextLinkRatio,
  ] = await Promise.all([
    Promise.resolve(signalKeywords(subject, bodyText)),
    Promise.resolve(signalDomainMismatch(sender)),
    Promise.resolve(signalLinkDensity(bodyHtml, bodyText)),
    Promise.resolve(signalDisposableDomain(sender)),
    signalNoMxRecord(sender),
    Promise.resolve(signalLowTextLinkRatio(bodyText, bodyHtml)),
  ]);

  const triggered = {
    keywords:         hasKeywords,
    domainMismatch:   hasDomainMismatch,
    linkDensity:      hasLinkDensity,
    disposableDomain: hasDisposableDomain,
    noMxRecord:       hasNoMx,
    lowTextLinkRatio: hasLowTextLinkRatio,
  };

  const signals = [];
  let total = 0;

  for (const [name, fired] of Object.entries(triggered)) {
    if (fired) {
      signals.push(name);
      total += weights[name];
    }
  }

  const finalScore = Math.min(10, parseFloat(total.toFixed(2)));

  return { score: finalScore, signals };
}

module.exports = { score };
