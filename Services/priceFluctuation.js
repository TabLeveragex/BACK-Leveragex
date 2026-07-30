const { sanitizePrice, isValidStockNumber } = require('../utils/stockValidation');
const { checkLiquidation } = require('./liquidationService');
const { saveMarketControlSettings } = require('./marketControlPersistence');

const FLUCTUATION_RANGE = 3;
const TICK_MS = 1000;

const state = global.__leveragePriceState || (global.__leveragePriceState = {
  intervalId: null,
  models: [],
  plusMinusToggleEnabled: false,
  globalMarketTrend: null,
  abModeEnabled: false,
  fluctuationEnabled: false,
  stockTrendProfiles: new Map(),
});

function persistControlState() {
  saveMarketControlSettings({
    plusMinusToggleEnabled: state.plusMinusToggleEnabled,
    abModeEnabled: state.abModeEnabled,
    fluctuationEnabled: state.fluctuationEnabled,
    globalMarketTrend: state.globalMarketTrend,
  }).catch((error) => {
    console.error('[MarketControl] Failed to persist settings:', error);
  });
}

function isPriceMovementEnabled() {
  const trendActive =
    state.plusMinusToggleEnabled &&
    (state.globalMarketTrend === 'up' || state.globalMarketTrend === 'down');
  return trendActive || state.abModeEnabled || state.fluctuationEnabled;
}

function applyControlSettings(settings = {}) {
  state.plusMinusToggleEnabled = Boolean(settings.plusMinusToggleEnabled);
  state.abModeEnabled = Boolean(settings.abModeEnabled);
  state.fluctuationEnabled = Boolean(settings.fluctuationEnabled);

  if (
    settings.globalMarketTrend === 'up' ||
    settings.globalMarketTrend === 'down'
  ) {
    state.globalMarketTrend = settings.globalMarketTrend;
  } else {
    state.globalMarketTrend = null;
  }

  if (!state.plusMinusToggleEnabled) {
    state.globalMarketTrend = null;
    state.stockTrendProfiles.clear();
  }
}

async function initMarketControlFromDatabase() {
  try {
    const { loadMarketControlSettings } = require('./marketControlPersistence');
    const settings = await loadMarketControlSettings();
    applyControlSettings(settings);
    console.log('[MarketControl] Loaded settings:', getControlStatus());
  } catch (error) {
    console.error('[MarketControl] Using safe idle defaults:', error.message);
    applyControlSettings({});
  }
}

