const Joi = require('joi');
const { formatJoiError } = require('../Services/requiredEnvService');

const signupValidation = (req, res, next) => {
    const schema = Joi.object({
        fullName: Joi.string().min(3).max(100).required(),
        email: Joi.string().email().required(),  // Added email validation
        mobile: Joi.string().pattern(new RegExp('^[0-9]{10}$')).required(),
        aadhaar: Joi.string().min(12).max(12).required(),
        pan: Joi.string().alphanum().length(10).required(),
        password: Joi.string().min(4).max(100).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400)
            .json({ message: formatJoiError(error), success: false, error });
    }
    next();
};

const loginValidation = (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),  // Validate email in login
        password: Joi.string().min(4).max(100).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400)
            .json({ message: formatJoiError(error), success: false, error });
    }
    next();
};

const adminLoginValidation = (req, res, next) => {
    const schema = Joi.object({
        loginId: Joi.string().min(3).max(100).required(),
        password: Joi.string().min(4).max(100).required(),
        traderSessionWasActive: Joi.boolean().optional(),
        hcaptchaToken: Joi.string().min(20).max(4096).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: formatJoiError(error), success: false, error });
    }
    next();
};

const adminVerifyOtpValidation = (req, res, next) => {
    const schema = Joi.object({
        challengeToken: Joi.string().min(32).max(128).required(),
        otp: Joi.string().pattern(/^\d{6}$/).required(),
        traderSessionWasActive: Joi.boolean().optional(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: formatJoiError(error), success: false, error });
    }
    next();
};

module.exports = {
    signupValidation,
    loginValidation,
    adminLoginValidation,
    adminVerifyOtpValidation,
};
