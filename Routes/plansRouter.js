const express = require('express');
const router = express.Router();
const User = require('../Models/userModel');
const ensureAuthenticated = require('../Middlewares/auth');

router.post('/purchase', ensureAuthenticated, async (req, res) => {
    try {
        const { plan } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (plan === 'Rapid' && user.hasBoughtRapidPlan) {
            return res.status(400).json({ msg: 'You have already purchased the Rapid plan and cannot buy it again!' });
        }

        if (plan === 'Rapid') {
            user.hasBoughtRapidPlan = true;
            user.plan = 'Rapid';
        } else if (plan === 'Evolution' || plan === 'Prime') {
            user.plan = plan;
        }

        await user.save();

        res.status(200).json({
            msg: 'Plan purchased successfully',
            hasBoughtRapidPlan: user.hasBoughtRapidPlan,
            plan: user.plan,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/user-plan/me', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.status(200).json({ hasBoughtRapidPlan: user.hasBoughtRapidPlan, plan: user.plan });
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// Legacy route — auth + self match only
router.get('/user-plan/:userId', ensureAuthenticated, async (req, res) => {
    if (String(req.params.userId) !== String(req.user.id)) {
        return res.status(403).json({ msg: 'Forbidden' });
    }
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.status(200).json({ hasBoughtRapidPlan: user.hasBoughtRapidPlan, plan: user.plan });
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
