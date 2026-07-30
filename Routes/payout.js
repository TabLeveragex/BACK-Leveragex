const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../Models/userModel');
const ensureAuthenticated = require('../Middlewares/auth');
const ensureAdmin = require('../Middlewares/adminAuth');

const isValidUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

router.get('/users/me', ensureAuthenticated, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ payoutStatus: user.payoutStatus });
    } catch (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ error: 'Server error' });
    }
});

// Get payout status for a specific user (legacy — auth + self match)
router.get('/users/:id', ensureAuthenticated, async (req, res) => {
    const userId = String(req.params.id);
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (userId !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
  
      // Send only the payoutEnabled status
      res.json({ payoutStatus: user.payoutStatus });
    } catch (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

// Admin updates payout status for a user
router.put('/:userId', ensureAdmin, async (req, res) => {
  const { payoutStatus } = req.body;
  const userId = String(req.params.userId);

  if (!isValidUserId(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (!['Enable', 'Disable', 'Pending'].includes(payoutStatus)) {
    return res.status(400).json({ message: 'Invalid payout status' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { payoutStatus },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      message: `Payout status updated to ${payoutStatus} for user.`,
      userId: String(user._id),
      payoutStatus: user.payoutStatus,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payout status' });
  }
});

module.exports = router;
