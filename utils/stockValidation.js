const MAX_STOCK_VALUE = 1_000_000;
const MIN_STOCK_VALUE = 0.01;
const MAX_USER_BALANCE = 10_000_000;
const MAX_TRADE_QUANTITY = 10_000;

function normalizeBalance(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, MAX_USER_BALANCE);
}

function normalizeQuantity(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, MAX_TRADE_QUANTITY);
}

function isValidStockNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= MIN_STOCK_VALUE && parsed <= MAX_STOCK_VALUE;
}

function isValidMarketPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_STOCK_VALUE;
}

function validateStockFields({ price, a, b }) {
  if (!isValidStockNumber(price)) {
    return { ok: false, message: `Price must be between ${MIN_STOCK_VALUE} and ${MAX_STOCK_VALUE}.` };
  }
  if (!isValidStockNumber(a)) {
    return { ok: false, message: `A must be between ${MIN_STOCK_VALUE} and ${MAX_STOCK_VALUE}.` };
  }
  if (!isValidStockNumber(b)) {
    return { ok: false, message: `B must be between ${MIN_STOCK_VALUE} and ${MAX_STOCK_VALUE}.` };
  }
  return { ok: true };
}

function sanitizePrice(value, fallback = MIN_STOCK_VALUE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_STOCK_VALUE, Math.max(MIN_STOCK_VALUE, parsed));
}

module.exports = {
  MAX_STOCK_VALUE,
  MIN_STOCK_VALUE,
  MAX_USER_BALANCE,
  MAX_TRADE_QUANTITY,
  isValidStockNumber,
  isValidMarketPrice,
  validateStockFields,
  sanitizePrice,
  normalizeBalance,
  normalizeQuantity,
};
