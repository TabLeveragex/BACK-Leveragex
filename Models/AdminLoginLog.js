const mongoose = require('mongoose');

const AdminLoginLogSchema = new mongoose.Schema(
  {
    loginId: { type: String, default: '' },
    success: { type: Boolean, required: true },
    stage: { type: String, default: '' },
    otpSentTo: { type: String, default: '' },
    failureReason: { type: String, default: null },
    traderSessionWasActive: { type: Boolean, default: false },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

const AdminLoginLog =
  mongoose.models.AdminLoginLog ||
  mongoose.model('AdminLoginLog', AdminLoginLogSchema);

module.exports = AdminLoginLog;
