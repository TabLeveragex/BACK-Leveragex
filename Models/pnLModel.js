// models/PnL.js
const mongoose = require('mongoose');

const pnlSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // assuming you have a User model
        required: true
    },
    stocks: [
        {
            stockName: String,
            buyPrice: Number,
            currentPrice: Number,
            quantity: Number,
            profitLoss: Number
        }
    ],
    totalBalance: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const PnL = mongoose.model('PnL', pnlSchema);
module.exports = PnL;
