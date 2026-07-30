const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify';

function getHcaptchaSecret() {
  return String(process.env.HCAPTCHA_SECRET_KEY || '').trim();
}

function getHcaptchaSiteKey() {
  return String(process.env.HCAPTCHA_SITE_KEY || '').trim();
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

async function verifyHcaptchaToken(token, remoteIp) {
  const responseToken = String(token || '').trim();
  if (!responseToken) {
    return { ok: false, message: 'Please complete the captcha verification' };
  }

  if (responseToken.length < 20 || responseToken.length > 4096) {
    return { ok: false, message: 'Invalid captcha token. Please try again.' };
  }

  const secret = getHcaptchaSecret();
  if (!secret) {
    console.error('HCAPTCHA_SECRET_KEY is not set');
    return {
      ok: false,
      message: 'Captcha is not configured on the server. Contact support.',
    };
  }

  const sitekey = getHcaptchaSiteKey();
  const payload = {
    secret,
    response: responseToken,
    remoteip: remoteIp || '',
  };
  if (sitekey) {
    payload.sitekey = sitekey;
  }

  const params = new URLSearchParams(payload);

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      return { ok: false, message: 'Captcha verification failed. Please try again.' };
    }

    const data = await response.json();
    if (!data.success) {
      const codes = (data['error-codes'] || []).join(', ');
      console.warn('hCaptcha rejected:', codes);
      return {
        ok: false,
        message: 'Captcha verification failed. Please complete the challenge and try again.',
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('hCaptcha verify error:', error);
    return { ok: false, message: 'Captcha verification failed. Please try again.' };
  }
}

module.exports = {
  verifyHcaptchaToken,
  clientIp,
};
