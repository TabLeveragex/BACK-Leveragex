const PLAN_AMOUNTS = {
  Evolution: 5000,
  Prime: 10000,
};

const CUSTOM_MIN_AMOUNT = 1000;
const CUSTOM_MAX_AMOUNT = 1000000;

function getBaseUrl() {
  return String(process.env.DIVINE_PAY_BASE_URL || 'https://divinepay.us.cc').trim().replace(/\/$/, '');
}

function getApiKey() {
  return String(process.env.DIVINE_PAY_API_KEY || process.env.DIVINE_PAY_SECRET_KEY || '').trim();
}

function getCreatePath() {
  return String(process.env.DIVINE_PAY_CREATE_PATH || '/api/payin/payin/create').trim();
}

function getStatusPath() {
  return String(process.env.DIVINE_PAY_STATUS_PATH || '/api/payin/status').trim();
}

function resolveProductAmount(productType, amountInput) {
  if (productType === 'Evolution') {
    return PLAN_AMOUNTS.Evolution;
  }
  if (productType === 'Prime') {
    return PLAN_AMOUNTS.Prime;
  }
  if (productType === 'CustomExclusive' || productType === 'AddFunds') {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < CUSTOM_MIN_AMOUNT) {
      return { error: `Minimum amount is ₹${CUSTOM_MIN_AMOUNT.toLocaleString('en-IN')}.` };
    }
    if (amount > CUSTOM_MAX_AMOUNT) {
      return { error: `Maximum amount is ₹${CUSTOM_MAX_AMOUNT.toLocaleString('en-IN')}.` };
    }
    return Math.round(amount);
  }
  return { error: 'Invalid payment product.' };
}

async function createPayInOrder(amount) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('DIVINE_PAY_API_KEY is not configured on the server.');
  }

  const url = `${getBaseUrl()}${getCreatePath()}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ amount: Number(amount) }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.message || data?.error || `Gateway error (${response.status})`;
    throw new Error(msg);
  }

  const payload = data?.data || data;
  const gatewayOrderId = String(payload?.order_id || payload?.orderId || '').trim();
  const paymentUrl = String(payload?.paymentUrl || payload?.payment_url || '').trim();

  if (!gatewayOrderId || !paymentUrl) {
    throw new Error('Payment gateway did not return order_id or paymentUrl.');
  }

  return { gatewayOrderId, paymentUrl, raw: data };
}

async function checkPayInStatus(gatewayOrderId) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('DIVINE_PAY_API_KEY is not configured on the server.');
  }

  const url = `${getBaseUrl()}${getStatusPath()}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ order_id: gatewayOrderId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.message || data?.error || `Status check failed (${response.status})`;
    throw new Error(msg);
  }

  const payload = data?.data || data;
  const status = String(payload?.status || '').trim().toLowerCase();
  return { status, raw: data };
}

module.exports = {
  PLAN_AMOUNTS,
  CUSTOM_MIN_AMOUNT,
  CUSTOM_MAX_AMOUNT,
  resolveProductAmount,
  createPayInOrder,
  checkPayInStatus,
};
