const mongoose = require('mongoose');

const adminOtpChallengeSchema = new mongoose.Schema({
  challengeToken: { type: String, required: true, unique: true, index: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

adminOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminOtpChallenge', adminOtpChallengeSchema);
