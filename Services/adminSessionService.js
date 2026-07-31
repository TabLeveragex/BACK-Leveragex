const crypto = require('crypto');
const AdminActiveSession = require('../Models/AdminActiveSession');

/**
 * Single global admin lock.
 * Stays until the document is deleted from MongoDB (adminactivesessions).
 * Logout / JWT expiry do NOT free the slot.
 */
async function getActiveAdminSession() {
  return AdminActiveSession.findOne({ singletonKey: 'global' });
}

async function hasActiveAdminSession() {
  return Boolean(await getActiveAdminSession());
}

async function registerAdminSession(adminId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  // kept for audit only — not used to auto-expire the lock
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await AdminActiveSession.findOneAndUpdate(
    { singletonKey: 'global' },
    { sessionId, adminId, expiresAt },
    { upsert: true, new: true }
  );

  return { sessionId, expiresAt };
}

async function isAdminSessionValid(adminId, sessionId) {
  const active = await getActiveAdminSession();
  if (!active) {
    return false;
  }
  return (
    String(active.adminId) === String(adminId) &&
    String(active.sessionId) === String(sessionId || '')
  );
}

/** Manual unlock only (e.g. script / MongoDB delete). Not used on logout. */
async function clearAdminSessionById(sessionId) {
  const active = await getActiveAdminSession();
  if (!active || active.sessionId !== String(sessionId || '')) {
    return false;
  }
  await AdminActiveSession.deleteOne({ _id: active._id });
  return true;
}

async function clearGlobalAdminSession() {
  const result = await AdminActiveSession.deleteMany({ singletonKey: 'global' });
  return result.deletedCount || 0;
}

module.exports = {
  getActiveAdminSession,
  hasActiveAdminSession,
  registerAdminSession,
  isAdminSessionValid,
  clearAdminSessionById,
  clearGlobalAdminSession,
};
