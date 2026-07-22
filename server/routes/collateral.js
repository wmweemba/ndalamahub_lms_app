const express = require('express');
const router = express.Router();
const Collateral = require('../models/Collateral');
const Loan = require('../models/Loan');
const {
  authenticateToken,
  authorize
} = require('../middleware/auth');
const {
  isPlatformAdmin,
  isLenderSide,
  idsEqual
} = require('../utils/tenantScope');

/** Document-level access to a collateral record — lender-side, own tenant only. */
function canAccessCollateral(user, collateral) {
  if (isPlatformAdmin(user)) return true;
  return isLenderSide(user) && idsEqual(collateral.lenderCompany, user.company);
}

/**
 * Access to the loan a new collateral record is being attached to.
 * Lender-side staff may declare collateral on any loan in their tenant
 * (register-desk entry); a borrower may also declare collateral on their
 * own loan at application time — verification/rejection/letter-of-sale/edit
 * stay lender-side only (see canAccessCollateral).
 */
function canAttachToLoan(user, loan) {
  if (isPlatformAdmin(user)) return true;
  if (isLenderSide(user) && idsEqual(loan.lenderCompany, user.company)) return true;
  return user.role === 'borrower' && idsEqual(loan.applicant, user.id);
}

// @route   GET /api/collateral
// @desc    The collateral register — lender-side roles only, scoped to own tenant
// @access  Private (lender_officer+)
router.get('/', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (!isPlatformAdmin(req.user)) filter.lenderCompany = req.user.company;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const records = await Collateral.find(filter)
      .populate({
        path: 'loan',
        select: 'loanNumber applicant status',
        populate: { path: 'applicant', select: 'firstName lastName nrc' }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        collateral: records.map((r) => {
          const obj = r.toJSON();
          if (obj.loan && !obj.loan.applicant) obj.loan.applicant = null;
          return obj;
        })
      }
    });
  } catch (error) {
    console.error('Get collateral register error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load collateral register',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/collateral/loans/:loanId
// @desc    Declare a collateral record against a loan — lender staff (own
//          tenant) or the loan's own applicant (borrower, at application time)
// @access  Private (lender_officer+, or the loan's own borrower)
router.post('/loans/:loanId', authenticateToken, authorize('lender_admin', 'lender_officer', 'borrower'), async (req, res) => {
  try {
    const { loanId } = req.params;
    const { type, otherDescription, description, estimatedValue } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    if (!canAttachToLoan(req.user, loan)) {
      return res.status(403).json({ success: false, message: 'Access denied to this loan' });
    }

    const collateral = new Collateral({
      lenderCompany: loan.lenderCompany,
      loan: loan._id,
      type,
      otherDescription,
      description,
      estimatedValue
    });
    await collateral.save();

    res.status(201).json({ success: true, data: { collateral } });
  } catch (error) {
    console.error('Create collateral error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create collateral record'
    });
  }
});

// @route   PUT /api/collateral/:id
// @desc    Edit a collateral record. Editing a verified record resets it to
//          'declared' — re-verification is required after any change.
// @access  Private (lender_officer+, own tenant only)
router.put('/:id', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const collateral = await Collateral.findById(req.params.id);
    if (!collateral) {
      return res.status(404).json({ success: false, message: 'Collateral record not found' });
    }
    if (!canAccessCollateral(req.user, collateral)) {
      return res.status(403).json({ success: false, message: 'Access denied to this collateral record' });
    }

    const { type, otherDescription, description, estimatedValue } = req.body;
    if (type !== undefined) collateral.type = type;
    if (otherDescription !== undefined) collateral.otherDescription = otherDescription;
    if (description !== undefined) collateral.description = description;
    if (estimatedValue !== undefined) collateral.estimatedValue = estimatedValue;

    if (collateral.status === 'verified') {
      collateral.status = 'declared';
      collateral.vettedBy = undefined;
      collateral.vettedAt = undefined;
      collateral.vettingNotes = undefined;
    }

    await collateral.save();
    res.json({ success: true, data: { collateral } });
  } catch (error) {
    console.error('Update collateral error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update collateral record'
    });
  }
});

// @route   PUT /api/collateral/:id/verify
// @desc    Verify a declared collateral record
// @access  Private (lender_officer+, own tenant only)
router.put('/:id/verify', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const collateral = await Collateral.findById(req.params.id);
    if (!collateral) {
      return res.status(404).json({ success: false, message: 'Collateral record not found' });
    }
    if (!canAccessCollateral(req.user, collateral)) {
      return res.status(403).json({ success: false, message: 'Access denied to this collateral record' });
    }

    collateral.status = 'verified';
    collateral.vettedBy = req.user.id;
    collateral.vettedAt = new Date();
    collateral.vettingNotes = req.body.vettingNotes || collateral.vettingNotes;

    await collateral.save();
    res.json({ success: true, data: { collateral } });
  } catch (error) {
    console.error('Verify collateral error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify collateral record'
    });
  }
});

// @route   PUT /api/collateral/:id/reject
// @desc    Reject a declared collateral record
// @access  Private (lender_officer+, own tenant only)
router.put('/:id/reject', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const collateral = await Collateral.findById(req.params.id);
    if (!collateral) {
      return res.status(404).json({ success: false, message: 'Collateral record not found' });
    }
    if (!canAccessCollateral(req.user, collateral)) {
      return res.status(403).json({ success: false, message: 'Access denied to this collateral record' });
    }

    collateral.status = 'rejected';
    collateral.vettedBy = req.user.id;
    collateral.vettedAt = new Date();
    collateral.vettingNotes = req.body.vettingNotes || collateral.vettingNotes;

    await collateral.save();
    res.json({ success: true, data: { collateral } });
  } catch (error) {
    console.error('Reject collateral error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject collateral record'
    });
  }
});

// @route   PUT /api/collateral/:id/letter-of-sale
// @desc    Record the paper letter-of-sale-on-file flag
// @access  Private (lender_officer+, own tenant only)
router.put('/:id/letter-of-sale', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const collateral = await Collateral.findById(req.params.id);
    if (!collateral) {
      return res.status(404).json({ success: false, message: 'Collateral record not found' });
    }
    if (!canAccessCollateral(req.user, collateral)) {
      return res.status(403).json({ success: false, message: 'Access denied to this collateral record' });
    }

    const { onFile, reference } = req.body;
    collateral.letterOfSale = {
      onFile: onFile !== undefined ? !!onFile : true,
      reference: reference || collateral.letterOfSale?.reference,
      recordedBy: req.user.id,
      recordedAt: new Date()
    };

    await collateral.save();
    res.json({ success: true, data: { collateral } });
  } catch (error) {
    console.error('Record letter of sale error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to record letter of sale'
    });
  }
});

module.exports = router;
