const mongoose = require('mongoose');

const adminOtpChallengeSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  challengeToken: { type: String, required: true, unique: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});

adminOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminOtpChallenge', adminOtpChallengeSchema);
