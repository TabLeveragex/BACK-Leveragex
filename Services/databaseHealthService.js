const User = require('../Models/userModel');

async function getDatabaseHealth(mongooseConnection) {
  const db = mongooseConnection.db;
  const dbName = mongooseConnection.name;

  let userCount = 0;
  let activeUserCount = 0;
  let deletedUserCount = 0;
  let ttlIndexes = [];
  let collections = [];

  if (db) {
    const colList = await db.listCollections().toArray();
    collections = colList.map((c) => c.name).sort();

    if (collections.includes('users')) {
      userCount = await db.collection('users').countDocuments();
      activeUserCount = await db.collection('users').countDocuments({
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      });
      deletedUserCount = await db.collection('users').countDocuments({ isDeleted: true });
      const indexes = await db.collection('users').indexes();
      ttlIndexes = indexes.filter((idx) => idx.expireAfterSeconds != null);
    }
  }

  const warnings = [];
  if (ttlIndexes.length > 0) {
    warnings.push('TTL index on users collection will AUTO-DELETE documents. Remove it in Atlas.');
  }
  if (userCount === 0 && collections.includes('users')) {
    warnings.push('users collection is empty — check correct database (leveragex) or deletion audit logs.');
  }

  return {
    database: dbName,
    userCount,
    activeUserCount,
    deletedUserCount,
    userDeleteMode: String(process.env.USER_DELETE_MODE || 'disabled'),
    collections,
    ttlIndexesOnUsers: ttlIndexes,
    warning: warnings.length ? warnings.join(' ') : null,
    warnings,
  };
}

async function logDatabaseHealthOnStartup(mongooseConnection) {
  try {
    const health = await getDatabaseHealth(mongooseConnection);
    console.log(
      `[DB Health] database=${health.database} users=${health.userCount} ` +
        `active=${health.activeUserCount} softDeleted=${health.deletedUserCount} ` +
        `deleteMode=${health.userDeleteMode} collections=${health.collections.length}`
    );
    if (health.warning) {
      console.error(`[DB Health] CRITICAL: ${health.warning}`, health.ttlIndexesOnUsers);
    }
    if (health.database !== 'leveragex') {
      console.warn(
        `[DB Health] Expected database "leveragex" but connected to "${health.database}". ` +
          'Users may appear missing if you browse the wrong database in Atlas.'
      );
    }
    return health;
  } catch (error) {
    console.error('[DB Health] Failed to read database stats:', error.message);
    return null;
  }
}

module.exports = {
  getDatabaseHealth,
  logDatabaseHealthOnStartup,
};
