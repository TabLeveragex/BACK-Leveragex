const { signup, login, getMe } = require('../Controllers/authController');
const {
  adminLogin,
  adminVerifyOtp,
  adminLogout,
  getAdminMe,
} = require('../Controllers/adminAuthController');
const {
  signupValidation,
  loginValidation,
  adminLoginValidation,
  adminVerifyOtpValidation,
} = require('../Middlewares/authValidation');
const { signupRateLimit } = require('../Middlewares/signupRateLimit');
const { blockListedIps } = require('../Middlewares/ipBlocklist');
const ensureAuthenticated = require('../Middlewares/auth');
const ensureAdmin = require('../Middlewares/adminAuth');

const router = require('express').Router();

const registrationHandlers = [
  blockListedIps,
  signupRateLimit,
  signupValidation,
  signup,
];

router.post('/login', loginValidation, login);
router.post('/signup', registrationHandlers);
router.post('/register', registrationHandlers);
router.get('/me', ensureAuthenticated, getMe);

router.post('/admin/login', adminLoginValidation, adminLogin);
router.post('/admin/verify-otp', adminVerifyOtpValidation, adminVerifyOtp);
router.post('/admin/logout', adminLogout);
router.get('/admin/me', ensureAdmin, getAdminMe);

module.exports = router;
