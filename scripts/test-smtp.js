/**
 * Test Gmail SMTP from your machine (uses .env in project root).
 * Usage: node scripts/test-smtp.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sendEmail, verifySmtpOnStartup } = require('../Services/emailService');

async function main() {
  const user = process.env.SMTP_USER;
  if (!user) {
    console.error('Set SMTP_USER and SMTP_PASS in .env first.');
    process.exit(1);
  }

  await verifySmtpOnStartup();

  const to = process.env.ADMIN_EMAIL || user;
  const result = await sendEmail({
    to,
    subject: 'LeverageX SMTP test',
    text: 'If you received this, SMTP is working.',
  });

  if (result.ok) {
    console.log('SUCCESS — test email sent to', to);
    process.exit(0);
  }

  console.error('FAILED —', result.error);
  if (result.responseCode) {
    console.error('Response code:', result.responseCode);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
