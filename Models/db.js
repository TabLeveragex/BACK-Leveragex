const path = require('path');
const mongoose = require('mongoose');
const { logDatabaseHealthOnStartup } = require('../Services/databaseHealthService');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const mongoUrl = process.env.MONGO_CONN;

if (!mongoUrl) {
  console.error('❌ MongoDB connection failed: MONGO_CONN is missing in .env');
} else {
  console.log('Attempting MongoDB connection...');

  mongoose
    .connect(mongoUrl, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log('✅ MongoDB Connected:', mongoose.connection.name);
      logDatabaseHealthOnStartup(mongoose.connection);
    })
    .catch((err) => {
  console.error('❌ MongoDB Connection Error:', err);
});
}

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

module.exports = mongoose;
