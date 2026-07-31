const crypto = require('crypto');
const bcrypt = require('bcrypt');
const AdminOtpChallenge = require('../Models/AdminOtpChallenge');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, '0');
}

function generateChallengeToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createAdminOtpChallenge(adminId) {
  await AdminOtpChallenge.deleteMany({ adminId });

  const otp = generateOtp();
  const challengeToken = generateChallengeToken();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await AdminOtpChallenge.create({
    adminId,
    challengeToken,
    otpHash,
    expiresAt,
  });

  return { challengeToken, otp, expiresAt };
}

async function verifyAdminOtpChallenge(challengeToken, otp) {
  const token = String(challengeToken || '').trim();
  const code = String(otp || '').trim();
  if (!token || !/^\d{6}$/.test(code)) {
    return null;
  }

  const doc = await AdminOtpChallenge.findOne({ challengeToken: token });
  if (!doc) {
    return null;
  }

  if (doc.expiresAt.getTime() < Date.now()) {
    await AdminOtpChallenge.deleteOne({ _id: doc._id });
    return null;
  }

  if (doc.attempts >= MAX_ATTEMPTS) {
    await AdminOtpChallenge.deleteOne({ _id: doc._id });
    return null;
  }

  const matches = await bcrypt.compare(code, doc.otpHash);
  if (!matches) {
    doc.attempts += 1;
    await doc.save();
    return null;
  }

  const adminId = doc.adminId;
  await AdminOtpChallenge.deleteOne({ _id: doc._id });
  return adminId;
}

function getAdminOtpRecipientEmail() {
  return String(process.env.ADMIN_EMAIL || process.env.SMTP_USER || '')
    .trim()
    .toLowerCase();
}

module.exports = {
  createAdminOtpChallenge,
  verifyAdminOtpChallenge,
  getAdminOtpRecipientEmail,
  OTP_TTL_MS,
};
