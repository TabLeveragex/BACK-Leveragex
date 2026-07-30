// Quick sanity check of the computed price model (no DB needed).
const { basePrice, livePrice } = require('../Services/priceEngine');

const now = Date.now();
const mk = (trend, secondsAgo) => ({
  _id: 'stock-abc-123',
  name: 'TCS',
  price: 100,
  trend,
  trendSince: new Date(now - secondsAgo * 1000),
});

let failures = 0;
const assert = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};

// At t=0 the base price equals the anchor (wave is anchored to 0).
const p0 = basePrice(mk('up', 0));
assert('t=0 base equals anchor', Math.abs(p0 - 100) < 0.6, `base=${p0}`);

// After 60s of up trend: anchor + 30 drift, within wave amplitude (±5.8).
const p60up = basePrice(mk('up', 60));
assert('60s up drift ~ +30', p60up > 100 + 30 - 6 && p60up < 100 + 30 + 6, `base=${p60up}`);

// After 60s of down trend: anchor - 30 drift, within wave amplitude.
const p60dn = basePrice(mk('down', 60));
assert('60s down drift ~ -30', p60dn > 100 - 30 - 6 && p60dn < 100 - 30 + 6, `base=${p60dn}`);

// Live price stays within ±3 of the base price.
const stock = mk('up', 30);
const base = basePrice(stock);
let inRange = true;
let min = Infinity, max = -Infinity;
for (let i = 0; i < 500; i++) {
  const lp = livePrice(stock);
  min = Math.min(min, lp);
  max = Math.max(max, lp);
  if (Math.abs(lp - base) > 3.01) inRange = false;
}
assert('live within ±3 of base', inRange, `base=${base} live range=[${min}, ${max}]`);

// Price never goes below the floor even on a long down trend.
const pFloor = basePrice(mk('down', 100000));
assert('price floored at minimum', pFloor >= 1, `base=${pFloor}`);

process.exit(failures === 0 ? 0 : 1);
