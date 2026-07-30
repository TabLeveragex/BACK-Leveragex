const mongoose = require('mongoose');

const payInOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gatewayOrderId: { type: String, required: true, unique: true, index: true },
  productType: {
    type: String,
    enum: ['Evolution', 'Prime', 'CustomExclusive', 'AddFunds'],
    required: true,
  },
  amount: { type: Number, required: true },
  requestedAmount: { type: Number },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true,
  },
  paymentUrl: { type: String, default: '' },
  utr: { type: String, default: '' },
  gatewayStatus: { type: String, default: '' },
  orderAmount: { type: Number },
  realAmount: { type: Number },
  creditedAmount: { type: Number },
  paisaDeduction: { type: Number },
  fulfilledAt: { type: Date },
  failureReason: { type: String, default: '' },
}, { timestamps: true });

module.exports =
  mongoose.models.PayInOrder || mongoose.model('PayInOrder', payInOrderSchema);
