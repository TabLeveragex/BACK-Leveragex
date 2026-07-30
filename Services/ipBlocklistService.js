const { clientIp } = require('./captchaService');

// IPs hardcoded here are always blocked from registration.
const STATIC_BLOCKED_IPS = new Set([
  '95.177.87.34',
]);

function normalizeIp(ip) {
  let value = String(ip || '').trim().toLowerCase();
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:95.177.87.34)
  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }
  return value;
}

function getEnvBlockedIps() {
  return String(process.env.BLOCKED_SIGNUP_IPS || '')
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter(Boolean);
}

function getBlockedIps() {
  const set = new Set();
  for (const ip of STATIC_BLOCKED_IPS) {
    set.add(normalizeIp(ip));
  }
  for (const ip of getEnvBlockedIps()) {
    set.add(ip);
  }
  return set;
}

function isIpBlocked(ip) {
  return getBlockedIps().has(normalizeIp(ip));
}

function getRequestIp(req) {
  return normalizeIp(clientIp(req));
}

module.exports = {
  isIpBlocked,
  getRequestIp,
  getBlockedIps,
};
