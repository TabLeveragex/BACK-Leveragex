// Per-stock price engine for WatchList1.
//
// Prices are no longer mutated in the database every second. Instead each
// stock stores an anchor (`price`), a `trend` direction and the moment the
// trend started (`trendSince`). The current price is computed on read:
//
//   1. anchor price (last set value)
//   2. + drift: 0.5/sec in the trend direction
//   3. + waves: small pullbacks and recoveries
//   4. = current price (the moving price)
//
// The live price adds a random jitter between -3 and +3 on top.
const { checkLiquidation } = require('./liquidationService');

const DRIFT_PER_SECOND = 0.5;
const JITTER_RANGE = 3;
const MIN_PRICE = 1;
const TICK_MS = 1000;

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

/** Per-stock phase offset so different stocks don't move in sync. */
function phase(id) {
  const key = String(id);
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 1000;
  }
  return (h / 1000) * Math.PI * 2;
}

/**
 * Wavy component layered on the drift so the price pulls back and
 * recovers along the way instead of moving in a straight line.
 * Anchored so it is 0 at t=0 (no jump when the trend is switched).
 */
function wave(t, p) {
  const slow = 4 * Math.sin((2 * Math.PI * t) / 45 + p);
  const fast = 1.8 * Math.sin((2 * Math.PI * t) / 13 + p * 2);
  return slow + fast;
}

/**
 * The drifting base price: trends up (or down) from the anchor price,
 * with small drawdowns and recoveries along the way.
 */
function basePrice(stock) {
  const anchor = Number(stock.price) || MIN_PRICE;
  if (stock.trend === 'neutral') {
    return Math.max(roundPrice(anchor), MIN_PRICE);
  }
  const since = stock.trendSince ? new Date(stock.trendSince).getTime() : Date.now();
  const t = Math.max(0, (Date.now() - since) / 1000);
  const dir = stock.trend === 'down' ? -1 : 1;
  const p = phase(stock._id);
  const price = anchor + dir * DRIFT_PER_SECOND * t + wave(t, p) - wave(0, p);
  return Math.max(roundPrice(price), MIN_PRICE);
}

/** Live price: random +3/-3 jitter on top of the drifting base price. */
function livePrice(stock) {
  const jitter = Math.random() * (JITTER_RANGE * 2) - JITTER_RANGE;
  const price = basePrice(stock) + jitter;
  return Math.max(roundPrice(price), MIN_PRICE);
}

/**
 * Liquidation watcher: since prices are computed on read, run a 1s loop
 * that evaluates the drifting price of every stock and applies the 10%
 * liquidation rule against open positions.
 */
function startLiquidationWatcher(Model) {
  const state = global.__leverageLiquidationWatcher || (global.__leverageLiquidationWatcher = {
    intervalId: null,
  });

  if (state.intervalId) {
    clearInterval(state.intervalId);
  }

  state.intervalId = setInterval(async () => {
    try {
      const stocks = await Model.find();
      for (const stock of stocks) {
        await checkLiquidation(stock.name, basePrice(stock), {
          stockCreatedAt: stock.createdAt,
        });
      }
    } catch (error) {
      console.error('Liquidation watcher error:', error);
    }
  }, TICK_MS);
}

module.exports = {
  basePrice,
  livePrice,
  startLiquidationWatcher,
  DRIFT_PER_SECOND,
  JITTER_RANGE,
};
