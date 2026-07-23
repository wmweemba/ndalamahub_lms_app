const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const CustomerApplication = require('../models/CustomerApplication');
const Company = require('../models/Company');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Collateral = require('../models/Collateral');
const LoanProduct = require('../models/LoanProduct');
const { requireAuth, authorize } = require('../middleware/auth');
const { isPlatformAdmin, idsEqual, clientCompanyIds } = require('../utils/tenantScope');
const { generatePasswordResetToken } = require('../utils/auth');

/** Document-level access — lender-side staff of the owning tenant only. */
function canAccessApplication(user, application) {
  if (isPlatformAdmin(user)) return true;
  return idsEqual(application.lenderCompany, user.company);
}

/** Employer/borrower companies this lender's borrowers may belong to, plus the lender itself (direct model). */
async function lenderScopeCompanyIds(lenderCompanyId) {
  const clients = await clientCompanyIds(lenderCompanyId);
  return [lenderCompanyId, ...clients];
}

/** Existing borrower in this lender's scope matching NRC, phone, or email — priority in that order. */
async function findDedupeMatch(lenderCompanyId, applicant) {
  const scopeIds = await lenderScopeCompanyIds(lenderCompanyId);
  const baseFilter = { role: 'borrower', company: { $in: scopeIds } };

  const nrcMatch = await User.findOne({ ...baseFilter, nrc: applicant.nrc });
  if (nrcMatch) return { matchType: 'nrc', userId: nrcMatch._id, name: nrcMatch.getFullName() };

  const phoneMatch = await User.findOne({ ...baseFilter, phone: applicant.phone });
  if (phoneMatch) return { matchType: 'phone', userId: phoneMatch._id, name: phoneMatch.getFullName() };

  if (applicant.email) {
    const emailMatch = await User.findOne({ ...baseFilter, email: applicant.email });
    if (emailMatch) return { matchType: 'email', userId: emailMatch._id, name: emailMatch.getFullName() };
  }

  return null;
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return { firstName, lastName };
}

async function generateUsername(applicant) {
  const base = (applicant.email ? applicant.email.split('@')[0] : applicant.nrc)
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 24) || 'customer';
  let candidate = base.length >= 3 ? base : `${base}user`;
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await User.findOne({ username: candidate.toLowerCase() });
    if (!existing) return candidate.toLowerCase();
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

/**
 * The lender's active product matching the requested amount and term.
 * `application.loanRequest.termDays` is unambiguously a day count (the
 * website contract only ever sends days), so only day-unit products are
 * eligible — a month/week-unit product can't be validly matched against a
 * raw day count without silently mislabeling the resulting loan's term
 * (found live, on dev Atlas, during Phase 22 verification: an earlier
 * version matched on amount alone and stamped every converted loan
 * `termUnit: 'days'` regardless of the matched product's real unit).
 */
async function findMatchingProduct(lenderCompanyId, amount, termDays) {
  const products = await LoanProduct.find({ company: lenderCompanyId, isActive: true, 'term.unit': 'days' });
  return products.find((p) => p.isAmountValid(amount) && p.isTermValid(termDays)) || null;
}

