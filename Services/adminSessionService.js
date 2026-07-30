const crypto = require('crypto');
const AdminActiveSession = require('../Models/AdminActiveSession');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

async function getActiveAdminSession() {
  const doc = await AdminActiveSession.findOne({ singletonKey: 'global' });
  if (!doc) {
    return null;
  }
  if (doc.expiresAt < new Date()) {
    await AdminActiveSession.deleteOne({ _id: doc._id });
    return null;
  }
  return doc;
}

async function hasActiveAdminSession() {
  return Boolean(await getActiveAdminSession());
}

async function registerAdminSession(adminId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

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

async function clearAdminSessionById(sessionId) {
  const active = await getActiveAdminSession();
  if (!active || active.sessionId !== String(sessionId || '')) {
    return false;
  }
  await AdminActiveSession.deleteOne({ _id: active._id });
  return true;
}

module.exports = {
  getActiveAdminSession,
  hasActiveAdminSession,
  registerAdminSession,
  isAdminSessionValid,
  clearAdminSessionById,
};
