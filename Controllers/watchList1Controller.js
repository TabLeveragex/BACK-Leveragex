const Stock = require('../Models/watchList1Model');
const User = require('../Models/userModel');
const {
  isValidStockNumber,
  normalizeBalance,
  normalizeQuantity,
  MAX_USER_BALANCE,
} = require('../utils/stockValidation');
const { clearLiquidationIfFunded } = require('../Services/liquidationService');
const { livePrice } = require('../Services/priceEngine');
const buyStock = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { stockName, quantity } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (clearLiquidationIfFunded(user)) {
      await user.save();
    }

    if (user.isLiquidated) {
      return res.status(403).json({ message: 'Account liquidated. Trading is not allowed.' });
    }

    // 2. Validate the stock by stockName
    const stock = await Stock.findOne({ name: stockName });
    if (!stock) return res.status(404).json({ message: 'Stock not found' });

    // 3. Calculate the total invested amount at the moving live price
    const stockPrice = livePrice(stock);
    const qty = normalizeQuantity(quantity);
    const investedAmount = stockPrice * qty;
    const currentBalance = normalizeBalance(user.balance);

    if (!isValidStockNumber(stockPrice)) {
      return res.status(400).json({ message: 'Stock price is invalid. Contact admin.' });
    }

    if (qty <= 0) {
      return res.status(400).json({ message: 'Invalid quantity (max 10,000 per trade)' });
    }

    if (currentBalance > MAX_USER_BALANCE) {
      return res.status(400).json({
        message: 'Account balance is invalid. Ask admin to reset your balance.',
      });
    }

    if (currentBalance < investedAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.balance = currentBalance - investedAmount;
    user.stocks.push({
      stockName: stock.name,
      buyPrice: stockPrice,
      quantity: qty,
      investedAmount: investedAmount,
      purchasedAt: new Date(),
    });

    clearLiquidationIfFunded(user);
    await user.save();

    res.status(200).json({ message: 'Stock purchased successfully', updatedBalance: user.balance });
  } catch (error) {
    console.error('Error during stock purchase:', error);
    res.status(500).json({ message: 'Error purchasing stock' });
  }
};


module.exports = { buyStock };
