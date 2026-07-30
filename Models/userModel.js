const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    fullName: {
        type: String,
        required: true,
    },
    email: {  // Added email field
        type: String,
        required: true,
        unique: true
    },
    mobile: {
        type: String,
        required: true,
        unique: true
    },
    aadhaar: {
        type: String,
        required: true,
        unique: true,
    },
    pan: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    signupIp: {
        type: String,
        default: '',
    },
    signupUserAgent: {
        type: String,
        default: '',
    },
    balance: {
        type: Number,
        default: 0
    },
    isLiquidated: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    deletionReason: {
        type: String,
        default: null,
    },
    hasBoughtRapidPlan: {
        type: Boolean,
        default: false,  // User can buy the Rapid plan only once
    },
    plan: {
        type: String,
        enum: ['Rapid', 'Evolution', 'Prime'],
        default: null
    }, // Store current plan
    stocks: [{
        stockName: String,  // Store stock name
        buyPrice: Number,
        quantity: Number,
        investedAmount: Number,  // Track invested amount separately
        sellPrice: Number,
        purchasedAt: { type: Date, default: Date.now },
    }],
    payoutStatus: {
        type: String,
        enum: ['Enable', 'Disable', 'Pending'],
        default: 'Disable'
      },      
}, {
    timestamps: true,
});

// Use the following to avoid the OverwriteModelError:
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = UserModel;
