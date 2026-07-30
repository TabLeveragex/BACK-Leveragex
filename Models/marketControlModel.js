const mongoose = require('mongoose');

const MarketControlSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'watchlist1', unique: true },
    plusMinusToggleEnabled: { type: Boolean, default: false },
    abModeEnabled: { type: Boolean, default: false },
    fluctuationEnabled: { type: Boolean, default: false },
    globalMarketTrend: { type: String, enum: ['up', 'down', null], default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MarketControl || mongoose.model('MarketControl', MarketControlSchema);
