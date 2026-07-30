const express = require('express');
const router = express.Router();
const { updateBalance, updateStockPrice, getAllUsers, getAllStocks, createStock } = require('../Controllers/adminController');

// Route to get all users (for admin)
router.get('/users', getAllUsers);

// Route to get all stocks (for admin)
router.get('/stocks', getAllStocks);

// Route to update user balance
router.post('/update-balance', updateBalance);

// Route to update stock price
router.post('/update-stock-price', updateStockPrice);

// Route to create a new stock
router.post('/create-stock', createStock);

module.exports = router;
