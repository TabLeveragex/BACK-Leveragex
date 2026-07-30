// One-off: syncs the existing admin account's email + password to ADMIN_EMAIL /
// ADMIN_PASSWORD from .env (the seeder only creates, never updates).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../Models/adminModel');

(async () => {
  await mongoose.connect(process.env.MONGO_CONN);
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const pwd = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!email || !pwd) {
    console.error('ADMIN_EMAIL / ADMIN_PASSWORD missing in .env');
    process.exit(1);
  }
  const admin = await Admin.findOne({ $or: [{ email }, { username }] });
  if (!admin) {
    console.error('No admin account found to update');
    process.exit(1);
  }
  admin.email = email;
  admin.username = username;
  admin.password = await bcrypt.hash(pwd, 10);
  await admin.save();
  console.log('admin updated -> email:', admin.email, '| username:', admin.username);
  console.log('verify password match:', await bcrypt.compare(pwd, admin.password));
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
