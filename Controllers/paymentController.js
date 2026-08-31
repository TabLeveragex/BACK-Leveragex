const crypto = require('crypto');
const PayInOrder = require('../Models/PayInOrder');
const {
  resolveProductAmount,
  createPayInOrder,
  checkPayInStatus,
} = require('../Services/divinePayService');
const { updateOrderFromGateway } = require('../Services/paymentFulfillmentService');
const { computeAddFundsCredit } = require('../Services/addFundsCreditService');

function isCustomFundProduct(productType) {
  return productType === 'CustomExclusive' || productType === 'AddFunds';
}

function buildMerchantOrderId(userId) {
  return `lx_${String(userId)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function createPayIn(req, res) {
  try {
    const productType = String(req.body.productType || '').trim();
    const amountInput = req.body.amount;

    const resolved = resolveProductAmount(productType, amountInput);
    if (typeof resolved === 'object' && resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }
    const enteredAmount = resolved;

    let gatewayAmount = enteredAmount;
    let addFundsMeta = null;
    if (isCustomFundProduct(productType)) {
      addFundsMeta = computeAddFundsCredit(enteredAmount);
      gatewayAmount = addFundsMeta.creditRupees;
    }

    // Always create a fresh gateway order (never reuse pending for same amount).
    const merchantOrderId = buildMerchantOrderId(req.user.id);
    const gateway = await createPayInOrder(gatewayAmount, { merchantOrderId });

    const duplicateSuccess = await PayInOrder.findOne({
      gatewayOrderId: gateway.gatewayOrderId,
      status: 'success',
    });
    if (duplicateSuccess) {
      return res.status(409).json({
        success: false,
        message: 'This payment was already completed. Please try again.',
      });
    }

    const existingPending = await PayInOrder.findOne({
      gatewayOrderId: gateway.gatewayOrderId,
      status: 'pending',
    });
    if (existingPending) {
      // Gateway returned a stale order id — force uniqueness on our side by rejecting.
      return res.status(503).json({
        success: false,
        message: 'Could not create a fresh payment order. Please try again.',
      });
    }

    await PayInOrder.create({
      userId: req.user.id,
      gatewayOrderId: gateway.gatewayOrderId,
      productType,
      amount: gatewayAmount,
      requestedAmount: isCustomFundProduct(productType) ? enteredAmount : undefined,
      creditedAmount: isCustomFundProduct(productType) ? gatewayAmount : undefined,
      paisaDeduction: addFundsMeta?.deductionPaisa,
      status: 'pending',
      paymentUrl: gateway.paymentUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment session created.',
      orderId: gateway.gatewayOrderId,
      paymentUrl: gateway.paymentUrl,
      amount: gatewayAmount,
      requestedAmount: isCustomFundProduct(productType) ? enteredAmount : undefined,
      payAmount: gatewayAmount,
      productType,
      reused: false,
    });
  } catch (err) {
    console.error('[Payment] createPayIn error:', err.message);
    return res.status(503).json({
      success: false,
      message: err.message || 'Could not start payment. Please try again.',
    });
  }
}

async function getPayInStatus(req, res) {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const order = await PayInOrder.findOne({
      gatewayOrderId: orderId,
      userId: req.user.id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }

    if (order.status === 'success') {
      return res.status(200).json({
        success: true,
        status: 'success',
        productType: order.productType,
        amount: order.amount,
        requestedAmount: order.requestedAmount,
        creditedAmount: order.creditedAmount ?? order.amount,
      });
    }

    try {
      const remote = await checkPayInStatus(orderId);
      const result = await updateOrderFromGateway(order, {
        status: remote.status,
        orderAmount: order.amount,
        realAmount: order.amount,
      });
      return res.status(200).json({
        success: true,
        status: result.status,
        productType: order.productType,
        amount: order.amount,
        requestedAmount: order.requestedAmount,
        creditedAmount: order.creditedAmount ?? order.amount,
        fulfilled: result.fulfilled,
        balanceCredited: result.balanceCredited,
      });
    } catch (pollErr) {
      return res.status(200).json({
        success: true,
        status: order.status,
        productType: order.productType,
        amount: order.amount,
        message: pollErr.message,
      });
    }
  } catch (err) {
    console.error('[Payment] getPayInStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function handlePayInWebhook(req, res) {
  try {
    const type = String(req.body?.type || '').trim().toUpperCase();
    if (type !== 'PAYIN') {
      return res.status(200).json({ success: true });
    }

    const orderId = String(req.body?.order_id || '').trim();
    if (!orderId) {
      return res.status(200).json({ success: true });
    }

    const order = await PayInOrder.findOne({ gatewayOrderId: orderId });
    if (!order) {
      console.warn('[Payment] Webhook for unknown order:', orderId);
      return res.status(200).json({ success: true });
    }

    await updateOrderFromGateway(order, {
      status: req.body.status,
      utr: req.body.utr,
      orderAmount: req.body.orderAmount,
      realAmount: req.body.realAmount,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Payment] webhook error:', err.message);
    return res.status(200).json({ success: true });
  }
}

module.exports = {
  createPayIn,
  getPayInStatus,
  handlePayInWebhook,
};
