const User = require('../Models/userModel');
const PayInOrder = require('../Models/PayInOrder');
const { computeAddFundsCredit } = require('./addFundsCreditService');

function resolveAddFundsCredit(order) {
  const stored = Number(order.creditedAmount);
  if (Number.isFinite(stored) && stored > 0) {
    return {
      creditRupees: stored,
      deductionPaisa: Number(order.paisaDeduction) || null,
    };
  }

  const baseAmount = Number(order.requestedAmount) || Number(order.amount);
  const computed = computeAddFundsCredit(baseAmount);
  order.creditedAmount = computed.creditRupees;
  order.paisaDeduction = computed.deductionPaisa;
  return computed;
}

function isCustomFundPayment(productType) {
  return productType === 'CustomExclusive' || productType === 'AddFunds';
}

function normalizeGatewayStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'success' || value === 'successful' || value === 'completed') {
    return 'success';
  }
  if (value === 'failed' || value === 'failure') {
    return 'failed';
  }
  return 'pending';
}

async function applySuccessfulPayment(order) {
  if (!order || order.status === 'success') {
    return { applied: false, reason: 'already_fulfilled' };
  }

  const user = await User.findById(order.userId);
  if (!user) {
    order.status = 'failed';
    order.failureReason = 'user_not_found';
    await order.save();
    return { applied: false, reason: 'user_not_found' };
  }

  let balanceCredited = 0;

  if (order.productType === 'Evolution') {
    user.plan = 'Evolution';
  } else if (order.productType === 'Prime') {
    user.plan = 'Prime';
  } else if (isCustomFundPayment(order.productType)) {
    const { creditRupees } = resolveAddFundsCredit(order);
    balanceCredited = creditRupees;
    if (balanceCredited > 0) {
      user.balance = (Number(user.balance) || 0) + balanceCredited;
    }
  }

  await user.save();

  order.status = 'success';
  order.fulfilledAt = new Date();
  await order.save();

  return { applied: true, plan: user.plan, balanceCredited };
}

async function updateOrderFromGateway(order, payload) {
  const gatewayStatus = normalizeGatewayStatus(payload.status);
  order.gatewayStatus = String(payload.status || '');
  if (payload.utr) {
    order.utr = String(payload.utr);
  }
  if (payload.orderAmount != null) {
    order.orderAmount = Number(payload.orderAmount);
  }
  if (payload.realAmount != null) {
    order.realAmount = Number(payload.realAmount);
  }

  if (gatewayStatus === 'failed') {
    order.status = 'failed';
    order.failureReason = 'gateway_failed';
    await order.save();
    return { fulfilled: false, status: 'failed' };
  }

  if (gatewayStatus !== 'success') {
    order.status = 'pending';
    await order.save();
    return { fulfilled: false, status: 'pending' };
  }

  const result = await applySuccessfulPayment(order);
  return { fulfilled: result.applied, status: 'success', ...result };
}

module.exports = {
  normalizeGatewayStatus,
  applySuccessfulPayment,
  updateOrderFromGateway,
};
