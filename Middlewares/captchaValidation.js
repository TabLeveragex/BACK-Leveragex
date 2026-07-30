const { verifyHcaptchaToken, clientIp } = require('../Services/captchaService');

function extractCaptchaToken(body) {
  return (
    body?.hcaptchaToken ||
    body?.recaptchaToken ||
    body?.captchaToken ||
    ''
  );
}

function stripCaptchaFields(body) {
  if (!body || typeof body !== 'object') {
    return;
  }
  delete body.hcaptchaToken;
  delete body.recaptchaToken;
  delete body.captchaToken;
}

async function verifyCaptcha(req, res, next) {
  try {
    const hcaptchaToken = extractCaptchaToken(req.body);
    const result = await verifyHcaptchaToken(hcaptchaToken, clientIp(req));
    if (!result.ok) {
      return res.status(403).json({ message: result.message, success: false });
    }

    req.captchaVerified = true;
    stripCaptchaFields(req.body);
    next();
  } catch (error) {
    console.error('Captcha verification error:', error);
    return res.status(500).json({
      message: 'Verification could not be completed. Please try again.',
      success: false,
    });
  }
}

function requireCaptchaVerified(req, res, next) {
  if (!req.captchaVerified) {
    return res.status(403).json({
      message: 'Captcha verification is required for registration.',
      success: false,
    });
  }
  next();
}

module.exports = { verifyCaptcha, requireCaptchaVerified };
