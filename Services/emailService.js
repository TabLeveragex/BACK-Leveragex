const nodemailer = require('nodemailer');

function normalizeEnvValue(value) {
  let v = String(value || '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function normalizeSmtpPass(pass) {
  return normalizeEnvValue(pass).replace(/\s+/g, '');
}

function getSmtpUser() {
  return normalizeEnvValue(process.env.SMTP_USER).toLowerCase();
}

function getSmtpPass() {
  const primary = normalizeSmtpPass(process.env.SMTP_PASS);
  if (primary) {
    return primary;
  }
  return normalizeSmtpPass(process.env.SMTP_PASSWORD);
}

function isEmailConfigured() {
  return Boolean(getSmtpUser() && getSmtpPass());
}

function describeTransportOptions(options) {
  if (options.service) {
    return `service=${options.service}`;
  }
  return `host=${options.host} port=${options.port} secure=${options.secure}`;
}

function getCustomHostTransportOptions(user, pass) {
  const host = normalizeEnvValue(process.env.SMTP_HOST);
  if (!host) {
    return [];
  }

  return [
    withSmtpTimeouts({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user, pass },
    }),
  ];
}

function withSmtpTimeouts(options) {
  return {
    ...options,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 20000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000),
  };
}

function getGmailTransportOptions(user, pass) {
  return [
    withSmtpTimeouts({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
    }),
    withSmtpTimeouts({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    }),
    withSmtpTimeouts({
      service: 'gmail',
      auth: { user, pass },
    }),
  ];
}

function getTransportOptionsList(user, pass) {
  const custom = getCustomHostTransportOptions(user, pass);
  if (custom.length) {
    return custom;
  }

  const service = normalizeEnvValue(process.env.SMTP_SERVICE).toLowerCase() || 'gmail';
  if (service === 'gmail') {
    return getGmailTransportOptions(user, pass);
  }

  return [withSmtpTimeouts({ service, auth: { user, pass } })];
}

function buildFromAddress() {
  const smtpUser = getSmtpUser();
  const fromEnv = normalizeEnvValue(process.env.EMAIL_FROM).toLowerCase();
  const fromEmail = fromEnv || smtpUser;
  if (!fromEmail) {
    return '';
  }
  if (fromEmail !== smtpUser && smtpUser) {
    console.warn(
      `[Email] EMAIL_FROM (${fromEmail}) differs from SMTP_USER (${smtpUser}); using SMTP_USER as From for Gmail compatibility.`
    );
    return smtpUser;
  }
  return fromEmail;
}

async function verifyTransport(options) {
  const transporter = nodemailer.createTransport(options);
  await transporter.verify();
}

async function sendWithFallbackTransports(mailOptions) {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const transports = getTransportOptionsList(user, pass);
  let lastError = null;

  for (const options of transports) {
    const label = describeTransportOptions(options);
    const transporter = nodemailer.createTransport(options);
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email] Sent via ${label} to ${mailOptions.to}`);
      return { ok: true, messageId: info.messageId, transport: label };
    } catch (error) {
      lastError = error;
      console.error(
        `[Email] Send failed via ${label}: ${error.message}` +
          (error.responseCode ? ` (code ${error.responseCode})` : '')
      );
    }
  }

  return {
    ok: false,
    error: lastError?.message || 'All SMTP transports failed',
    responseCode: lastError?.responseCode,
  };
}

async function verifySmtpOnStartup() {
  if (!isEmailConfigured()) {
    return;
  }

  const user = getSmtpUser();
  const pass = getSmtpPass();
  const transports = getTransportOptionsList(user, pass);
  let verified = false;

  for (const options of transports) {
    const label = describeTransportOptions(options);
    try {
      await verifyTransport(options);
      console.log(`[Email] SMTP verified via ${label} for ${user}`);
      verified = true;
      break;
    } catch (error) {
      console.error(
        `[Email] SMTP verify failed via ${label}: ${error.message}` +
          (error.responseCode ? ` (code ${error.responseCode})` : '')
      );
    }
  }

  if (!verified) {
    console.error(
      '[Email] Gmail SMTP could not be verified. Regenerate App Password, set SMTP_PASS on Render, then visit https://accounts.google.com/DisplayUnlockCaptcha while logged into the Gmail account.'
    );
  }
}

/**
 * Send an email via SMTP (Gmail app password or custom SMTP).
 */
async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    const msg = 'SMTP_USER / SMTP_PASS are required but not set';
    console.error('[Email]', msg);
    return { ok: false, skipped: true, error: msg };
  }

  const from = buildFromAddress();
  const toAddress = String(to || '').trim().toLowerCase();
  if (!from) {
    const msg = 'SMTP_USER is missing or invalid';
    console.error('[Email]', msg);
    return { ok: false, error: msg };
  }
  if (!toAddress) {
    const msg = 'Recipient email is missing';
    console.error('[Email]', msg);
    return { ok: false, error: msg };
  }

  const result = await sendWithFallbackTransports({
    from,
    to: toAddress,
    subject,
    text,
    html,
  });

  if (result.ok) {
    return { ok: true, messageId: result.messageId };
  }

  return {
    ok: false,
    error: result.error,
    responseCode: result.responseCode,
  };
}

async function sendWelcomeEmail({ email, fullName }) {
  const name = String(fullName || 'Trader').trim();
  return sendEmail({
    to: email,
    subject: 'Welcome to LeverageX',
    text: ` Dear ${name},

Thank you for choosing Leveragex (leveragex.shop) for your Forex trading and investing needs!


We're excited to have you onboard and look forward to helping you navigate the markets. Our team is dedicated to providing top-notch services and support to ensure your success.


To get started, please find below some helpful resources:


- Our Website: leveragex (for market updates, tutorials, and more)
- Support Email: leveragexfund@gmail.com (for any questions or concerns)


Next Steps:


1. Verify your account (if you haven't already)
2. Explore our trading platforms and tools
3. Reach out to our support team for personalized guidance


We're committed to helping you achieve your financial goals. Stay updated on market trends and analysis through our regular newsletters and updates.


Best regards,
Suresh Sharma 
Leveragex Team
leveragexfund@gmail.com`,
  });
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

module.exports = {
  isEmailConfigured,
  verifySmtpOnStartup,
  sendEmail,
  sendWelcomeEmail,
  sendAdminOtpEmail,
};
