const { clientIp } = require('../Services/captchaService');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 15;
const buckets = new Map();

function signupRateLimit(req, res, next) {
  const ip = clientIp(req) || 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return res.status(429).json({
      message: 'Too many signup attempts. Please try again later.',
      success: false,
    });
  }

  next();
}

module.exports = { signupRateLimit };
