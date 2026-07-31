const nodemailer = require('nodemailer');

function env(key) {
  return String(process.env[key] || '').trim();
}

function smtpPass() {
  return env('SMTP_PASS').replace(/\s+/g, '');
}

function isSmtpConfigured() {
  return Boolean(env('SMTP_USER') && smtpPass());
}

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: env('SMTP_USER').toLowerCase(),
      pass: smtpPass(),
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
}

function fromAddress() {
  const user = env('SMTP_USER').toLowerCase();
  const from = env('EMAIL_FROM').toLowerCase() || user;
  return from;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function verifySmtpOnStartup() {
  if (!isSmtpConfigured()) {
    console.error('[Email] SMTP_USER / SMTP_PASS missing — admin 2FA email will fail.');
    return false;
  }
  try {
    await createTransport().verify();
    console.log(`[Email] SMTP verified for ${env('SMTP_USER').toLowerCase()}`);
    return true;
  } catch (error) {
    console.error('[Email] SMTP verify failed:', error.message);
    return false;
  }
}

async function sendEmail({ to, subject, text, html }) {
  if (!isSmtpConfigured()) {
    return { ok: false, skipped: true, error: 'SMTP is not configured' };
  }

  const toAddress = String(to || '').trim().toLowerCase();
  const from = fromAddress();
  if (!toAddress) {
    return { ok: false, error: 'Recipient email is missing' };
  }

  try {
    const info = await createTransport().sendMail({
      from: `"LeverageX" <${from}>`,
      to: toAddress,
      subject,
      text,
      html: html || undefined,
    });
    console.log(`[Email] Sent to ${toAddress} id=${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Send failed:', error.message);
    return { ok: false, error: error.message, responseCode: error.responseCode };
  }
}

async function sendAdminOtpEmail({ email, fullName, otp }) {
  const name = String(fullName || 'Admin').trim();
  const code = String(otp || '').trim();
  return sendEmail({
    to: email,
    subject: 'LeverageX admin login code',
    text:
      `Hello ${name},\n\nYour admin login verification code is: ${code}\n\n` +
      `This code expires in 10 minutes. Do not share it with anyone.\n\n— LeverageX`,
  });
}

async function sendWelcomeEmail({ email, fullName }) {
  const name = String(fullName || 'Trader').trim() || 'Trader';
  const safeName = escapeHtml(name);
  const site = 'https://leveragex.shop';
  const support = fromAddress() || 'leveragexfund@gmail.com';

  const text =
    `Dear ${name},\n\n` +
    `Welcome to LeverageX!\n\n` +
    `Thank you for joining us. Your account is ready — you can sign in and explore plans, watchlists, and your trading dashboard.\n\n` +
    `Website: ${site}\n` +
    `Support: ${support}\n\n` +
    `Best regards,\n` +
    `The LeverageX Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to LeverageX</title>
</head>
<body style="margin:0;padding:0;background:#f3faf7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3faf7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #d1fae5;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,185,129,0.08);">
          <tr>
            <td style="padding:28px 28px 16px;background:linear-gradient(135deg,#10b981,#06b6d4);">
              <p style="margin:0;color:#ecfdf5;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">LeverageX</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:26px;line-height:1.25;font-weight:700;">Welcome aboard, ${safeName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;background:#ffffff;">
              <p style="margin:0 0 14px;color:#0f172a;font-size:15px;line-height:1.6;">
                Thanks for creating your LeverageX account. You're all set to explore market plans, manage your watchlists, and track performance from your dashboard.
              </p>
              <p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.6;">
                Sign in anytime to get started. If you need help, our support team is ready.
              </p>
              <a href="${site}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">
                Open LeverageX
              </a>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;" />
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
                Website: <a href="${site}" style="color:#0d9488;text-decoration:none;">${site}</a><br />
                Support: <a href="mailto:${escapeHtml(support)}" style="color:#0d9488;text-decoration:none;">${escapeHtml(support)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;background:#ffffff;color:#94a3b8;font-size:11px;line-height:1.5;">
              You're receiving this because you signed up at LeverageX. If this wasn't you, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: email,
    subject: 'Welcome to LeverageX',
    text,
    html,
  });
}

module.exports = {
  isSmtpConfigured,
  verifySmtpOnStartup,
  sendEmail,
  sendAdminOtpEmail,
  sendWelcomeEmail,
};
