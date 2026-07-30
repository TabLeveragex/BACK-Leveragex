/**
 * Removes the global admin lock so a new admin can log in.
 * Usage: node scripts/clear-admin-active-session.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  const mongoUrl = process.env.MONGO_CONN;
  if (!mongoUrl) {
    console.error('MONGO_CONN is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const result = await mongoose.connection.db
    .collection('adminactivesessions')
    .deleteMany({ singletonKey: 'global' });

  console.log(`Deleted ${result.deletedCount} active admin session record(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
