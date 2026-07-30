const Stock = require('../Models/stockModel');

// Update stock price for a specific watchlist
exports.updateStockPrice = async (req, res) => {
  const { stockId, price, watchList } = req.body; // Include watchList in request body

  if (!stockId || price === undefined || !watchList) {
    return res.status(400).json({ error: 'Stock ID, price, and watchList are required' });
  }

  try {
    const stock = await Stock.findById(stockId);

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    if (watchList === 1) {
      stock.watchList1.price = price;
    } else if (watchList === 2) {
      stock.watchList2.price = price;
    } else {
      return res.status(400).json({ error: 'Invalid WatchList specified' });
    }

    await stock.save();
    res.json({ message: 'Stock price updated successfully', stock });
  } catch (error) {
    res.status(500).json({ error: 'Error updating stock price' });
  }
};
