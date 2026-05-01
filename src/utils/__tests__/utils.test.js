'use strict';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ─── hmacVerifier ────────────────────────────────────────────────────────────
describe('verifyWebhookSignature', () => {
  const { verifyWebhookSignature } = require('../hmacVerifier');

  it('returns true for a correct HMAC-SHA256 signature', () => {
    const body = Buffer.from('hello world');
    const secret = 'mysecret';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it('returns false when the body is tampered', () => {
    const body = Buffer.from('hello world');
    const secret = 'mysecret';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhookSignature(Buffer.from('tampered'), sig, secret)).toBe(false);
  });

  it('returns false when the signature is wrong', () => {
    const body = Buffer.from('hello world');
    const secret = 'mysecret';
    const wrongSig = crypto.createHmac('sha256', secret).update(Buffer.from('other')).digest('hex');
    expect(verifyWebhookSignature(body, wrongSig, secret)).toBe(false);
  });

  it('returns false when the secret is different', () => {
    const body = Buffer.from('hello world');
    const sig = crypto.createHmac('sha256', 'secret1').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, 'secret2')).toBe(false);
  });

  it('returns false for a null signature header', () => {
    const body = Buffer.from('hello world');
    expect(verifyWebhookSignature(body, null, 'secret')).toBe(false);
  });

  it('returns false for an empty signature header', () => {
    const body = Buffer.from('hello world');
    expect(verifyWebhookSignature(body, '', 'secret')).toBe(false);
  });
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────
describe('sanitizeFilename', () => {
  const { sanitizeFilename } = require('../sanitizeFilename');

  it('strips path traversal characters', () => {
    expect(sanitizeFilename('../etc/passwd')).not.toContain('/');
    expect(sanitizeFilename('../etc/passwd')).not.toContain('\\');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('my file.pdf')).toBe('my_file.pdf');
  });

  it('strips leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden');
    expect(sanitizeFilename('...dotfile')).toBe('dotfile');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeFilename('a__b___c')).toBe('a_b_c');
  });

  it('truncates to 255 characters', () => {
    expect(sanitizeFilename('a'.repeat(300)).length).toBeLessThanOrEqual(255);
  });

  it('returns "attachment" for empty string', () => {
    expect(sanitizeFilename('')).toBe('attachment');
  });

  it('returns "attachment" for null', () => {
    expect(sanitizeFilename(null)).toBe('attachment');
  });

  it('returns "attachment" for non-string input', () => {
    expect(sanitizeFilename(42)).toBe('attachment');
  });
});

// ─── htmlSanitizer ───────────────────────────────────────────────────────────
describe('sanitize', () => {
  let sanitize;
  beforeAll(() => {
    sanitize = require('../htmlSanitizer').sanitize;
  });

  it('removes <script> tags', () => {
    const out = sanitize('<p>Hello</p><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
  });

  it('removes <iframe> tags', () => {
    const out = sanitize('<iframe src="evil.com"></iframe><p>safe</p>');
    expect(out).not.toMatch(/<iframe/i);
  });

  it('removes <object> tags', () => {
    const out = sanitize('<object data="evil.swf"></object>');
    expect(out).not.toMatch(/<object/i);
  });

  it('removes <embed> tags', () => {
    const out = sanitize('<embed src="evil.swf">');
    expect(out).not.toMatch(/<embed/i);
  });

  it('strips on* event handler attributes', () => {
    const out = sanitize('<p onclick="evil()">click me</p>');
    expect(out).not.toContain('onclick');
  });

  it('preserves safe tags like <p> and <a>', () => {
    const out = sanitize('<p>Hello <a href="https://example.com">link</a></p>');
    expect(out).toContain('<p>');
    expect(out).toContain('<a');
  });

  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(sanitize(null)).toBe('');
  });
});

// ─── templateRenderer ────────────────────────────────────────────────────────
describe('renderTemplate', () => {
  const { renderTemplate } = require('../templateRenderer');
  const { NotFoundError } = require('../errors');

  it('renders contact-notification with all variables substituted', () => {
    const out = renderTemplate('contact-notification', {
      name: 'Alice',
      email: 'alice@example.com',
      message: 'Hello there',
      receivedAt: '2024-01-01T00:00:00Z',
    });
    expect(out).toContain('Alice');
    expect(out).toContain('alice@example.com');
    expect(out).toContain('Hello there');
    expect(out).not.toContain('{{name}}');
    expect(out).not.toContain('{{email}}');
    expect(out).not.toContain('{{message}}');
    expect(out).not.toContain('{{receivedAt}}');
  });

  it('renders contact-confirmation with name and message', () => {
    const out = renderTemplate('contact-confirmation', {
      name: 'Bob',
      message: 'Test message',
    });
    expect(out).toContain('Bob');
    expect(out).toContain('Test message');
    expect(out).not.toContain('{{name}}');
    expect(out).not.toContain('{{message}}');
  });

  it('renders reply template with body', () => {
    const out = renderTemplate('reply', { body: 'Here is my reply.' });
    expect(out).toContain('Here is my reply.');
    expect(out).not.toContain('{{body}}');
  });

  it('handles null/undefined variable values gracefully', () => {
    const out = renderTemplate('reply', { body: null });
    expect(out).not.toContain('{{body}}');
  });

  it('throws NotFoundError for a missing template', () => {
    expect(() => renderTemplate('nonexistent', {})).toThrow(NotFoundError);
  });
});
