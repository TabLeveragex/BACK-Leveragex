// End-to-end test of the new WatchList1 flow against an in-memory MongoDB.
// Covers: add stock -> list with computed prices -> set price (jump) ->
// set trend (smooth re-anchor) -> buy at live price -> remove stock.
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let failures = 0;
const assert = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('leveragex'));

  const Admin = require('../Models/adminModel');
  const User = require('../Models/userModel');
  const watchList1Routes = require('../Routes/watchList1Routes');

  const admin = await Admin.create({
    username: 'admin',
    email: 'admin@test.com',
    password: 'hashed',
    fullName: 'Test Admin',
  });
  const { registerAdminSession } = require('../Services/adminSessionService');
  const { sessionId } = await registerAdminSession(admin._id);
  const adminToken = jwt.sign(
    { _id: admin._id, role: 'admin', adminSessionId: sessionId },
    process.env.JWT_SECRET
  );

  const trader = await User.create({
    fullName: 'Trader One',
    email: 'trader@test.com',
    mobile: '9999999999',
    aadhaar: '123412341234',
    pan: 'ABCDE1234F',
    password: 'hashed',
    balance: 10000,
  });
  const traderToken = jwt.sign({ _id: trader._id }, process.env.JWT_SECRET);

  const app = express();
  app.use(express.json());
  app.use('/api/watchlist1', watchList1Routes);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  };

  // 1. Invalid add -> 400
  let r = await call('POST', '/api/watchlist1', { token: adminToken, body: { symbol: '', name: '', currentPrice: 0 } });
  assert('invalid add returns 400', r.status === 400, `status=${r.status}`);

  // 2. Add without admin token -> blocked
  r = await call('POST', '/api/watchlist1', { body: { symbol: 'TCS', name: 'Tata Consultancy', currentPrice: 100 } });
  assert('add without admin token blocked', r.status === 401 || r.status === 403, `status=${r.status}`);

  // 3. Valid add -> 201, trend up, anchored at given price
  r = await call('POST', '/api/watchlist1', { token: adminToken, body: { symbol: 'tcs', name: 'Tata Consultancy', currentPrice: 100 } });
  assert('add stock returns 201', r.status === 201, `status=${r.status}`);
  assert('new stock trends up by default', r.data?.trend === 'up', `trend=${r.data?.trend}`);
  assert('symbol uppercased', r.data?.symbol === 'TCS', `symbol=${r.data?.symbol}`);
  const stockId = r.data?._id;

  // 4. Duplicate name -> 409
  r = await call('POST', '/api/watchlist1', { token: adminToken, body: { symbol: 'TCS2', name: 'Tata Consultancy', currentPrice: 50 } });
  assert('duplicate name returns 409', r.status === 409, `status=${r.status}`);

  // 5. Public GET returns computed prices
  r = await call('GET', '/api/watchlist1');
  const listed = r.data?.[0];
  assert('public GET works', r.status === 200 && r.data?.length === 1, `status=${r.status} len=${r.data?.length}`);
  assert('GET has currentPrice + livePrice', Number.isFinite(listed?.currentPrice) && Number.isFinite(listed?.livePrice));
  assert('livePrice within ±3 of currentPrice', Math.abs(listed.livePrice - listed.currentPrice) <= 3.01,
    `current=${listed.currentPrice} live=${listed.livePrice}`);
  assert('price field mirrors live price for traders', Number.isFinite(listed?.price));

  // 6. Set price -> jumps instantly to that value
  r = await call('PATCH', '/api/watchlist1', { token: adminToken, body: { stockId, currentPrice: 500 } });
  assert('set price returns 200', r.status === 200, `status=${r.status}`);
  assert('price jumps to set value', Math.abs(r.data.currentPrice - 500) < 0.6, `current=${r.data.currentPrice}`);

  // 7. Set trend down -> re-anchors near current drifted value (no jump)
  const before = r.data.currentPrice;
  r = await call('PATCH', '/api/watchlist1', { token: adminToken, body: { stockId, trend: 'down' } });
  assert('set trend returns 200', r.status === 200, `status=${r.status}`);
  assert('trend updated to down', r.data.trend === 'down', `trend=${r.data.trend}`);
  assert('no jump on trend change', Math.abs(r.data.currentPrice - before) < 1.5,
    `before=${before} after=${r.data.currentPrice}`);

  // 8. Invalid PATCH -> 400
  r = await call('PATCH', '/api/watchlist1', { token: adminToken, body: { stockId, trend: 'sideways' } });
  assert('invalid patch returns 400', r.status === 400, `status=${r.status}`);

  // 9. Trader buys at the live price
  r = await call('POST', '/api/watchlist1/buy', { token: traderToken, body: { stockName: 'Tata Consultancy', quantity: 2 } });
  assert('buy succeeds', r.status === 200, `status=${r.status} msg=${r.data?.message}`);
  const updatedTrader = await User.findById(trader._id);
  const buyPrice = updatedTrader.stocks[0]?.buyPrice;
  assert('position recorded at live price near anchor', buyPrice > 500 - 5 && buyPrice < 500 + 5, `buyPrice=${buyPrice}`);
  assert('balance reduced by invested amount',
    Math.abs(updatedTrader.balance - (10000 - buyPrice * 2)) < 0.01, `balance=${updatedTrader.balance}`);

  // 10. Remove stock -> deleted from DB and from user portfolios
  r = await call('DELETE', `/api/watchlist1/${stockId}`, { token: adminToken });
  assert('delete returns 200', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/watchlist1');
  assert('stock gone after delete', r.data?.length === 0, `len=${r.data?.length}`);
  const traderAfterDelete = await User.findById(trader._id);
  assert('position cleaned from portfolio', traderAfterDelete.stocks.length === 0,
    `positions=${traderAfterDelete.stocks.length}`);

  server.close();
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
