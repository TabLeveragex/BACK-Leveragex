const mongoose = require('mongoose');

// `price` is the anchor price: the last value set by the admin (or at add
// time). The moving price is computed from it — see Services/priceEngine.js.
const watchList1StockSchema = new mongoose.Schema({
    symbol: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true },
    trend: { type: String, enum: ['up', 'down', 'neutral'], default: 'up' },
    trendSince: { type: Date, default: Date.now },
    // Legacy fields kept so old documents still load.
    watchlist1_A: { type: Number },
    watchlist1_B: { type: Number },
    priceTrend: { type: String, enum: ['up', 'down'] },
}, {
    timestamps: true,
});

module.exports = mongoose.models.WatchList1Stock
    || mongoose.model('WatchList1Stock', watchList1StockSchema);
