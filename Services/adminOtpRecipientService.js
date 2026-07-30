const UNDELIVERABLE_DOMAINS = new Set([
  'leveragex.com',
  'example.com',
  'leveragex.in',
  'localhost',
  'test.com',
]);

function emailDomain(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) {
    return '';
  }
  return normalized.slice(at + 1);
}

function isDeliverableEmail(email) {
  const domain = emailDomain(email);
  return domain && !UNDELIVERABLE_DOMAINS.has(domain);
}

/**
 * OTP must reach a real inbox. Placeholder admin emails fall back to ADMIN_EMAIL or SMTP_USER.
 */
function getAdminOtpRecipientEmail(admin) {
  const adminEmail = String(admin?.email || '').trim().toLowerCase();
  const smtpUser = String(process.env.SMTP_USER || '').trim().toLowerCase();
  const envAdmin = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (isDeliverableEmail(adminEmail)) {
    return adminEmail;
  }

  if (isDeliverableEmail(envAdmin)) {
    console.warn(
      `[Email] Admin OTP recipient fallback: ${envAdmin} (admin record has ${adminEmail || 'no email'})`
    );
    return envAdmin;
  }

  if (smtpUser) {
    console.warn(
      `[Email] Admin OTP recipient fallback: ${smtpUser} (admin record has ${adminEmail || 'no email'})`
    );
    return smtpUser;
  }

  return adminEmail;
}

module.exports = {
  getAdminOtpRecipientEmail,
  isDeliverableEmail,
};
