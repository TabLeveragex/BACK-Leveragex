const User = require('../Models/userModel');
const Balance = require('../Models/BalanceHistory');
const Congrats = require('../Models/congrats');
const PnL = require('../Models/pnLModel');
const UserDeletionAudit = require('../Models/UserDeletionAudit');

// disabled = no deletes (default, safest — users stay in MongoDB forever)
// soft = mark isDeleted, document remains in users collection
// hard = permanently remove document (only if you explicitly set this on Render)
const USER_DELETE_MODE = String(process.env.USER_DELETE_MODE || 'disabled').toLowerCase();

function isUserDeletionAllowed() {
  return USER_DELETE_MODE === 'soft' || USER_DELETE_MODE === 'hard';
}

async function logUserDeletion(user, audit = {}) {
  const entry = {
    deletedUserId: String(user._id),
    deletedEmail: user.email || '',
    deletedMobile: user.mobile || '',
    source: audit.source || 'unknown',
    actorAdminId: audit.actorAdminId ? String(audit.actorAdminId) : null,
    actorAdminEmail: audit.actorAdminEmail || null,
    ipAddress: audit.ipAddress || '',
    userAgent: audit.userAgent || '',
  };

  try {
    await UserDeletionAudit.create({
      ...entry,
      deleteMode: USER_DELETE_MODE,
    });
  } catch (error) {
    console.error('Failed to write user deletion audit:', error);
  }

  console.warn(
    `[USER ${USER_DELETE_MODE.toUpperCase()} DELETE] id=${entry.deletedUserId} email=${entry.deletedEmail} ` +
      `source=${entry.source} admin=${entry.actorAdminEmail || 'n/a'} ip=${entry.ipAddress}`
  );
}

async function deleteUserCompletely(userId, audit = {}) {
  if (!isUserDeletionAllowed()) {
    const error = new Error(
      'User deletion is disabled. Users are kept in MongoDB. Set USER_DELETE_MODE=soft on Render only if you need deactivate.'
    );
    error.code = 'USER_DELETE_DISABLED';
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    return { found: false };
  }

  await logUserDeletion(user, audit);

  if (USER_DELETE_MODE === 'hard') {
    await Promise.all([
      Balance.deleteMany({ userId: user._id }),
      Congrats.deleteMany({ $or: [{ userId: user._id }, { Pancard: user.pan }] }),
      PnL.deleteMany({ userId: user._id }),
    ]);
    await User.findByIdAndDelete(userId);
    return { found: true, email: user.email, mode: 'hard' };
  }

  // soft — document stays in MongoDB
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletionReason = audit.source || 'unknown';
  user.balance = 0;
  user.stocks = [];
  user.isLiquidated = true;
  await user.save();

  return { found: true, email: user.email, mode: 'soft' };
}

module.exports = {
  deleteUserCompletely,
  logUserDeletion,
  isUserDeletionAllowed,
  USER_DELETE_MODE,
};
