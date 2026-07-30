const mongoose = require('mongoose');

const watchList2StockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    watchlist2_A: { type: Number, required: true },
    watchlist2_B: { type: Number, required: true },
    priceTrend: { type: String, enum: ['up', 'down'] },
});

let WatchList2Stock;
if (mongoose.models.WatchList2Stock) {
    WatchList2Stock = mongoose.model('WatchList2Stock');
    if (!WatchList2Stock.schema.paths.priceTrend) {
        WatchList2Stock.schema.add({ priceTrend: { type: String, enum: ['up', 'down'] } });
    }
} else {
    WatchList2Stock = mongoose.model('WatchList2Stock', watchList2StockSchema);
}

module.exports = WatchList2Stock;
