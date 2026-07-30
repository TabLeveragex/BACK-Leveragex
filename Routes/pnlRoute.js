// routes/pnlRoutes.js
const express = require('express');
const router = express.Router();
const pnlController = require('../Controllers/pnlController');

// Route to get user's PnL data (stocks and balances)
router.get('/pnl/:userId', pnlController.getPnLData);

// Route to get stock price from Watchlist1 or Watchlist2 based on watchlistType
router.get('/stock-price/:watchlistType/:stockName', pnlController.getStockPrice);

// Route to sell stock and update user's balance
router.post('/pnl/sell', pnlController.sellStock);

// Route to withdraw user's balance
router.post('/pnl/withdraw', pnlController.withdraw);

module.exports = router;