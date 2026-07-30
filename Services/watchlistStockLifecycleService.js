const User = require('../Models/userModel');

/**
 * When a watchlist stock is removed, drop it from every trader portfolio.
 * Prevents stale buy prices from mass-liquidating users when the same stock is re-added.
 */
async function removeStockFromAllUserPortfolios(stockName) {
  const normalized = String(stockName || '').trim();
  if (!normalized) {
    return { usersUpdated: 0, holdersBefore: 0 };
  }

  const holdersBefore = await User.countDocuments({
    'stocks.stockName': normalized,
  });

  if (holdersBefore === 0) {
    return { usersUpdated: 0, holdersBefore: 0 };
  }

  const result = await User.updateMany(
    { 'stocks.stockName': normalized },
    { $pull: { stocks: { stockName: normalized } } }
  );

  console.log(
    `[Watchlist] Removed "${normalized}" from ${result.modifiedCount} user portfolio(s) (holders before: ${holdersBefore})`
  );

  return {
    usersUpdated: result.modifiedCount,
    holdersBefore,
  };
}

module.exports = {
  removeStockFromAllUserPortfolios,
};
