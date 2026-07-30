const express = require('express');
const ensureAuthenticated = require('../Middlewares/auth');
const ensureAdmin = require('../Middlewares/adminAuth');
const { deleteUserCompletely } = require('../Services/userDeletionService');
const UserDeletionAudit = require('../Models/UserDeletionAudit');
const { getDatabaseHealth } = require('../Services/databaseHealthService');
const mongoose = require('mongoose');

const {
  getUsers,
  getUserBalance,
  updateUserBalance,
  updateStockPrices,
  fetchStockPrices,
  sellStock,
  getUserStockPrices,
} = require('../Controllers/userController');
const User = require('../Models/userModel');
const WatchList1Stock = require('../Models/watchList1Model');
const {
  isValidMarketPrice,
  normalizeBalance,
  normalizeQuantity,
  MAX_USER_BALANCE,
} = require('../utils/stockValidation');
const { clearLiquidationIfFunded } = require('../Services/liquidationService');
const { livePrice } = require('../Services/priceEngine');
const router = express.Router();

const getCurrentStockPrice = async (stockName) => {
  try {
    const stock = await WatchList1Stock.findOne({ name: stockName });
    if (!stock) {
      return null;
    }
    const price = livePrice(stock);
    if (!isValidMarketPrice(price)) {
      return null;
    }
    return price;
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return null;
  }
};

// Authenticated user routes — userId always from JWT
router.get('/me/balance', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (clearLiquidationIfFunded(user)) {
      await user.save();
    }
    res.status(200).json({
      balance: normalizeBalance(user.balance),
      isLiquidated: Boolean(user.isLiquidated),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user balance' });
  }
});

router.get('/me/stocks', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (clearLiquidationIfFunded(user)) {
      await user.save();
    }

    res.status(200).json({
      stocks: user.stocks,
      balance: normalizeBalance(user.balance),
      isLiquidated: Boolean(user.isLiquidated),
    });
  } catch (error) {
    console.error('Error fetching user stocks:', error);
    res.status(500).json({ message: 'Error fetching user stocks' });
  }
});

router.post('/sell', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { stockName, quantity, watchlistType, autoSell = false } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (clearLiquidationIfFunded(user)) {
      await user.save();
    }

    if (user.isLiquidated) {
      return res.status(403).json({ message: 'Account liquidated. Selling is not allowed.' });
    }

    const stock = user.stocks.find((s) => s.stockName === stockName);
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found in portfolio' });
    }

    const sellQty = normalizeQuantity(quantity);
    if (sellQty <= 0) {
      return res.status(400).json({ message: 'Invalid sell quantity' });
    }

    if (stock.quantity < sellQty) {
      return res.status(400).json({ message: 'Not enough stock to sell' });
    }

    const currentPrice = await getCurrentStockPrice(stockName);
    if (currentPrice === null) {
      return res.status(500).json({ message: 'Unable to retrieve stock price' });
    }

    const saleAmount = currentPrice * sellQty;
    const nextBalance = normalizeBalance(user.balance) + saleAmount;

    if (!Number.isFinite(nextBalance) || nextBalance < 0 || nextBalance > MAX_USER_BALANCE) {
      return res.status(400).json({ message: 'Invalid balance after sale' });
    }

    user.balance = nextBalance;

    if (stock.quantity > sellQty) {
      stock.quantity -= sellQty;
    } else {
      user.stocks = user.stocks.filter((s) => s.stockName !== stockName);
    }

    await user.save();

    res.status(200).json({ message: 'Stock sold successfully', updatedBalance: user.balance });
  } catch (error) {
    console.error('Error selling stock:', error);
    res.status(500).json({ message: 'Error selling stock', error: error.message });
  }
});

router.post('/liquidate', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { stockName } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const position = user.stocks.find((s) => s.stockName === stockName);
    if (!position) {
      return res.status(404).json({ message: 'Stock not found in portfolio' });
    }

    const buyPrice = Number(position.buyPrice);
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      return res.status(400).json({ message: 'Invalid purchase price on position' });
    }

    const currentPrice = await getCurrentStockPrice(stockName);
    const liquidationPrice = buyPrice * 0.9;

    if (currentPrice === null || currentPrice > liquidationPrice) {
      return res.status(400).json({ message: '10% liquidation threshold not met' });
    }

    user.balance = 0;
    user.stocks = [];
    user.isLiquidated = true;
    await user.save();

    res.status(200).json({
      message: 'Account forcefully liquidated under platform 10% loss rule',
      updatedBalance: 0,
      isLiquidated: true,
    });
  } catch (error) {
    console.error('Error liquidating account:', error);
    res.status(500).json({ message: 'Error liquidating account', error: error.message });
  }
});

router.delete('/me', ensureAuthenticated, async (req, res) => {
  try {
    const result = await deleteUserCompletely(req.user.id, {
      source: 'self_delete',
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      userAgent: String(req.headers['user-agent'] || ''),
    });
    if (!result.found) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({
      message: result.mode === 'soft'
        ? 'Account deactivated (record kept in database)'
        : 'Your account and related data were deleted successfully',
      mode: result.mode,
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    if (error.code === 'USER_DELETE_DISABLED') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error deleting account' });
  }
});

// Admin routes — dashboard only
router.get('/db-health', ensureAdmin, async (req, res) => {
  try {
    const health = await getDatabaseHealth(mongoose.connection);
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ message: 'Failed to read database health' });
  }
});

router.get('/deletion-audit', ensureAdmin, async (req, res) => {
  try {
    const logs = await UserDeletionAudit.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deletion audit logs' });
  }
});

router.get('/', ensureAdmin, getUsers);
router.get('/balance/:userId', ensureAdmin, getUserBalance);
router.put('/balance/:userId', ensureAdmin, updateUserBalance);
router.post('/stocks/update', ensureAdmin, updateStockPrices);
router.get('/stocks/:userId/prices', ensureAdmin, fetchStockPrices);
router.get('/:userId/stock-prices', ensureAdmin, getUserStockPrices);
router.delete('/:userId', ensureAdmin, async (req, res) => {
  try {
    const result = await deleteUserCompletely(req.params.userId, {
      source: 'admin_api',
      actorAdminId: req.admin?.id,
      actorAdminEmail: req.admin?.email,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      userAgent: String(req.headers['user-agent'] || ''),
    });
    if (!result.found) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({
      message: result.mode === 'soft'
        ? 'User deactivated — document remains in MongoDB'
        : 'User and related data deleted successfully',
      mode: result.mode,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error.code === 'USER_DELETE_DISABLED') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Legacy routes — kept for compatibility, require auth + self match
router.get('/stocks/:userId', ensureAuthenticated, async (req, res) => {
  if (String(req.params.userId) !== String(req.user.id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      stocks: user.stocks,
      balance: user.balance,
      isLiquidated: Boolean(user.isLiquidated),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user stocks' });
  }
});

router.post('/stocks/sell', ensureAuthenticated, sellStock);

module.exports = router;
