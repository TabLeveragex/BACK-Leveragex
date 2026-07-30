const { isIpBlocked, getRequestIp } = require('../Services/ipBlocklistService');

function blockListedIps(req, res, next) {
  const ip = getRequestIp(req);
  if (isIpBlocked(ip)) {
    console.warn('[IPBlock] Blocked registration attempt from', ip || 'unknown');
    return res.status(403).json({
      message: 'Registration from your network is not allowed.',
      success: false,
    });
  }
  next();
}

module.exports = { blockListedIps };
