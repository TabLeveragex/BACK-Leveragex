const MarketControl = require('../Models/marketControlModel');

const SINGLETON_KEY = 'watchlist1';

async function loadMarketControlSettings() {
  let doc = await MarketControl.findOne({ singletonKey: SINGLETON_KEY });
  if (!doc) {
    doc = await MarketControl.create({ singletonKey: SINGLETON_KEY });
  }
  return {
    plusMinusToggleEnabled: Boolean(doc.plusMinusToggleEnabled),
    abModeEnabled: Boolean(doc.abModeEnabled),
    fluctuationEnabled: Boolean(doc.fluctuationEnabled),
    globalMarketTrend:
      doc.globalMarketTrend === 'up' || doc.globalMarketTrend === 'down'
        ? doc.globalMarketTrend
        : null,
  };
}

async function saveMarketControlSettings(settings) {
  await MarketControl.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    {
      $set: {
        plusMinusToggleEnabled: Boolean(settings.plusMinusToggleEnabled),
        abModeEnabled: Boolean(settings.abModeEnabled),
        fluctuationEnabled: Boolean(settings.fluctuationEnabled),
        globalMarketTrend:
          settings.globalMarketTrend === 'up' || settings.globalMarketTrend === 'down'
            ? settings.globalMarketTrend
            : null,
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = {
  loadMarketControlSettings,
  saveMarketControlSettings,
};
