const crypto = require('crypto');
const bcrypt = require('bcrypt');
const AdminOtpChallenge = require('../Models/AdminOtpChallenge');

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function createAdminOtpChallenge(adminId) {
  await AdminOtpChallenge.deleteMany({ adminId });

  const challengeToken = crypto.randomBytes(32).toString('hex');
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await AdminOtpChallenge.create({
    challengeToken,
    adminId,
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
  if (!doc || doc.expiresAt < new Date()) {
    if (doc) {
      await AdminOtpChallenge.deleteOne({ _id: doc._id });
    }
    return null;
  }

  const match = await bcrypt.compare(code, doc.otpHash);
  if (!match) {
    return null;
  }

  await AdminOtpChallenge.deleteOne({ _id: doc._id });
  return doc.adminId;
}

module.exports = {
  createAdminOtpChallenge,
  verifyAdminOtpChallenge,
};
