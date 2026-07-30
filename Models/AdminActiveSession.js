const mongoose = require('mongoose');

const adminActiveSessionSchema = new mongoose.Schema({
  singletonKey: { type: String, default: 'global', unique: true },
  sessionId: { type: String, required: true, index: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  expiresAt: { type: Date, required: true, index: true },
});

module.exports =
  mongoose.models.AdminActiveSession ||
  mongoose.model('AdminActiveSession', adminActiveSessionSchema);
