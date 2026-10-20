const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Company = require('../models/Company');
const { requireAuth, authorizeMinRole } = require('../middleware/auth');
const { isPlatformAdmin } = require('../utils/tenantScope');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const BillingAuditLog = require('../models/BillingAuditLog');
const { computePeriodExtension } = require('../utils/subscriptionBilling');
const { snapshotSubscription, logBillingChange } = require('../utils/billingAudit');
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

    const before = snapshotSubscription(company.subscription);

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

    await logBillingChange({
      companyId: company._id,
      action: 'subscription.adjusted',
      source: 'admin',
      performedBy: req.user.id,
      before,
      after: snapshotSubscription(company.subscription)
    });

    res.json({ success: true, message: 'Subscription updated', data: { company } });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

const PAYMENT_METHODS = ['mobile_money', 'bank_transfer', 'cash', 'other'];
const isGiven = (v) => v !== null && v !== undefined && v !== '';

// @route   POST /api/subscriptions/:companyId/payments
// @desc    Record a manual subscription payment and extend the lender's period
// @access  Private (platform_admin)
router.post('/:companyId/payments', requireAuth, authorizeMinRole('platform_admin'), async (req, res) => {
  let payment = null;
  try {
    const { amount, method, reference, customPeriodEnd, plan, note } = req.body;
    let { periodMonths } = req.body;

    if (!mongoose.isValidObjectId(req.params.companyId)) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    if (company.type !== 'lender') {
      return res.status(400).json({ success: false, message: 'Subscription state applies to lender companies only' });
    }

    const amountNum = typeof amount === 'number' ? amount : (typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : NaN);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a number greater than 0' });
    }
    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({ success: false, message: `Invalid method. Must be one of: ${PAYMENT_METHODS.join(', ')}` });
    }

    if (reference !== undefined && reference !== null && typeof reference !== 'string') {
      return res.status(400).json({ success: false, message: 'reference must be a string' });
    }

    if (isGiven(periodMonths)) periodMonths = Number(periodMonths);

    const ref = typeof reference === 'string' ? reference.trim() : '';
    if (ref) {
      const dup = await SubscriptionPayment.exists({ lenderCompany: company._id, reference: ref });
      if (dup) {
        return res.status(409).json({ success: false, message: 'A payment with this reference has already been recorded' });
      }
    }

    let extension;
    try {
      extension = computePeriodExtension(company.subscription, { periodMonths, customPeriodEnd });
    } catch (err) {
      if (err.code === 'INVALID_PERIOD') {
        return res.status(400).json({ success: false, message: err.message });
      }
      throw err;
    }

    const before = snapshotSubscription(company.subscription);
    // Guard values come from the stored document: the in-memory doc may carry
    // schema defaults that were never persisted (legacy lenders).
    const stored = await Company.findById(company._id).select('subscription').lean();
    const storedSub = (stored && stored.subscription) || {};

    payment = await SubscriptionPayment.create({
      lenderCompany: company._id,
      amount: amountNum,
      method,
      reference: ref || undefined,
      recordedBy: req.user.id,
      previousStatus: company.subscription?.status,
      previousPeriodEnd: company.subscription?.currentPeriodEnd,
      periodStart: extension.periodStart,
      periodEnd: extension.periodEnd,
      periodMonths: isGiven(periodMonths) ? periodMonths : null,
      customPeriodEnd: isGiven(customPeriodEnd),
      plan: plan || company.subscription?.plan,
      note
    });

    let updatedCompany;
    try {
      const prevEnd = storedSub.currentPeriodEnd;
      const prevStatus = storedSub.status;
      const set = {
        'subscription.status': 'active',
        'subscription.currentPeriodEnd': extension.periodEnd
      };
      if (plan) set['subscription.plan'] = plan;
      const result = await Company.updateOne(
        {
          _id: company._id,
          'subscription.currentPeriodEnd': prevEnd ? prevEnd : { $in: [null] },
          'subscription.status': prevStatus ? prevStatus : { $in: [null] }
        },
        { $set: set, $unset: { 'subscription.suspendedAt': '' } }
      );
      if (result.matchedCount === 0) {
        await SubscriptionPayment.deleteOne({ _id: payment._id }).catch((delErr) => {
          console.error('Record payment: rollback failed, orphaned payment needs reconciliation', payment._id, delErr);
        });
        return res.status(409).json({ success: false, message: 'Subscription changed while recording this payment; reload and try again' });
      }
    } catch (saveErr) {
      console.error('Record payment: company update failed, rolling back payment', saveErr);
      await SubscriptionPayment.deleteOne({ _id: payment._id }).catch((delErr) => {
        console.error('Record payment: rollback failed, orphaned payment needs reconciliation', payment._id, delErr);
      });
      return res.status(500).json({ success: false, message: 'Failed to record payment' });
    }

    // The update has committed from here on, so never roll the payment back.
    updatedCompany = await Company.findById(company._id).catch(() => null);
    if (!updatedCompany) {
      company.subscription.status = 'active';
      company.subscription.currentPeriodEnd = extension.periodEnd;
      company.subscription.suspendedAt = undefined;
      if (plan) company.subscription.plan = plan;
      updatedCompany = company;
    }

    await logBillingChange({
      companyId: company._id,
      action: 'subscription.payment_recorded',
      source: 'admin',
      performedBy: req.user.id,
      before,
      after: snapshotSubscription(updatedCompany.subscription),
      meta: {
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        reference: payment.reference
      }
    });

    res.status(201).json({ success: true, message: 'Payment recorded', data: { company: updatedCompany, payment } });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A payment with this reference has already been recorded' });
    }
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Record payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
});

// @route   GET /api/subscriptions/:companyId/payments
// @access  Private (platform_admin)
router.get('/:companyId/payments', requireAuth, authorizeMinRole('platform_admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.companyId) || !(await Company.exists({ _id: req.params.companyId }))) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    const payments = await SubscriptionPayment.find({ lenderCompany: req.params.companyId })
      .sort({ createdAt: -1, _id: -1 })
      .populate('recordedBy', 'firstName lastName username');
    res.json({ success: true, data: { payments } });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to list payments' });
  }
});

// @route   GET /api/subscriptions/:companyId/audit
// @access  Private (platform_admin)
router.get('/:companyId/audit', requireAuth, authorizeMinRole('platform_admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.companyId) || !(await Company.exists({ _id: req.params.companyId }))) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    const entries = await BillingAuditLog.find({ lenderCompany: req.params.companyId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .populate('performedBy', 'firstName lastName username');
    res.json({ success: true, data: { entries } });
  } catch (error) {
    console.error('List billing audit error:', error);
    res.status(500).json({ success: false, message: 'Failed to list billing audit' });
  }
});

module.exports = router;
