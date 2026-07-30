const jwt = require('jsonwebtoken');
const User = require('../Models/userModel');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return header || null;
}

async function ensureAuthenticated(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: JWT token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);
    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'Unauthorized: user no longer exists' });
    }

    req.user = {
      id: user._id,
      email: user.email,
      mobile: user.mobile,
      fullName: user.fullName,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: JWT token is invalid or expired' });
  }
}

module.exports = ensureAuthenticated;
