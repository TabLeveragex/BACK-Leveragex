// index.js
const express = require('express');
const helmet = require('helmet');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
require('./Models/db'); // Ensure database connection

// Import routes
const AuthRouter = require('./Routes/authRoutes.js');
const plansRouter = require('./Routes/plansRouter');
const stockRoutes = require('./Routes/stockRoutes.js');
const userRoutes = require('./Routes/userRoutes.js');
const watchList1Routes = require('./Routes/watchList1Routes.js');
const watchList2Routes = require('./Routes/watchList2Routes.js');
const pnlRoute = require('./Routes/pnlRoute.js');
const Congrats = require('./Models/congrats.js');
const Balance = require('./Models/BalanceHistory.js');

const payoutRoutes = require('./Routes/payout.js');
const WatchList1Stock = require('./Models/watchList1Model');
const { startLiquidationWatcher } = require('./Services/priceEngine');
const { backfillBalanceUserIds } = require('./Services/balanceHistoryService');
const ensureAuthenticated = require('./Middlewares/auth');
const ensureAdmin = require('./Middlewares/adminAuth');
const { ensureDefaultAdmin } = require('./Services/adminSeedService');
const { syncAdminEmailFromEnv } = require('./Services/adminEmailSyncService');
const { verifySmtpOnStartup } = require('./Services/emailService');
const { logRequiredEnvOnStartup } = require('./Services/requiredEnvService');
const User = require('./Models/userModel');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 8080;

logRequiredEnvOnStartup();

// CORS configuration to allow requests from multiple domains, including local dev
const allowedOrigins = [
  // 'https://leveragex.onrender.com',  // Old domain
  // 'https://leveragex.in',            // New domain
  // 'https://leveragex-frontend.onrender.com',
  // 'https://leveragex-kuxu.onrender.com',  // 11-jan-2025
  // 'https://leveragex-9ndu.onrender.com',     // 31-march-2025
  // 'https://leveragex-4p2t.onrender.com',
  // 'https://leveragex-oqsf.onrender.com',        // 31-may-2025
  // 'https://leveragex-rrf8.onrender.com',        // 1-aug-2025
  // 'https://leveragex-g6ll.onrender.com',        // current frontend (Render)
  // 'http://localhost:3000', 
  //  'http://localhost:5173', // 👈 ADD THIS (VERY COMMON)
  // 'http://127.0.0.1:3000',
  // 'http://127.0.0.1:5173',
  // 'https://leveragex-mj3f.onrender.com',
  'https://leveragex.shop',
  'https://www.leveragex.shop',
  // 'http://localhost:3000',
  // 'http://localhost:5173',
  // 'http://127.0.0.1:3000',
  // 'http://127.0.0.1:5173',
  'https://leveragex-p56c.onrender.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from specified origins or requests without origin (like postman)
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,POST,PUT,PATCH,DELETE',
  credentials: true,  // Enable credentials if needed for cookies or authentication
  optionsSuccessStatus: 200  // For legacy browser support
};

// Security headers (API + SPA cross-origin; does not block signup/CORS when configured below)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Middleware setup
app.use(bodyParser.json());  // For parsing application/json
app.use(cors(corsOptions));  // Enable CORS

// Preflight request handling for all routes (important for CORS)
app.options('*', cors(corsOptions));  // Handle preflight requests for all routes

// Route Definitions
app.use('/auth', AuthRouter);  // Authentication routes (login, signup)
app.use('/api/plans', plansRouter);  // Plans routes (buy, get plans)
app.use('/api/payments', require('./Routes/paymentRoutes'));
app.use('/api/stocks', stockRoutes);  // Stock-related routes
app.use('/api/users', userRoutes);  // User actions (balance, buy/sell stocks)
app.use('/api/watchlist1', watchList1Routes);  // WatchList 1 (Rapid plan)
app.use('/api/watchlist2', watchList2Routes);  // WatchList 2 (Evolution, Prime plans)
app.use('/api', pnlRoute);  // Profit and Loss route

app.use('/api/payout', payoutRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof Error) {
    // Handle CORS errors specifically
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ message: 'CORS Error: Request blocked.' });
    }
  }
  next(err);
});

app.post('/congrats', ensureAuthenticated, async (req, res) => {
  const { Username, Pancard, UpiId } = req.body;
  try {
    const NewCongrats = new Congrats({
      Username,
      Pancard,
      UpiId,
      userId: req.user.id,
    });
    await NewCongrats.save();
    res.json('Details submitted successfully');
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ message: 'Failed to submit details' });
  }
});

app.post('/putBalance', ensureAdmin, async (req, res) => {
  try {
    const { userId, name, amount, method, status, date } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'A valid userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const withdrawal = new Balance({
      userId: user._id,
      name,
      amount,
      method,
      status,
      date: date || new Date(),
    });

    await withdrawal.save();
    res.status(201).json(withdrawal);
  } catch (err) {
    res.status(500).json({ message: 'Error saving data', error: err });
  }
});

app.get('/putBalance', ensureAuthenticated, async (req, res) => {
  try {
    const data = await Balance.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching data', error: err });
  }
});

// WatchList1 prices are computed on read (drift + waves + jitter); this loop
// only evaluates the 10% liquidation rule against the drifting price.
startLiquidationWatcher(WatchList1Stock);

backfillBalanceUserIds()
  .then((result) => {
    if (result.updated > 0) {
      console.log(`Backfilled userId on ${result.updated} legacy withdrawal record(s)`);
    }
  })
  .catch((error) => {
    console.error('Balance history backfill error:', error);
  });

mongoose.connection.once('open', () => {
  ensureDefaultAdmin()
    .then(() => syncAdminEmailFromEnv())
    .catch((error) => {
      console.error('Admin seed/sync error:', error);
    });
  verifySmtpOnStartup().catch((error) => {
    console.error('SMTP startup verify error:', error);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
