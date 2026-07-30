// Run the backend against a throwaway in-memory MongoDB — no Atlas needed.
// Data resets on every restart. For persistent data, create a .env with your
// real MONGO_CONN and use `npm start` instead.
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGO_CONN = mongod.getUri('leveragex');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-dev-only-secret-key-1234567890abcd';
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@leveragex.com';
  process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  process.env.ADMIN_NAME = process.env.ADMIN_NAME || 'LeverageX Admin';

  console.log('[dev-local] In-memory MongoDB:', process.env.MONGO_CONN);
  console.log('[dev-local] Admin login: admin@leveragex.com / admin123');
  console.log('[dev-local] Data is wiped when this process stops.');

  require('../index.js');
}

main().catch((err) => {
  console.error('[dev-local] Failed to start:', err);
  process.exit(1);
});
