const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require("../Models/userModel");
const { clientIp } = require('../utils/clientIp');
const { sendWelcomeEmail } = require('../Services/emailService');
const { isLegitEmailAddress } = require('../Services/emailValidationService');

const signup = async (req, res) => {
    try {
        const { fullName, email, mobile, aadhaar, pan, password } = req.body;

        const signupIp = clientIp(req);
        const signupUserAgent = String(req.headers['user-agent'] || '');
        console.log('[Signup] attempt for email:', String(email || '').trim().toLowerCase(), 'ip:', signupIp || 'unknown');

        const existing = await User.findOne({
            $or: [{ email }, { mobile }, { aadhaar }, { pan }],
            isDeleted: { $ne: true },
        });
        if (existing) {
            let message = 'Account already exists, please login';
            if (existing.email === email) message = 'Email already exists, please login';
            else if (existing.mobile === mobile) message = 'Mobile number already registered';
            else if (existing.aadhaar === aadhaar) message = 'Aadhaar number already registered';
            else if (existing.pan === pan) message = 'PAN already registered';
            return res.status(409).json({ message, success: false });
        }

        const userModel = new User({ fullName, email, mobile, aadhaar, pan, password, signupIp, signupUserAgent });
        userModel.password = await bcrypt.hash(password, 10);
        await userModel.save();

        console.log('[Signup] created userId:', String(userModel._id), 'ip:', signupIp || 'unknown');

        // Welcome mail is best-effort: never block successful signup.
        if (isLegitEmailAddress(email)) {
            try {
                const mailResult = await sendWelcomeEmail({ email, fullName });
                if (!mailResult.ok) {
                    console.warn('[Signup] Welcome email not sent:', mailResult.error || mailResult.skipped);
                }
            } catch (mailErr) {
                console.warn('[Signup] Welcome email error:', mailErr.message || mailErr);
            }
        } else {
            console.log('[Signup] Skipping welcome email — address not treated as legit:', String(email || '').trim().toLowerCase());
        }

        res.status(201).json({ message: "Signup successful", success: true });
    } catch (err) {
        console.error("Signup error:", err);
        if (err?.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({
                message: `${field} is already registered`,
                success: false,
            });
        }
        res.status(500).json({ message: "Internal server error", success: false });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, isDeleted: { $ne: true } });
        const errorMsg = 'Auth failed, email or password is incorrect';
        if (!user) {
            return res.status(403)
                .json({ message: errorMsg, success: false });
        }

        const isPassEqual = await bcrypt.compare(password, user.password);
        if (!isPassEqual) {
            return res.status(403)
                .json({ message: errorMsg, success: false });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('Login error: JWT_SECRET is not set');
            return res.status(503).json({
                message: 'Server configuration error. Please contact support.',
                success: false,
            });
        }

        const jwtToken = jwt.sign(
            { email: user.email, _id: user._id },  // Include user ID in the token payload
            jwtSecret,
            { expiresIn: '24h' }
        );

        res.status(200)
            .json({
                message: "Login Success",
                success: true,
                jwtToken,
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                mobile: user.mobile,
            });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500)
            .json({
                message: "Internal server error",
                success: false
            });
    }
};


const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User no longer exists', success: false });
        }

        res.status(200).json({
            success: true,
            userId: user._id,
            email: user.email,
            fullName: user.fullName,
            mobile: user.mobile,
            balance: user.balance,
            plan: user.plan,
            isLiquidated: Boolean(user.isLiquidated),
        });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error', success: false });
    }
};

module.exports = {
    login,
    signup,
    getMe,
};
