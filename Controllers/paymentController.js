const PayInOrder = require('../Models/PayInOrder');
const {
  resolveProductAmount,
  createPayInOrder,
  checkPayInStatus,
} = require('../Services/divinePayService');
const { updateOrderFromGateway } = require('../Services/paymentFulfillmentService');
const { computeAddFundsCredit } = require('../Services/addFundsCreditService');

const PENDING_REUSE_MS = 15 * 60 * 1000;

function isCustomFundProduct(productType) {
  return productType === 'CustomExclusive' || productType === 'AddFunds';
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

    const pendingQuery = {
      userId: req.user.id,
      productType,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - PENDING_REUSE_MS) },
    };
    if (isCustomFundProduct(productType)) {
      pendingQuery.requestedAmount = enteredAmount;
    } else {
      pendingQuery.amount = gatewayAmount;
    }

    const recentPending = await PayInOrder.findOne(pendingQuery).sort({ createdAt: -1 });

    if (recentPending?.paymentUrl) {
      return res.status(200).json({
        success: true,
        message: 'Redirecting to payment.',
        orderId: recentPending.gatewayOrderId,
        paymentUrl: recentPending.paymentUrl,
        amount: recentPending.amount,
        requestedAmount: recentPending.requestedAmount ?? enteredAmount,
        payAmount: recentPending.amount,
        productType,
        reused: true,
      });
    }

    const gateway = await createPayInOrder(gatewayAmount);

    const duplicateSuccess = await PayInOrder.findOne({
      gatewayOrderId: gateway.gatewayOrderId,
      status: 'success',
    });
    if (duplicateSuccess) {
      return res.status(409).json({
        success: false,
        message: 'This payment was already completed.',
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
