const mongoose = require('mongoose');

const UserDeletionAuditSchema = new mongoose.Schema(
  {
    deletedUserId: { type: String, required: true },
    deletedEmail: { type: String, default: '' },
    deletedMobile: { type: String, default: '' },
    source: {
      type: String,
      enum: ['admin_api', 'self_delete', 'unknown'],
      default: 'unknown',
    },
    actorAdminId: { type: String, default: null },
    actorAdminEmail: { type: String, default: null },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    deleteMode: { type: String, default: 'disabled' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.UserDeletionAudit ||
  mongoose.model('UserDeletionAudit', UserDeletionAuditSchema);
