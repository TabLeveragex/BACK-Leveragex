const express = require('express');
const ensureAuthenticated = require('../Middlewares/auth');
const {
  createPayIn,
  getPayInStatus,
  handlePayInWebhook,
} = require('../Controllers/paymentController');

const router = express.Router();

router.post('/payin/webhook', handlePayInWebhook);
router.post('/payin/create', ensureAuthenticated, createPayIn);
router.get('/payin/status/:orderId', ensureAuthenticated, getPayInStatus);

module.exports = router;
