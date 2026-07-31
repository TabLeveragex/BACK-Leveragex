const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../Models/adminModel');
const { logAdminLoginAttempt } = require('../Services/adminAuditService');
const {
  hasActiveAdminSession,
  registerAdminSession,
} = require('../Services/adminSessionService');
const { sendAdminOtpEmail } = require('../Services/emailService');
const {
  createAdminOtpChallenge,
  verifyAdminOtpChallenge,
  getAdminOtpRecipientEmail,
} = require('../Services/adminOtpService');

const ACTIVE_SESSION_MSG =
  'Another admin is already logged in. Only one admin session is allowed. Delete the lock in MongoDB collection adminactivesessions to allow a new login.';

const adminLogin = async (req, res) => {
  const { loginId, password, traderSessionWasActive = false } = req.body;
  const normalizedLoginId = String(loginId || '').trim().toLowerCase();
  const hadTraderSession = Boolean(traderSessionWasActive);

  try {
    const admin = await Admin.findOne({
      $or: [{ email: normalizedLoginId }, { username: normalizedLoginId }],
    });

    const errorMsg = 'Invalid admin email/username or password';
    if (!admin) {
      await logAdminLoginAttempt(req, {
        loginId: normalizedLoginId,
        success: false,
        stage: 'credentials_failed',
        failureReason: 'invalid_credentials',
        traderSessionWasActive: hadTraderSession,
      });
      return res.status(403).json({ message: errorMsg, success: false });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password);
    if (!passwordMatches) {
      await logAdminLoginAttempt(req, {
        loginId: normalizedLoginId,
        success: false,
        stage: 'credentials_failed',
        failureReason: 'invalid_credentials',
        traderSessionWasActive: hadTraderSession,
      });
      return res.status(403).json({ message: errorMsg, success: false });
    }

    if (await hasActiveAdminSession()) {
      await logAdminLoginAttempt(req, {
        loginId: normalizedLoginId,
        success: false,
        stage: 'session_blocked',
        failureReason: 'active_session',
        traderSessionWasActive: hadTraderSession,
      });
      return res.status(409).json({ message: ACTIVE_SESSION_MSG, success: false });
    }

    const otpRecipient = getAdminOtpRecipientEmail();
    if (!otpRecipient) {
      return res.status(503).json({
        message: 'ADMIN_EMAIL is not configured. Cannot send login code.',
        success: false,
      });
    }

    const { challengeToken, otp } = await createAdminOtpChallenge(admin._id);
    console.log(`[AdminLogin] Sending OTP to ${otpRecipient}`);

    const mailResult = await sendAdminOtpEmail({
      email: otpRecipient,
      fullName: admin.fullName,
      otp,
    });

    if (!mailResult.ok) {
      // Render/cloud hosts often block Gmail SMTP. Keep 2FA challenge alive and
      // print the code in logs so admin can finish login while SMTP is fixed.
      console.error(
        '[AdminLogin] OTP email failed:',
        mailResult.error || mailResult.skipped,
        mailResult.code || '',
        mailResult.responseCode || ''
      );
      console.warn(
        `[AdminLogin] OTP_FALLBACK recipient=${otpRecipient} code=${otp} (use this code in the OTP screen)`
      );
    }

    await logAdminLoginAttempt(req, {
      loginId: normalizedLoginId,
      success: false,
      stage: mailResult.ok ? 'otp_sent' : 'otp_email_failed_fallback',
      otpSentTo: otpRecipient,
      traderSessionWasActive: hadTraderSession,
    });

    return res.status(200).json({
      message: mailResult.ok
        ? 'Verification code sent to your admin email.'
        : 'Email send failed on server. Open Render logs and search OTP_FALLBACK for your code, then enter it here.',
      success: true,
      requiresOtp: true,
      challengeToken,
      otpSentTo: otpRecipient,
      emailDeliveryFailed: !mailResult.ok,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    await logAdminLoginAttempt(req, {
      loginId: normalizedLoginId,
      success: false,
      stage: 'server_error',
      failureReason: 'server_error',
      traderSessionWasActive: hadTraderSession,
    });
    res.status(500).json({ message: 'Internal server error', success: false });
  }
};

const adminVerifyOtp = async (req, res) => {
  const { challengeToken, otp, traderSessionWasActive = false } = req.body;
  const hadTraderSession = Boolean(traderSessionWasActive);

  try {
    const adminId = await verifyAdminOtpChallenge(challengeToken, otp);
    if (!adminId) {
      await logAdminLoginAttempt(req, {
        loginId: 'otp_verify',
        success: false,
        stage: 'otp_failed',
        failureReason: 'invalid_otp',
        traderSessionWasActive: hadTraderSession,
      });
      return res.status(403).json({
        message: 'Invalid or expired verification code.',
        success: false,
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(403).json({ message: 'Admin account not found.', success: false });
    }

    if (await hasActiveAdminSession()) {
      await logAdminLoginAttempt(req, {
        loginId: admin.email,
        success: false,
        stage: 'session_blocked',
        failureReason: 'active_session',
        traderSessionWasActive: hadTraderSession,
      });
      return res.status(409).json({ message: ACTIVE_SESSION_MSG, success: false });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('Admin OTP verify error: JWT_SECRET is not set');
      return res.status(503).json({
        message: 'Server configuration error. Please contact support.',
        success: false,
      });
    }

    const { sessionId } = await registerAdminSession(admin._id);
    const jwtToken = jwt.sign(
      {
        email: admin.email,
        _id: admin._id,
        role: 'admin',
        adminSessionId: sessionId,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    await logAdminLoginAttempt(req, {
      loginId: admin.email,
      success: true,
      stage: 'login_success',
      traderSessionWasActive: hadTraderSession,
    });

    return res.status(200).json({
      message: 'Admin login successful',
      success: true,
      jwtToken,
      adminId: admin._id,
      email: admin.email,
      username: admin.username,
      fullName: admin.fullName,
    });
  } catch (err) {
    console.error('Admin OTP verify error:', err);
    res.status(500).json({ message: 'Internal server error', success: false });
  }
};

const getAdminMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      adminId: req.admin.id,
      email: req.admin.email,
      username: req.admin.username,
      fullName: req.admin.fullName,
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', success: false });
  }
};

const adminLogout = async (req, res) => {
  try {
    // Local logout only — MongoDB adminactivesessions lock stays until deleted manually.
    res.status(200).json({ message: 'Logged out', success: true });
  } catch (err) {
    console.error('Admin logout error:', err);
    res.status(500).json({ message: 'Internal server error', success: false });
  }
};

module.exports = {
  adminLogin,
  adminVerifyOtp,
  adminLogout,
  getAdminMe,
};
