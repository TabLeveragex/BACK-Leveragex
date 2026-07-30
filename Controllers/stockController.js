const Stock = require('../Models/stockModel');
const User = require('../Models/userModel');

// Fetch all stocks
const getStocks = async (req, res) => {
  try {
    const stocks = await Stock.find();
    res.status(200).json(stocks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stocks' });
  }
};

// Buy stock from WatchList
const buyStock = async (req, res) => {
  const { userId, stockId, price, watchList } = req.body; // watchList can be 1 or 2

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.balance < price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const stock = await Stock.findById(stockId);
    if (!stock) return res.status(404).json({ message: 'Stock not found' });

    // Deduct balance and add stock to user's list
    user.balance -= price;
    user.stocks.push({ stockId, watchList });
    await user.save();

    res.status(200).json({ message: 'Stock purchased successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error purchasing stock' });
  }
};

// Update stock price for a specific watchlist
const updateStockPrice = async (req, res) => {
  const { stockId } = req.params;
  const { price, watchList } = req.body; // watchList can be 1 or 2

  try {
    const stock = await Stock.findById(stockId);
    if (!stock) return res.status(404).json({ message: 'Stock not found' });

    if (watchList === 1) {
      stock.watchList1.price = price;
    } else if (watchList === 2) {
      stock.watchList2.price = price;
    } else {
      return res.status(400).json({ message: 'Invalid WatchList specified' });
    }

    await stock.save();
    res.status(200).json({ message: 'Stock price updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating stock price' });
  }
};

// Add a new stock
const addStock = async (req, res) => {
  const { name, price, watchList1, watchList2 } = req.body;

  if (!name || !price || !watchList1 || !watchList2) {
    return res.status(400).json({ message: 'Stock name, price, and watchList ranges are required.' });
  }

  try {
    const newStock = new Stock({ name, price, watchList1, watchList2 });
    await newStock.save();
    res.status(201).json(newStock);
  } catch (error) {
    res.status(500).json({ message: 'Error adding stock.', error });
  }
};

// Update A and B values for WatchList1 and WatchList2
const updateStockValues = async (req, res) => {
  const { stockId } = req.params;
  const { watchList1, watchList2 } = req.body; // The new A and B values for each watchlist

  try {
    const stock = await Stock.findById(stockId);
    if (!stock) return res.status(404).json({ message: 'Stock not found' });

    // Update values for WatchList1
    if (watchList1 && watchList1.A && watchList1.B) {
      stock.watchList1.A = watchList1.A;
      stock.watchList1.B = watchList1.B;
    }

    // Update values for WatchList2
    if (watchList2 && watchList2.A && watchList2.B) {
      stock.watchList2.A = watchList2.A;
      stock.watchList2.B = watchList2.B;
    }

    await stock.save();
    res.status(200).json({ message: 'Stock values updated successfully!', stock });
  } catch (error) {
    res.status(500).json({ message: 'Error updating stock values', error });
  }
};

module.exports = {
  getStocks,
  buyStock,
  updateStockPrice,
  addStock,
  updateStockValues,
};
