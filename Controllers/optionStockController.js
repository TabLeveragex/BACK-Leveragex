const User = require('../Models/userModel');

const updateStockPrices = async (userId, stockName, price, watchListType) => {
    const user = await User.findById(userId);
    if (watchListType === 'WatchList1') {
        user.watchList1Stocks.set(stockName, price);
    } else {
        user.watchList2Stocks.set(stockName, price);
    }
    await user.save();
};

// Call this function after a stock is bought
const buyStock = async (req, res) => {
    const { userId, stockName, price, quantity, watchListType } = req.body;

    try {
        // Update stock prices in user record
        await updateStockPrices(userId, stockName, price, watchListType);

        // Other logic for updating user's portfolio, balance, etc.
        
        res.status(200).json({ message: 'Stock bought successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error buying stock.', error });
    }
};

module.exports = { buyStock };