function toNumber(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function stockSeed(stockId) {
  return String(stockId)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

const DOWN_TREND_STEPS = [-1, 0.5, -0.2, -1];
const UP_TREND_STEPS = [1, -0.5, 0.2, 1];

function getStockTrendProfile(stockId) {
  const key = String(stockId);
  if (!state.stockTrendProfiles.has(key)) {
    state.stockTrendProfiles.set(key, {
      cycleIndex: stockSeed(stockId) % DOWN_TREND_STEPS.length,
    });
  }
  return state.stockTrendProfiles.get(key);
}

function clampAroundTarget(price, target) {
  const min = Math.max(0.01, target - FLUCTUATION_RANGE);
  const max = target + FLUCTUATION_RANGE;
  return Math.min(max, Math.max(min, price));
}

function stepTowardTarget(currentPrice, targetPrice) {
  const direction = targetPrice > currentPrice ? 1 : -1;
  return currentPrice + Math.random() * 0.5 * direction;
}

function applyMicroFluctuation(price) {
  const offset = Math.random() * (FLUCTUATION_RANGE * 2) - FLUCTUATION_RANGE;
  return Math.max(0.01, price + offset);
}

function applyContinuousTrend(price, direction, stockId) {
  const profile = getStockTrendProfile(stockId);
  const steps = direction === 'up' ? UP_TREND_STEPS : DOWN_TREND_STEPS;
  const step = steps[profile.cycleIndex % steps.length];
  profile.cycleIndex = (profile.cycleIndex + 1) % steps.length;
  return Math.max(0.01, price + step);
}

function computeABPrice(stock, aField, bField, currentPrice) {
  const A = sanitizePrice(toNumber(stock[aField]));
  const B = sanitizePrice(toNumber(stock[bField]));
  let price = sanitizePrice(toNumber(currentPrice, B));

  if (!isValidStockNumber(A) || !isValidStockNumber(B) || !isValidStockNumber(price)) {
    return currentPrice;
  }

  if (A < B) {
    if (price < B) {
      price = stepTowardTarget(price, B);
      if (price >= B) {
        price = B;
      }
    } else {
      price = clampAroundTarget(Math.random() * (FLUCTUATION_RANGE * 2) + (B - FLUCTUATION_RANGE), B);
    }
  } else if (A > B) {
    if (price > B) {
      price = stepTowardTarget(price, B);
      if (price <= B) {
        price = B;
      }
    } else {
      price = clampAroundTarget(Math.random() * (FLUCTUATION_RANGE * 2) + (B - FLUCTUATION_RANGE), B);
    }
  } else {
    price = clampAroundTarget(Math.random() * (FLUCTUATION_RANGE * 2) + (B - FLUCTUATION_RANGE), B);
  }

  return roundPrice(clampAroundTarget(price, B));
}

function applyStandaloneFluctuation(price) {
  return roundPrice(clampAroundTarget(Math.random() * (FLUCTUATION_RANGE * 2) + (price - FLUCTUATION_RANGE), price));
}

async function processStockPrice(stock, aField, bField) {
  let price = toNumber(stock.price);
  if (!Number.isFinite(price)) {
    return;
  }

  const trendActive =
    state.plusMinusToggleEnabled &&
    (state.globalMarketTrend === 'up' || state.globalMarketTrend === 'down');

  if (!trendActive && !state.abModeEnabled && !state.fluctuationEnabled) {
    return;
  }

  const previousPrice = price;

  if (state.abModeEnabled) {
    price = computeABPrice(stock, aField, bField, price);
  }

  if (trendActive) {
    price = applyContinuousTrend(price, state.globalMarketTrend, stock._id);
  }

  if (state.fluctuationEnabled) {
    if (trendActive || state.abModeEnabled) {
      price = applyMicroFluctuation(price);
    } else {
      price = applyStandaloneFluctuation(price);
    }
  }

  const nextPrice = roundPrice(Math.max(0.01, price));
  if (nextPrice === toNumber(stock.price)) {
    return;
  }

  stock.price = nextPrice;
  stock.priceTrend = trendActive ? state.globalMarketTrend : undefined;

  const update = trendActive
    ? { $set: { price: nextPrice, priceTrend: state.globalMarketTrend } }
    : { $set: { price: nextPrice }, $unset: { priceTrend: 1 } };

  await stock.constructor.findByIdAndUpdate(stock._id, update);

  if (nextPrice < previousPrice) {
    await checkLiquidation(stock.name, nextPrice, {
      stockCreatedAt: stock.createdAt,
    });
  }
}

function removeStockTrendProfile(stockId) {
  state.stockTrendProfiles.delete(String(stockId));
}

async function registerNewStockForActiveTrend(stock, aField, bField) {
  if (!stock?._id) {
    return;
  }

  getStockTrendProfile(stock._id);

  if (!state.plusMinusToggleEnabled || !state.globalMarketTrend) {
    return;
  }

  await stock.constructor.findByIdAndUpdate(stock._id, {
    $set: { priceTrend: state.globalMarketTrend },
  });
  stock.priceTrend = state.globalMarketTrend;
  await processStockPrice(stock, aField, bField);
}

async function processAllPrices() {
  for (const { Model, aField, bField } of state.models) {
    try {
      const stocks = await Model.find();
      for (const stock of stocks) {
        await processStockPrice(stock, aField, bField);
      }
    } catch (error) {
      console.error('Price tick error:', error);
    }
  }
}

function isPlusMinusToggleEnabled() {
  return Boolean(state.plusMinusToggleEnabled);
}

function setPlusMinusToggle(enabled) {
  state.plusMinusToggleEnabled = Boolean(enabled);
  if (!enabled) {
    state.globalMarketTrend = null;
    state.stockTrendProfiles.clear();
  }
  persistControlState();
}

function setAbMode(enabled) {
  state.abModeEnabled = Boolean(enabled);
  persistControlState();
}

function setFluctuationMode(enabled) {
  state.fluctuationEnabled = Boolean(enabled);
  persistControlState();
}

function isAbModeEnabled() {
  return Boolean(state.abModeEnabled);
}

function isFluctuationEnabled() {
  return Boolean(state.fluctuationEnabled);
}

function getMarketTrend() {
  return state.globalMarketTrend;
}

function setMarketTrend(direction) {
  if (!state.plusMinusToggleEnabled) {
    const error = new Error('Turn +/- Toggle ON first, then use + or −');
    error.code = 'PLUS_MINUS_OFF';
    throw error;
  }
  if (direction !== 'up' && direction !== 'down') {
    const error = new Error('Trend direction must be up or down');
    error.code = 'INVALID_DIRECTION';
    throw error;
  }
  state.globalMarketTrend = direction;
  persistControlState();
}

async function clearWatchlistTrend(watchlistKey) {
  state.globalMarketTrend = null;
  state.stockTrendProfiles.clear();
  persistControlState();

  const config = state.models.find((entry) => entry.key === watchlistKey);
  if (!config) {
    return { updated: 0 };
  }

  const stocks = await config.Model.find();
  for (const stock of stocks) {
    await config.Model.findByIdAndUpdate(stock._id, { $unset: { priceTrend: 1 } });
  }

  return { updated: stocks.length };
}

async function setWatchlistTrend(watchlistKey, trend) {
  setMarketTrend(trend);

  const config = state.models.find((entry) => entry.key === watchlistKey);
  if (!config) {
    return { updated: 0 };
  }

  const stocks = await config.Model.find();
  for (const stock of stocks) {
    getStockTrendProfile(stock._id);
    await config.Model.findByIdAndUpdate(stock._id, { $set: { priceTrend: trend } });
    await processStockPrice(stock, config.aField, config.bField);
  }

  return { updated: stocks.length };
}

function getControlStatus() {
  const trendActive =
    state.plusMinusToggleEnabled &&
    (state.globalMarketTrend === 'up' || state.globalMarketTrend === 'down');

  return {
    plusMinusToggleEnabled: state.plusMinusToggleEnabled,
    abModeEnabled: state.abModeEnabled,
    fluctuationEnabled: state.fluctuationEnabled,
    marketTrend: state.globalMarketTrend,
    canUseTrendButtons: state.plusMinusToggleEnabled,
    priceMovementActive: isPriceMovementEnabled(),
    trendActive,
  };
}

async function stopAllPriceMovement(watchlistKey = 'watchlist1') {
  state.plusMinusToggleEnabled = false;
  state.abModeEnabled = false;
  state.fluctuationEnabled = false;
  state.globalMarketTrend = null;
  state.stockTrendProfiles.clear();
  persistControlState();
  return clearWatchlistTrend(watchlistKey);
}

function startPriceFluctuation(models) {
  state.models = models;

  if (state.intervalId) {
    clearInterval(state.intervalId);
  }

  state.intervalId = setInterval(() => {
    processAllPrices().catch((error) => {
      console.error('Price loop error:', error);
    });
  }, TICK_MS);
}

module.exports = {
  startPriceFluctuation,
  initMarketControlFromDatabase,
  setWatchlistTrend,
  clearWatchlistTrend,
  setPlusMinusToggle,
  setAbMode,
  setFluctuationMode,
  isPlusMinusToggleEnabled,
  isAbModeEnabled,
  isFluctuationEnabled,
  isPriceMovementEnabled,
  getMarketTrend,
  getControlStatus,
  stopAllPriceMovement,
  setMarketTrend,
  removeStockTrendProfile,
  registerNewStockForActiveTrend,
  isAdminTrendModeEnabled: isPlusMinusToggleEnabled,
  setAdminTrendMode: setPlusMinusToggle,
  canUseAdminTrendButtons: () => state.plusMinusToggleEnabled,
};
