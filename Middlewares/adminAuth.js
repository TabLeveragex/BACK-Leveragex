const jwt = require('jsonwebtoken');
const Admin = require('../Models/adminModel');
const { isAdminSessionValid } = require('../Services/adminSessionService');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return header || null;
}

async function ensureAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Admin authentication required', success: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only', success: false });
    }

    const admin = await Admin.findById(decoded._id);
    if (!admin) {
      return res.status(401).json({ message: 'Admin account no longer exists', success: false });
    }

    const sessionOk = await isAdminSessionValid(admin._id, decoded.adminSessionId);
    if (!sessionOk) {
      return res.status(401).json({
        message: 'Admin session ended or another admin logged in.',
        success: false,
      });
    }

    req.admin = {
      id: admin._id,
      email: admin.email,
      username: admin.username,
      fullName: admin.fullName,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired admin session', success: false });
  }
}

module.exports = ensureAdmin;
