const express = require('express');
const router = express.Router();
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Company = require('../models/Company');
const CustomerApplication = require('../models/CustomerApplication');
const { computeEffectiveStatus } = require('../middleware/subscription');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const { sendTelegramMessage } = require('../utils/telegram');
const User = require('../models/User');

const NRC_RE = /^[0-9/]+$/;
const PHONE_RE = /^[0-9+()\-\s]{6,20}$/;

/**
 * Resolve :slug -> an enabled lender company. Cached on req for downstream
 * handlers. No client-supplied id is ever trusted — the slug is the only
 * external input that names a tenant.
 */
async function resolveLender(req, res, next) {
  try {
    const slug = (req.params.slug || '').toLowerCase();
    const company = await Company.findOne({ 'publicIntake.slug': slug, 'publicIntake.enabled': true });
    if (!company) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    req.lenderCompany = company;
    next();
  } catch (error) {
    console.error('[publicIntake] resolveLender error:', error);
    res.status(404).json({ success: false, message: 'Not found' });
  }
}

/** Per-route CORS reflecting only this lender's registered origin. No-Origin requests (curl/server-to-server) pass through. */
function corsForLender(req, res, next) {
  const allowedOrigin = req.lenderCompany && req.lenderCompany.publicIntake && req.lenderCompany.publicIntake.allowedOrigin;
  // The app-wide cors() middleware (server/app.js) already stamped a
  // permissive Access-Control-Allow-Origin on this response — this route
  // needs a strict per-lender pin instead of that global default, so clear
  // it before re-deciding.
  res.removeHeader('Access-Control-Allow-Origin');
  return cors({
    origin: (requestOrigin, callback) => {
      if (!allowedOrigin) return callback(null, false);
      if (!requestOrigin) return callback(null, true); // server-to-server/curl — no browser to enforce against
      callback(null, requestOrigin === allowedOrigin);
    },
    methods: ['POST', 'OPTIONS'],
    credentials: false
  })(req, res, next);
}

// Applies to every method (including the CORS preflight OPTIONS) on this path.
router.use('/:slug/applications', resolveLender, corsForLender);

// In test runs, the whole file's requests share one in-memory limiter store
// (no per-test IP variation), which would make unrelated functional tests
// trip a real limiter. `skip` lets tests opt a request *into* being counted
// via a header, so only a dedicated rate-limit test exercises the 429 path —
// this never runs in non-test environments.
const testOnlySkip = (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'probe';

const burstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: testOnlySkip,
  message: { success: false, message: 'Too many requests. Please try again shortly.' }
});

const hourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: testOnlySkip,
  message: { success: false, message: 'Too many applications submitted from this address. Please try again later.' }
});

function fakeReference() {
  return `APP-${Date.now().toString(36).toUpperCase()}`;
}

