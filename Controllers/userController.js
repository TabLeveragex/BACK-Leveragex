// controllers/userController.js
const User = require('../Models/userModel');
const { clearLiquidationIfFunded } = require('../Services/liquidationService');
const { normalizeBalance, MAX_USER_BALANCE } = require('../utils/stockValidation');
const { ACTIVE_USER_FILTER } = require('../utils/userQuery');

// Fetch all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find(ACTIVE_USER_FILTER);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// Fetch user balance
exports.getUserBalance = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user balance' });
  }
};

// Update user balance
exports.updateUserBalance = async (req, res) => {
  const { userId } = req.params;
  const { balance } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const parsedBalance = normalizeBalance(balance);
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      return res.status(400).json({ message: 'Invalid balance value' });
    }
    if (Number(balance) > MAX_USER_BALANCE) {
      return res.status(400).json({
        message: `Balance cannot exceed ₹${MAX_USER_BALANCE.toLocaleString('en-IN')}`,
      });
    }

    user.balance = parsedBalance;
    const reactivated = clearLiquidationIfFunded(user);
    await user.save();

    res.status(200).json({
      message: reactivated
        ? 'User balance updated and 10% trading rule reactivated'
        : 'User balance updated',
      isLiquidated: Boolean(user.isLiquidated),
      reactivated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user balance' });
  }
};

// Update stock prices when user buys a stock
exports.updateStockPrices = async (req, res) => {
  const { userId, stockName, stockPrice, watchListType } = req.body;

  try {
      const user = await User.findById(userId);
      
      if (watchListType === 'WatchList1') {
          user.watchList1Stocks.set(stockName, stockPrice);
      } else if (watchListType === 'WatchList2') {
          user.watchList2Stocks.set(stockName, stockPrice);
      }

      await user.save();
      res.status(200).json({ message: 'Stock price updated successfully!' });
  } catch (error) {
      res.status(500).json({ message: 'Error updating stock prices.', error });
  }
};

// Fetch stock prices when loading the PnL page
exports.fetchStockPrices = async (req, res) => {
  const { userId } = req.params;

  try {
      const user = await User.findById(userId);
      const watchList1Prices = user.watchList1Stocks || {};
      const watchList2Prices = user.watchList2Stocks || {};

      res.status(200).json({ watchList1Prices, watchList2Prices });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching stock prices.', error });
  }
};

// Remove stock when the user sells it
exports.sellStock = async (req, res) => {
  const { userId, stockName, watchListType } = req.body;

  try {
      const user = await User.findById(userId);

      if (watchListType === 'WatchList1') {
          user.watchList1Stocks.delete(stockName);
      } else if (watchListType === 'WatchList2') {
          user.watchList2Stocks.delete(stockName);
      }

      await user.save();
      res.status(200).json({ message: 'Stock sold and removed from list!' });
  } catch (error) {
      res.status(500).json({ message: 'Error selling stock.', error });
  }
};

// Fetch stock prices for a user (used in /user/:userId/stock-prices route)
exports.getUserStockPrices = async (req, res) => {
  const { userId } = req.params;

  try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const watchList1Prices = user.watchList1Stocks || {};
      const watchList2Prices = user.watchList2Stocks || {};

      res.status(200).json({ watchList1Prices, watchList2Prices });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching user stock prices.', error });
  }
};

// module.exports = { updateStockPrices, fetchStockPrices, sellStock };
