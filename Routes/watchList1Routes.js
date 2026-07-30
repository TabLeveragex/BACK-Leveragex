const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const WatchList1Stock = require('../Models/watchList1Model');
const { buyStock } = require('../Controllers/watchList1Controller');
const { isValidStockNumber, MIN_STOCK_VALUE, MAX_STOCK_VALUE } = require('../utils/stockValidation');
const { basePrice, livePrice } = require('../Services/priceEngine');
const { removeStockFromAllUserPortfolios } = require('../Services/watchlistStockLifecycleService');
const ensureAuthenticated = require('../Middlewares/auth');
const ensureAdmin = require('../Middlewares/adminAuth');

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

function toClientStock(stock) {
    const current = basePrice(stock);
    const live = livePrice(stock);
    return {
        _id: stock._id,
        symbol: stock.symbol || '',
        name: stock.name,
        trend: stock.trend || 'up',
        trendSince: stock.trendSince,
        createdAt: stock.createdAt,
        currentPrice: current,
        livePrice: live,
        // Trader pages render `price`; give them the moving live price.
        price: live,
    };
}

// Public route — traders and the admin table read prices here.
router.get('/', async (req, res) => {
    try {
        const stocks = await WatchList1Stock.find();

        // Backfill trend fields for stocks created before drifting was added.
        for (const stock of stocks) {
            if (!stock.trendSince) {
                stock.trend = stock.trend || 'up';
                stock.trendSince = new Date();
                await stock.save();
            }
        }

        res.json(stocks.map(toClientStock));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/buy', ensureAuthenticated, buyStock);

router.use(ensureAdmin);

// Add a stock: { symbol, name, currentPrice }
// Starts trending UP immediately from the given price.
router.post('/', async (req, res) => {
    const symbol = String(req.body.symbol || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const price = parseNumber(req.body.currentPrice ?? req.body.price);

    if (!symbol || !name || price === null || price <= 0) {
        return res.status(400).json({
            message: 'Symbol, company name and a price greater than 0 are required.',
        });
    }

    if (!isValidStockNumber(price)) {
        return res.status(400).json({
            message: `Price must be between ${MIN_STOCK_VALUE} and ${MAX_STOCK_VALUE}.`,
        });
    }

    const existing = await WatchList1Stock.findOne({ name });
    if (existing) {
        return res.status(409).json({
            message: `Stock "${name}" already exists. Remove the old one first or use a different name.`,
        });
    }

    try {
        const stock = await WatchList1Stock.create({
            symbol,
            name,
            price: Math.round(price * 100) / 100,
            trend: 'up',
            trendSince: new Date(),
        });
        res.status(201).json(toClientStock(stock));
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ message: `Stock "${name}" already exists.` });
        }
        res.status(400).json({ message: err.message });
    }
});

// Update a stock: { stockId, trend?: "up" | "down" | "neutral", currentPrice?: number }.
// Changing the trend re-anchors at the current drifted value so the price
// continues smoothly; setting currentPrice jumps the price there instantly
// and keeps trending from that value.
router.patch('/', async (req, res) => {
    const { stockId, trend, currentPrice } = req.body;
    const hasTrend = trend === 'up' || trend === 'down' || trend === 'neutral';
    const price = parseNumber(currentPrice);
    const hasPrice = price !== null && price > 0;

    if (!stockId || !mongoose.Types.ObjectId.isValid(String(stockId)) || (!hasTrend && !hasPrice)) {
        return res.status(400).json({ message: 'Invalid stockId, trend or currentPrice' });
    }

    if (hasPrice && !isValidStockNumber(price)) {
        return res.status(400).json({
            message: `Price must be between ${MIN_STOCK_VALUE} and ${MAX_STOCK_VALUE}.`,
        });
    }

    try {
        const stock = await WatchList1Stock.findById(stockId);
        if (!stock) {
            return res.status(404).json({ message: 'Stock not found' });
        }

        stock.price = hasPrice
            ? Math.round(price * 100) / 100
            : basePrice(stock);
        if (hasTrend) {
            stock.trend = trend;
        }
        stock.trendSince = new Date();
        await stock.save();

        res.status(200).json(toClientStock(stock));
    } catch (error) {
        console.error('Update watchlist stock error:', error);
        res.status(500).json({ message: error.message || 'Error updating stock' });
    }
});

// Remove a stock and clean it out of every user portfolio.
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock id' });
    }

    try {
        const stock = await WatchList1Stock.findByIdAndDelete(id);
        if (!stock) {
            return res.status(404).json({ message: 'Stock not found' });
        }

        const portfolioCleanup = await removeStockFromAllUserPortfolios(stock.name);

        return res.status(200).json({
            message: `Stock "${stock.name}" deleted`,
            usersPortfolioUpdated: portfolioCleanup.usersUpdated,
            holdersBefore: portfolioCleanup.holdersBefore,
        });
    } catch (error) {
        console.error('Delete watchlist stock error:', error);
        return res.status(500).json({ message: error.message || 'Error deleting stock' });
    }
});

module.exports = router;
