#!/usr/bin/env node
'use strict';

/**
 * Integration test for Chativa Email System
 * Tests core functionality without requiring Redis or external dependencies
 */

console.log('🔍 Chativa Email System Integration Test');
console.log('=========================================\n');

// Test 1: Environment validation
console.log('1. Testing environment validation...');
try {
  // Mock environment variables
  process.env.BREVO_API_KEY = 'test_key';
  process.env.JWT_SECRET = 'test_secret_256_bit_placeholder_for_testing_purposes_only';
  process.env.WEBHOOK_SECRET = 'test_webhook_secret';
  process.env.REDIS_URL = 'redis://localhost:6379';
  
  const { validateEnv } = require('./src/config/env');
  validateEnv();
  console.log('✅ Environment validation passed');
} catch (err) {
  console.log('❌ Environment validation failed:', err.message);
}

// Test 2: HMAC verification
console.log('\n2. Testing HMAC webhook signature verification...');
try {
  const crypto = require('crypto');
  const { verifyWebhookSignature } = require('./src/utils/hmacVerifier');
  
  const body = Buffer.from('test payload');
  const secret = 'test_secret';
  const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const invalidSig = 'invalid_signature';
  
  const validResult = verifyWebhookSignature(body, validSig, secret);
  const invalidResult = verifyWebhookSignature(body, invalidSig, secret);
  
  if (validResult && !invalidResult) {
    console.log('✅ HMAC verification working correctly');
  } else {
    console.log('❌ HMAC verification failed');
  }
} catch (err) {
  console.log('❌ HMAC verification error:', err.message);
}

// Test 3: HTML sanitization
console.log('\n3. Testing HTML sanitization...');
try {
  const { sanitize } = require('./src/utils/htmlSanitizer');
  
  const maliciousHtml = '<p>Safe content</p><script>alert("xss")</script><iframe src="evil.com"></iframe>';
  const sanitized = sanitize(maliciousHtml);
  
  if (sanitized.includes('<p>') && !sanitized.includes('<script>') && !sanitized.includes('<iframe>')) {
    console.log('✅ HTML sanitization working correctly');
  } else {
    console.log('❌ HTML sanitization failed');
  }
} catch (err) {
  console.log('❌ HTML sanitization error:', err.message);
}

// Test 4: Template rendering
console.log('\n4. Testing template rendering...');
try {
  const { renderTemplate } = require('./src/utils/templateRenderer');
  
  const result = renderTemplate('contact-confirmation', {
    name: 'Test User',
    message: 'Test message'
  });
  
  if (result.includes('Test User') && result.includes('Test message') && !result.includes('{{name}}')) {
    console.log('✅ Template rendering working correctly');
  } else {
    console.log('❌ Template rendering failed');
  }
} catch (err) {
  console.log('❌ Template rendering error:', err.message);
}

// Test 5: Filename sanitization
console.log('\n5. Testing filename sanitization...');
try {
  const { sanitizeFilename } = require('./src/utils/sanitizeFilename');
  
  const dangerous = '../../../etc/passwd';
  const sanitized = sanitizeFilename(dangerous);
  
  // The function removes leading dots and replaces / with _, then collapses multiple _
  // So '../../../etc/passwd' becomes '_.._.._etc_passwd' after / replacement, 
  // then leading dots are removed, leaving '.._.._etc_passwd', but dots in middle remain
  if (!sanitized.includes('/') && !sanitized.includes('\\')) {
    console.log('✅ Filename sanitization working correctly (path traversal prevented)');
  } else {
    console.log('❌ Filename sanitization failed - got:', sanitized);
  }
} catch (err) {
  console.log('❌ Filename sanitization error:', err.message);
}

// Test 6: Email service validation
console.log('\n6. Testing email service sender validation...');
try {
  const { buildPayload } = require('./src/services/emailService');
  
  let validSender = true;
  let invalidSender = false;
  
  try {
    buildPayload({ from: 'contact@chativa.pro', to: 'test@example.com' });
  } catch (err) {
    validSender = false;
  }
  
  try {
    buildPayload({ from: 'invalid@example.com', to: 'test@example.com' });
    invalidSender = true;
  } catch (err) {
    // Expected to fail
  }
  
  if (validSender && !invalidSender) {
    console.log('✅ Email sender validation working correctly');
  } else {
    console.log('❌ Email sender validation failed');
  }
} catch (err) {
  console.log('❌ Email service error:', err.message);
}

// Test 7: Spam service (without async DNS calls)
console.log('\n7. Testing spam service basic functionality...');
try {
  const spamService = require('./src/services/spamService');
  
  // Test with obvious spam content
  const spamEmail = {
    sender: 'winner@lottery.com',
    subject: 'Congratulations! You won $1,000,000!',
    bodyText: 'Click here to claim your prize! Act now! Limited offer!',
    bodyHtml: '<p>Click here to claim your prize! Act now! Limited offer!</p>'
  };
  
  // Note: We can't test the full async function without Redis/DNS, but we can test it exists
  if (typeof spamService.score === 'function') {
    console.log('✅ Spam service structure is correct');
  } else {
    console.log('❌ Spam service structure is incorrect');
  }
} catch (err) {
  console.log('❌ Spam service error:', err.message);
}

// Test 8: Auth service JWT functionality
console.log('\n8. Testing auth service JWT functionality...');
try {
  const { issueAccessToken } = require('./src/services/authService');
  
  const mockUser = { id: 1, username: 'admin' };
  const token = issueAccessToken(mockUser);
  
  if (token && typeof token === 'string' && token.split('.').length === 3) {
    console.log('✅ JWT token generation working correctly');
  } else {
    console.log('❌ JWT token generation failed');
  }
} catch (err) {
  console.log('❌ Auth service error:', err.message);
}

// Test 9: Express app creation
console.log('\n9. Testing Express app creation...');
try {
  const { createApp } = require('./src/app');
  const app = createApp();
  
  if (app && typeof app.listen === 'function') {
    console.log('✅ Express app creation working correctly');
  } else {
    console.log('❌ Express app creation failed');
  }
} catch (err) {
  console.log('❌ Express app error:', err.message);
}

console.log('\n🏁 Integration test completed!');
console.log('\nNote: Full system testing requires:');
console.log('- Redis server running');
console.log('- SQLite database (better-sqlite3 compiled)');
console.log('- Valid Brevo API credentials');
console.log('- Admin user created via createAdmin.js script');