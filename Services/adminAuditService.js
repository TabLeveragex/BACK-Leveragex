const AdminLoginLog = require('../Models/AdminLoginLog');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

async function logAdminLoginAttempt(req, {
  loginId = '',
  success,
  stage = '',
  otpSentTo = '',
  failureReason = null,
  traderSessionWasActive = false,
}) {
  const entry = {
    loginId: String(loginId || '').trim().toLowerCase(),
    success: Boolean(success),
    stage: String(stage || '').trim(),
    otpSentTo: String(otpSentTo || '').trim().toLowerCase(),
    failureReason,
    traderSessionWasActive: Boolean(traderSessionWasActive),
    ipAddress: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  };

  try {
    await AdminLoginLog.create(entry);
  } catch (error) {
    console.error('Failed to persist admin login audit log:', error);
  }

  const statusLabel = success ? 'SUCCESS' : 'FAILED';
  console.log(
    `[AdminLoginAudit] ${statusLabel} stage=${entry.stage || 'none'} loginId=${entry.loginId || 'unknown'} ` +
      `traderSessionWasActive=${entry.traderSessionWasActive} ip=${entry.ipAddress}` +
      (entry.otpSentTo ? ` otpSentTo=${entry.otpSentTo}` : '') +
      (failureReason ? ` reason=${failureReason}` : '')
  );

  return entry;
}

module.exports = {
  getClientIp,
  logAdminLoginAttempt,
};