// @route   GET /api/customer-applications
// @desc    List intake applications for the caller's lender tenant, with dedupe flags
// @access  Private (lender_officer+, own tenant only)
router.get('/', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const filter = { status };
    if (!isPlatformAdmin(req.user)) filter.lenderCompany = req.user.company;

    const applications = await CustomerApplication.find(filter).sort({ createdAt: -1 });

    const withDedupe = await Promise.all(applications.map(async (app) => {
      const dedupe = await findDedupeMatch(app.lenderCompany, app.applicant);
      const obj = app.toJSON ? app.toJSON() : app.toObject();
      obj.dedupe = dedupe;
      return obj;
    }));

    res.json({ success: true, data: { applications: withDedupe } });
  } catch (error) {
    console.error('List customer applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load applications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/customer-applications/:id
// @desc    Single application with dedupe flag
// @access  Private (lender_officer+, own tenant only)
router.get('/:id', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const application = await CustomerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (!canAccessApplication(req.user, application)) {
      return res.status(403).json({ success: false, message: 'Access denied to this application' });
    }

    const dedupe = await findDedupeMatch(application.lenderCompany, application.applicant);
    const obj = application.toJSON();
    obj.dedupe = dedupe;

    res.json({ success: true, data: { application: obj } });
  } catch (error) {
    console.error('Get customer application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load application',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/customer-applications/:id/reject
// @desc    Reject an intake application
// @access  Private (lender_officer+, own tenant only)
router.put('/:id/reject', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }

    const application = await CustomerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (!canAccessApplication(req.user, application)) {
      return res.status(403).json({ success: false, message: 'Access denied to this application' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application is already ${application.status}` });
    }

    application.status = 'rejected';
    application.review = { by: req.user.id, at: new Date(), notes: reason.trim() };
    await application.save();

    res.json({ success: true, data: { application } });
  } catch (error) {
    console.error('Reject customer application error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject application' });
  }
});

// @route   PUT /api/customer-applications/:id/approve
// @desc    Atomic conversion: create (or attach to) a borrower, create the loan
//          and its declared collateral, and mark the application approved.
//          All-or-nothing — no mongodb-memory-server replica set is available
//          in the test environment, so this is create-then-cleanup rather than
//          a real multi-document transaction (flagged deviation from the
//          phase doc's "use a transaction if available" instruction).
// @access  Private (lender_officer+, own tenant only)
router.put('/:id/approve', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  const created = { user: null, loan: null, collateral: null };
  try {
    const application = await CustomerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (!canAccessApplication(req.user, application)) {
      return res.status(403).json({ success: false, message: 'Access denied to this application' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application is already ${application.status}` });
    }

    const lenderCompany = await Company.findById(application.lenderCompany);
    if (!lenderCompany) {
      return res.status(400).json({ success: false, message: 'Lender company not found' });
    }

    const { attachToUserId, temporaryPassword, notes } = req.body;

    let borrower;
    if (attachToUserId) {
      borrower = await User.findById(attachToUserId);
      if (!borrower || borrower.role !== 'borrower') {
        return res.status(400).json({ success: false, message: 'attachToUserId does not reference a valid borrower' });
      }
      const scopeIds = (await lenderScopeCompanyIds(lenderCompany._id)).map((id) => id.toString());
      if (!scopeIds.includes(borrower.company.toString())) {
        return res.status(400).json({ success: false, message: 'attachToUserId is outside this lender\'s tenant' });
      }
    } else {
      // Public intake maps prospects straight onto the lender; conversion to
      // a brand-new borrower requires the lender to operate the direct model
      // (Phase 19). Employer-model lenders must use attachToUserId against an
      // existing employer-linked borrower instead — flagged resolution, the
      // phase doc's CustomerApplication schema has no employer-company field.
      if (lenderCompany.lendingModel !== 'direct') {
        return res.status(400).json({
          success: false,
          message: 'This lender uses the employer-based model; new-borrower conversion requires an existing borrower via attachToUserId'
        });
      }

      const dedupe = await findDedupeMatch(lenderCompany._id, application.applicant);
      if (dedupe) {
        return res.status(409).json({
          success: false,
          message: 'A matching borrower already exists — use attachToUserId to attach this application to them instead',
          data: { dedupe }
        });
      }

      const { firstName, lastName } = splitName(application.applicant.fullName);
      const username = await generateUsername(application.applicant);

      let password;
      if (application.applicant.email) {
        password = crypto.randomBytes(16).toString('hex');
      } else {
        if (!temporaryPassword || temporaryPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'temporaryPassword (min 6 characters) is required when the applicant has no email'
          });
        }
        password = temporaryPassword;
      }

      borrower = new User({
        firstName,
        lastName,
        username,
        email: application.applicant.email || undefined,
        phone: application.applicant.phone,
        password,
        role: 'borrower',
        company: lenderCompany._id,
        nrc: application.applicant.nrc
      });
      await borrower.save();
      created.user = borrower;

      if (application.applicant.email) {
        const { resetToken, hashedToken } = generatePasswordResetToken();
        borrower.passwordResetToken = hashedToken;
        borrower.passwordResetExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7-day invite window
        await borrower.save();

        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        const { sendEmail } = require('../utils/email');
        const emailTemplates = require('../utils/emailTemplates');
        void sendEmail({ to: borrower.email, ...emailTemplates.passwordReset(borrower, resetUrl) });
      }
    }

    const product = await findMatchingProduct(lenderCompany._id, application.loanRequest.amount, application.loanRequest.termDays);
    if (!product) {
      throw Object.assign(new Error('No matching loan product found for the requested amount'), { status: 400 });
    }

    const loan = new Loan({
      applicant: borrower._id,
      company: lenderCompany._id,
      lenderCompany: lenderCompany._id,
      product: product._id,
      amount: application.loanRequest.amount,
      interestRate: product.interestRate.default,
      term: application.loanRequest.termDays,
      termUnit: 'days',
      purpose: application.loanRequest.purpose,
      interestCalculation: {
        method: product.interestCalculation.method,
        rateBasis: product.interestCalculation.rateBasis,
        accrualBasis: product.interestCalculation.dayCountConvention
      },
      repaymentFrequency: product.repaymentFrequency[0],
      monthlyIncome: application.applicant.monthlyIncome || 0
    });
    await loan.save();
    created.loan = loan;

    let collateral = null;
    if (application.collateral && application.collateral.type) {
      collateral = new Collateral({
        lenderCompany: lenderCompany._id,
        loan: loan._id,
        application: application._id,
        type: application.collateral.type,
        otherDescription: application.collateral.otherDescription,
        description: application.collateral.description,
        estimatedValue: application.collateral.estimatedValue || 0,
        status: 'declared'
      });
      await collateral.save();
      created.collateral = collateral;
    }

    application.status = 'approved';
    application.review = { by: req.user.id, at: new Date(), notes };
    application.createdUser = borrower._id;
    application.createdLoan = loan._id;
    await application.save();

    res.json({
      success: true,
      data: {
        application,
        user: borrower.toJSON(),
        loan: loan.toJSON(),
        collateral: collateral ? collateral.toJSON() : null
      }
    });
  } catch (error) {
    // All-or-nothing: unwind anything created before the failure.
    if (created.collateral) await Collateral.deleteOne({ _id: created.collateral._id }).catch(() => {});
    if (created.loan) await Loan.deleteOne({ _id: created.loan._id }).catch(() => {});
    if (created.user) await User.deleteOne({ _id: created.user._id }).catch(() => {});

    console.error('Approve customer application error:', error);
    res.status(error.status || 400).json({ success: false, message: error.message || 'Failed to approve application' });
  }
});

module.exports = router;