async function nextApplicationReference() {
  const year = new Date().getFullYear();
  const counters = CustomerApplication.db.collection('counters');
  const doc = await counters.findOneAndUpdate(
    { _id: `applicationRef-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = (doc && doc.value ? doc.value.seq : doc?.seq);
  return `APP${year}${seq.toString().padStart(4, '0')}`;
}

function validatePayload(body) {
  const errors = [];
  const applicant = body.applicant || {};
  const loanRequest = body.loanRequest || {};
  const collateral = body.collateral;

  if (!applicant.fullName || !applicant.fullName.trim()) errors.push('applicant.fullName is required');
  if (!applicant.nrc || !NRC_RE.test(applicant.nrc.trim())) errors.push('applicant.nrc is required and must contain only digits and slashes');
  if (!applicant.phone || !PHONE_RE.test(applicant.phone.trim())) errors.push('applicant.phone is required and must be a valid phone number');
  if (applicant.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(applicant.email.trim())) errors.push('applicant.email is invalid');
  if (!applicant.address || !applicant.address.trim()) errors.push('applicant.address is required');
  if (!applicant.employmentStatus || !applicant.employmentStatus.trim()) errors.push('applicant.employmentStatus is required');

  if (typeof loanRequest.amount !== 'number' || loanRequest.amount <= 0 || loanRequest.amount > 1000000) {
    errors.push('loanRequest.amount must be a positive number no greater than 1,000,000');
  }
  if (!loanRequest.purpose || !loanRequest.purpose.trim()) errors.push('loanRequest.purpose is required');
  if (typeof loanRequest.termDays !== 'number' || loanRequest.termDays < 1 || loanRequest.termDays > 365) {
    errors.push('loanRequest.termDays must be between 1 and 365');
  }

  if (collateral && collateral.type) {
    if (!['vehicle', 'business_equipment', 'title_deed', 'other'].includes(collateral.type)) {
      errors.push('collateral.type is invalid');
    }
    if (collateral.type === 'other' && (!collateral.otherDescription || !collateral.otherDescription.trim())) {
      errors.push('collateral.otherDescription is required when collateral.type is "other"');
    }
    if (!collateral.description || !collateral.description.trim()) {
      errors.push('collateral.description is required when collateral is provided');
    }
  }

  return errors;
}

// @route   POST /api/public/:slug/applications
// @desc    Public, unauthenticated loan-application intake from a lender's website
// @access  Public (hardened: CORS-pinned, rate-limited, honeypot, tenant-bound by slug)
router.post('/:slug/applications', hourlyLimiter, burstLimiter, async (req, res) => {
  try {
    // Honeypot: a real visitor never fills this hidden field. Accept and
    // silently drop — no record, no error, so a bot can't learn it was caught.
    if (req.body && req.body.website) {
      return res.status(200).json({ success: true, reference: fakeReference() });
    }

    const lenderCompany = req.lenderCompany;

    const { effectiveStatus, locked } = computeEffectiveStatus(lenderCompany.subscription);
    void effectiveStatus;
    if (locked) {
      return res.status(503).json({ success: false, message: 'Applications are temporarily unavailable. Please try again later.' });
    }

    const errors = validatePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const { applicant, loanRequest, collateral } = req.body;

    const application = new CustomerApplication({
      lenderCompany: lenderCompany._id,
      applicant: {
        fullName: applicant.fullName.trim(),
        nrc: applicant.nrc.trim(),
        phone: applicant.phone.trim(),
        email: applicant.email ? applicant.email.trim().toLowerCase() : undefined,
        address: applicant.address.trim(),
        employmentStatus: applicant.employmentStatus.trim(),
        employerName: applicant.employerName ? applicant.employerName.trim() : undefined,
        monthlyIncome: applicant.monthlyIncome
      },
      loanRequest: {
        amount: loanRequest.amount,
        purpose: loanRequest.purpose.trim(),
        termDays: loanRequest.termDays
      },
      collateral: collateral && collateral.type ? {
        type: collateral.type,
        otherDescription: collateral.otherDescription,
        description: collateral.description,
        estimatedValue: collateral.estimatedValue
      } : undefined,
      source: 'website'
    });

    application.reference = await nextApplicationReference();
    await application.save();

    // Notify the lender's admins — never blocks the response on failure.
    User.find({ company: lenderCompany._id, role: 'lender_admin', isActive: true })
      .then((admins) => {
        admins.forEach((admin) => {
          if (admin.email) {
            void sendEmail({
              to: admin.email,
              ...emailTemplates.applicationReceived(admin, application, lenderCompany)
            });
          }
        });
      })
      .catch((err) => console.error('[publicIntake] admin notify error:', err.message));

    void sendTelegramMessage(
      `New website application ${application.reference} for ${lenderCompany.name}: ${application.applicant.fullName} requesting ${application.loanRequest.amount}.`
    );

    res.status(201).json({ success: true, reference: application.reference });
  } catch (error) {
    console.error('[publicIntake] submission error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit application' });
  }
});

module.exports = router;
