const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../Models/adminModel');
const { getClientIp, logAdminLoginAttempt } = require('../Services/adminAuditService');
const { sendAdminOtpEmail } = require('../Services/emailService');
const { getAdminOtpRecipientEmail } = require('../Services/adminOtpRecipientService');
const {
  createAdminOtpChallenge,
  verifyAdminOtpChallenge,
} = require('../Services/adminOtpService');
const {
  hasActiveAdminSession,
  registerAdminSession,
  clearAdminSessionById,
} = require('../Services/adminSessionService');

const ACTIVE_SESSION_MSG =
  'Another admin is already logged in. Only one admin can use the dashboard at a time.';

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

    // When SMTP is unavailable, set ADMIN_SKIP_OTP=true on Render to finish login
    // after captcha + password (same JWT session as the OTP path).
    const skipOtp =
      String(process.env.ADMIN_SKIP_OTP || '').trim().toLowerCase() === 'true' ||
      String(process.env.ADMIN_SKIP_OTP || '').trim() === '1';

    if (skipOtp) {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('Admin login error: JWT_SECRET is not set');
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
    }

    const { challengeToken, otp } = await createAdminOtpChallenge(admin._id);
    const otpRecipient = getAdminOtpRecipientEmail(admin);
    if (!otpRecipient) {
      return res.status(503).json({
        message: 'Admin email is not configured. Set ADMIN_EMAIL to your real Gmail on Render.',
        success: false,
      });
    }

    console.log(`[AdminLogin] Sending OTP to ${otpRecipient} (admin record: ${admin.email})`);

    const mailResult = await sendAdminOtpEmail({
      email: otpRecipient,
      fullName: admin.fullName,
      otp,
    });
    if (!mailResult.ok) {
      await logAdminLoginAttempt(req, {
        loginId: normalizedLoginId,
        success: false,
        stage: 'otp_email_failed',
        failureReason: 'email_failed',
        traderSessionWasActive: hadTraderSession,
      });
      const message =
        mailResult.skipped
          ? 'Email service is not configured. Admin login cannot continue.'
          : 'Could not send admin login code. Check Gmail App Password on Render and redeploy.';
      console.error('[AdminLogin] OTP email failed:', mailResult.error, mailResult.responseCode || '');
      return res.status(503).json({ message, success: false });
    }

    await logAdminLoginAttempt(req, {
      loginId: normalizedLoginId,
      success: false,
      stage: 'otp_sent',
      otpSentTo: otpRecipient,
      traderSessionWasActive: hadTraderSession,
    });

    res.status(200).json({
      message: 'Verification code sent to your admin email.',
      success: true,
      requiresOtp: true,
      challengeToken,
      otpSentTo: otpRecipient,
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

    res.status(200).json({
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

function extractAdminToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return header || null;
}

const adminLogout = async (req, res) => {
  try {
    const token = extractAdminToken(req);
    const jwtSecret = process.env.JWT_SECRET;
    if (token && jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded?.adminSessionId) {
          await clearAdminSessionById(decoded.adminSessionId);
        }
      } catch {
        // Token may already be expired; still return success for client cleanup.
      }
    }
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
