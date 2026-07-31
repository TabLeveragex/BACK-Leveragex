/**
 * Basic legitimacy check for signup welcome mail.
 * Rejects empty/invalid formats and common disposable / fake patterns.
 * Does not block signup — only decides whether to attempt sending email.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'discard.email',
  'fakeinbox.com',
]);

function isLegitEmailAddress(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || value.length > 254) {
    return false;
  }

  // Simple RFC-ish email shape
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value)) {
    return false;
  }

  const [local, domain] = value.split('@');
  if (!local || !domain || local.length > 64) {
    return false;
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return false;
  }

  // Reject obvious junk locals
  if (/^(test|asdf|qwerty|xxx|abc|noreply|no-reply)$/i.test(local)) {
    return false;
  }

  return true;
}

module.exports = { isLegitEmailAddress };
