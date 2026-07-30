const express = require('express');
const {
    getStocks,
    buyStock,
    updateStockPrice,
    addStock,
    updateStockValues // Import the new controller for updating stock values
} = require('../Controllers/stockController');
const router = express.Router();

// Route to get all stocks
router.get('/', getStocks);

// Route to buy a stock
router.post('/buy', buyStock);

// Route to update stock price
router.put('/:stockId', updateStockPrice);

// Route to add a new stock
router.post('/', addStock);

// Route to update A and B values for WatchList1 and WatchList2
router.put('/:stockId/values', updateStockValues);  // New route for updating A and B values

module.exports = router;
