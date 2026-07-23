const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { requireAuth, authorizeMinRole } = require('../middleware/auth');
const { isPlatformAdmin } = require('../utils/tenantScope');
const { payingLenderId, computeEffectiveStatus } = require('../middleware/subscription');

const VALID_STATUSES = ['trialing', 'active', 'past_due', 'read_only', 'suspended', 'cancelled'];

// @route   GET /api/subscriptions/status
// @desc    The caller's own tenant's effective subscription status (exempt from the gate — this is what the client banner polls)
// @access  Private (any authenticated user)
router.get('/status', requireAuth, async (req, res) => {
  try {
    if (isPlatformAdmin(req.user)) {
      return res.json({
        success: true,
        data: { exempt: true, effectiveStatus: 'active', locked: false, readOnly: false }
      });
    }

    const lenderId = await payingLenderId(req.user);
    if (!lenderId) {
      return res.json({
        success: true,
        data: { exempt: true, effectiveStatus: 'active', locked: false, readOnly: false }
      });
    }

    const lenderCompany = await Company.findById(lenderId).select('subscription name');
    if (!lenderCompany) {
      return res.json({
        success: true,
        data: { exempt: true, effectiveStatus: 'active', locked: false, readOnly: false }
      });
    }

    const { effectiveStatus, locked, readOnly } = computeEffectiveStatus(lenderCompany.subscription);

    res.json({
      success: true,
      data: {
        exempt: false,
        effectiveStatus,
        locked,
        readOnly,
        status: lenderCompany.subscription?.status,
        plan: lenderCompany.subscription?.plan,
        trialEndsAt: lenderCompany.subscription?.trialEndsAt,
        currentPeriodEnd: lenderCompany.subscription?.currentPeriodEnd,
        lenderCompanyName: lenderCompany.name
      }
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription status' });
  }
});

// @route   GET /api/subscriptions
// @desc    List lender companies with their subscription fields
// @access  Private (platform_admin)
router.get('/', requireAuth, authorizeMinRole('platform_admin'), async (req, res) => {
  try {
    const lenders = await Company.find({ type: 'lender' }).select('name subscription');
    res.json({ success: true, data: { lenders } });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to list subscriptions' });
  }
});

// @route   PUT /api/subscriptions/:companyId
// @desc    Manually set a lender company's subscription state (manual billing)
// @access  Private (platform_admin)
router.put('/:companyId', requireAuth, authorizeMinRole('platform_admin'), async (req, res) => {
  try {
    const { status, currentPeriodEnd, trialEndsAt, plan, notes } = req.body;

    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    if (company.type !== 'lender') {
      return res.status(400).json({ success: false, message: 'Subscription state applies to lender companies only' });
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      if (status === 'active' && !currentPeriodEnd && !company.subscription?.currentPeriodEnd) {
        return res.status(400).json({ success: false, message: 'currentPeriodEnd is required to set status to active' });
      }
      company.subscription.status = status;
      company.subscription.suspendedAt = status === 'suspended' ? new Date() : company.subscription.suspendedAt;
    }

    if (currentPeriodEnd !== undefined) company.subscription.currentPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : undefined;
    if (trialEndsAt !== undefined) company.subscription.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : undefined;
    if (plan !== undefined) company.subscription.plan = plan;
    if (notes !== undefined) company.subscription.notes = notes;

    await company.save();

    res.json({ success: true, message: 'Subscription updated', data: { company } });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
