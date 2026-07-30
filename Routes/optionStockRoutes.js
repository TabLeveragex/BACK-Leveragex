const User = require('../Models/userModel');

const getUserStockPrices = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);

        // Fetch stock prices for WatchList1 and WatchList2
        const watchList1Prices = user.watchList1Stocks || {};
        const watchList2Prices = user.watchList2Stocks || {};

        res.status(200).json({ watchList1Prices, watchList2Prices });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock prices.', error });
    }
};

module.exports = { getUserStockPrices };
