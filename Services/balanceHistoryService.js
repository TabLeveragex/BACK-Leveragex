const Balance = require('../Models/BalanceHistory');
const User = require('../Models/userModel');

async function backfillBalanceUserIds() {
  const legacyRecords = await Balance.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
    email: { $exists: true, $ne: null },
  }).lean();

  if (!legacyRecords.length) {
    return { updated: 0 };
  }

  let updated = 0;

  for (const record of legacyRecords) {
    const user = await User.findOne({ email: record.email });

    if (!user) continue;

    await Balance.updateOne(
      { _id: record._id },
      {
        $set: { userId: user._id },
        $unset: { email: 1 },
      }
    );

    updated++;
  }

  return { updated };
}

module.exports = { backfillBalanceUserIds };