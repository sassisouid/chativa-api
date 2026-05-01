/**
 * Disposable email domain list.
 *
 * Tries to load the 'disposable-email-domains' npm package and export it as a
 * Set. Falls back to a hardcoded Set of common disposable domains if the
 * package is not available (e.g. not yet installed in the environment).
 */

let disposableDomains;

try {
  // The package exports an array of domain strings
  const packageList = require('disposable-email-domains');
  disposableDomains = new Set(packageList);
} catch (_err) {
  // Fallback hardcoded list of well-known disposable email domains
  disposableDomains = new Set([
    'mailinator.com',
    'guerrillamail.com',
    'trashmail.com',
    'tempmail.com',
    'throwaway.email',
    'yopmail.com',
    'sharklasers.com',
    'guerrillamailblock.com',
    'grr.la',
    'guerrillamail.info',
    'spam4.me',
    '10minutemail.com',
    'dispostable.com',
    'mailnull.com',
    'spamgourmet.com',
    'trashmail.at',
    'trashmail.io',
    'fakeinbox.com',
    'maildrop.cc',
    'discard.email',
  ]);
}

module.exports = disposableDomains;
