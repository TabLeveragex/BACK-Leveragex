const mongoose = require('mongoose');

const BalanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
  },
  amount: {
    type: Number,
  },
  date: {
    type: Date,
  },
  method: {
    type: String,
  },
  status: {
    type: String,
  },
});

const Balance = mongoose.model('Balance', BalanceSchema);
module.exports = Balance;
