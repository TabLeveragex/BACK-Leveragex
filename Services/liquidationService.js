const User = require('../Models/userModel');
const { ACTIVE_USER_FILTER } = require('../utils/userQuery');

const LIQUIDATION_DROP = 0.1;

async function liquidateUserAccount(user) {
  user.balance = 0;
  user.stocks = [];
  user.isLiquidated = true;
  await user.save();
}

function clearLiquidationIfFunded(user) {
  if (!user || !user.isLiquidated) {
    return false;
  }

  const balance = Number(user.balance) || 0;

  if (balance > 0) {
    user.isLiquidated = false;
    return true;
  }

  return false;
}

function isBreached(position, stockName, currentPrice) {
  if (position.stockName !== stockName) {
    return false;
  }

  const buyPrice = Number(position.buyPrice);
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    return false;
  }

  return currentPrice <= buyPrice * (1 - LIQUIDATION_DROP);
}

const NEW_STOCK_GRACE_MS = 1000;
const POSITION_GRACE_MS = 1000;

function isPositionInGrace(position) {
  if (!position?.purchasedAt) {
    return false;
  }
  const ageMs = Date.now() - new Date(position.purchasedAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < POSITION_GRACE_MS;
}

async function checkLiquidation(stockName, currentPrice, options = {}) {
  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    return;
  }

  if (options.stockCreatedAt) {
    const ageMs = Date.now() - new Date(options.stockCreatedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < NEW_STOCK_GRACE_MS) {
      return;
    }
  }

  const users = await User.find({
    ...ACTIVE_USER_FILTER,
    'stocks.stockName': stockName,
    isLiquidated: { $ne: true },
  });

  for (const user of users) {
    const breached = user.stocks.some(
      (position) =>
        !isPositionInGrace(position) && isBreached(position, stockName, currentPrice)
    );

    if (breached) {
      await liquidateUserAccount(user);
    }
  }
}

module.exports = {
  checkLiquidation,
  liquidateUserAccount,
  clearLiquidationIfFunded,
  LIQUIDATION_DROP,
};
