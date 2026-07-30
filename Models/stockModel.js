const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    watchlist1: {
        A: { type: Number, default: 0 },
        B: { type: Number, default: 0 },
    },
    watchlist2: {
        A: { type: Number, default: 0 },
        B: { type: Number, default: 0 },
    },
});

module.exports = mongoose.model('Stock', stockSchema);
