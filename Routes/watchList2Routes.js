const express = require('express');
const router = express.Router();
const WatchList2Stock = require('../Models/watchList2Model');
const { buyStock } = require('../Controllers/watchList2Controller');
const { validateStockFields } = require('../utils/stockValidation');
const { setWatchlistTrend } = require('../Services/priceFluctuation');

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

router.post('/trend-all', async (req, res) => {
    const { trend } = req.body;

    if (trend !== 'up' && trend !== 'down') {
        return res.status(400).json({ message: 'Trend must be "up" or "down".' });
    }

    try {
        const result = await setWatchlistTrend('watchlist2', trend);
        res.status(200).json({
            message: `All WatchList2 stocks trending ${trend}`,
            updated: result.updated,
        });
    } catch (error) {
        console.error('Error setting watchlist trend:', error);
        res.status(500).json({ message: 'Error setting watchlist trend' });
    }
});

// Fetch all stocks for WatchList2
router.get('/', async (req, res) => {
    try {
        const stocks = await WatchList2Stock.find();
        res.json(stocks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add new stock to WatchList2
router.post('/', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const price = parseNumber(req.body.price);
    const watchlist2_A = parseNumber(req.body.watchlist2_A);
    const watchlist2_B = parseNumber(req.body.watchlist2_B);

    if (!name || price === null || watchlist2_A === null || watchlist2_B === null) {
        return res.status(400).json({ message: 'Valid stock name, price, A, and B values are required.' });
    }

    const validation = validateStockFields({ price, a: watchlist2_A, b: watchlist2_B });
    if (!validation.ok) {
        return res.status(400).json({ message: validation.message });
    }

    const stock = new WatchList2Stock({
        name,
        price,
        watchlist2_A,
        watchlist2_B
    });
    try {
        const newStock = await stock.save();
        res.status(201).json(newStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update stock price and A/B values for WatchList2
router.put('/:id', async (req, res) => {
    const A = parseNumber(req.body.A);
    const B = parseNumber(req.body.B);

    if (A === null || B === null) {
        return res.status(400).json({ error: 'Valid A and B values are required.' });
    }

    const validation = validateStockFields({ price: B, a: A, b: B });
    if (!validation.ok) {
        return res.status(400).json({ error: validation.message });
    }

    try {
        const stock = await WatchList2Stock.findByIdAndUpdate(
            req.params.id,
            { watchlist2_A: A, watchlist2_B: B },
            { new: true }
        );
        
        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }
        res.status(200).json(stock);
    } catch (error) {
        res.status(500).json({ error: 'Error updating stock A and B values' });
    }
});

// Route to buy a stock
router.post('/buy', buyStock);

module.exports = router;
