const Admin = require('../Models/adminModel');

/**
 * Keep admin login email aligned with ADMIN_EMAIL on Render when env is a real address.
 */
async function syncAdminEmailFromEnv() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();

  if (!email) {
    return { updated: false };
  }

  const admin = await Admin.findOne({
    $or: [{ username }, { email }],
  });

  if (!admin) {
    return { updated: false, reason: 'no_admin' };
  }

  if (admin.email === email) {
    return { updated: false, reason: 'already_synced' };
  }

  const conflict = await Admin.findOne({ email, _id: { $ne: admin._id } });
  if (conflict) {
    console.warn(
      `[Admin] ADMIN_EMAIL ${email} belongs to another admin — skipping email sync`
    );
    return { updated: false, reason: 'email_conflict' };
  }

  admin.email = email;
  await admin.save();
  console.log(`[Admin] Synced admin email to ADMIN_EMAIL: ${email}`);
  return { updated: true, email };
}

module.exports = {
  syncAdminEmailFromEnv,
};
