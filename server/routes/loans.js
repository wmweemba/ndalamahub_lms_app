const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const User = require('../models/User');
const Company = require('../models/Company');
const LoanProduct = require('../models/LoanProduct');
const Collateral = require('../models/Collateral');
const {
  requireAuth,
  authorize,
  authorizeMinRole,
  authorizeCompany
} = require('../middleware/auth');
const {
  isPlatformAdmin,
  isLenderSide,
  isEmployerSide,
  idsEqual,
  loanScopeFilter,
  mergeFilters,
  canReadLoan,
  canWriteRepayment
} = require('../utils/tenantScope');

const ExcelJS = require('exceljs');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');

/**
 * Approval authority for /approve and /reject (Phase 19). A loan is "direct"
 * when its company and lenderCompany are the same document (the borrower
 * attaches straight to the lender, no employer in between). lender_officer
 * gains approve/reject authority *only* over direct loans — employer-model
 * loans keep the pre-Phase-19 rule untouched (employer-side of the loan's
 * company, or the loan's lender_admin). Fails closed.
 */
function canActOnLoanApproval(user, loan) {
  if (isPlatformAdmin(user)) return true;
  const isDirect = idsEqual(loan.company, loan.lenderCompany);
  if (isDirect) {
    return isLenderSide(user) && idsEqual(loan.lenderCompany, user.company);
  }
  return (isEmployerSide(user) && idsEqual(loan.company, user.company)) ||
    (user.role === 'lender_admin' && idsEqual(loan.lenderCompany, user.company));
}

/**
 * Collateral gate for approve (Phase 21). If the loan's product doesn't
 * require collateral, this is a no-op. Otherwise at least one non-rejected
 * collateral record must exist and every non-rejected record must be
 * 'verified'. Returns the verified records so checkCollateralForDisbursement
 * can reuse them without a second query.
 */
async function checkCollateralForApproval(loan) {
  const product = await LoanProduct.findById(loan.product).select('collateralRequired');
  if (!product || !product.collateralRequired) return { ok: true };

  const records = await Collateral.find({ loan: loan._id });
  const nonRejected = records.filter((r) => r.status !== 'rejected');
  if (nonRejected.length === 0 || !nonRejected.every((r) => r.status === 'verified')) {
    return { ok: false, message: 'Collateral pending verification' };
  }
  return { ok: true, required: true, verifiedRecords: nonRejected };
}

/**
 * Collateral gate for disburse (Phase 21). Requires the approval gate to
 * pass, plus every verified collateral record must have its letter-of-sale
 * on file (paper process — no file uploads, locked decision).
 */
async function checkCollateralForDisbursement(loan) {
  const approvalCheck = await checkCollateralForApproval(loan);
  if (!approvalCheck.ok) return approvalCheck;
  if (!approvalCheck.required) return { ok: true };

  const allLettered = approvalCheck.verifiedRecords.every((r) => r.letterOfSale && r.letterOfSale.onFile);
  if (!allLettered) return { ok: false, message: 'Letter of sale not on file' };
  return { ok: true };
}
// @route   GET /api/loans/:id/repayment-schedule/export/excel
// @desc    Export detailed repayment schedule for a loan as Excel
// @access  Private (same as loan details)
router.get('/:id/repayment-schedule/export/excel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type');
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    // Access control (same as loan details)
    if (!canReadLoan(req.user, loan)) {
      return res.status(403).json({ success: false, message: 'Access denied to this loan' });
    }

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Repayment Schedule');

    // Add metadata
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = `Repayment Schedule for Loan #${loan.loanNumber || loan._id}`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').value = `Borrower: ${loan.applicant?.firstName || ''} ${loan.applicant?.lastName || ''}`;
    worksheet.getCell('A3').value = `Company: ${loan.company?.name || ''}`;
    worksheet.getCell('A4').value = `Generated: ${new Date().toLocaleDateString()}`;

    // Add headers
    const headers = [
      'Installment #', 'Due Date', 'Principal', 'Interest', 'Total', 'Status', 'Paid Amount', 'Paid Date', 'isGrace', 'isMoratorium', 'graceType'
    ];
    worksheet.addRow([]); // Blank row after metadata
    worksheet.addRow(headers);
    worksheet.getRow(6).font = { bold: true };

    // Add schedule rows
    (loan.repaymentSchedule || []).forEach((item, idx) => {
      worksheet.addRow([
        item.installmentNumber || idx + 1,
        item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '',
        item.principal,
        item.interest,
        item.amount,
        item.status,
        item.paidAmount || '',
        item.paidAt ? new Date(item.paidAt).toLocaleDateString() : '',
        item.isGrace ? 'Yes' : '',
        item.isMoratorium ? 'Yes' : '',
        item.graceType || ''
      ]);
    });

    // Format columns
    worksheet.getColumn(3).numFmt = '#,##0.00'; // Principal
    worksheet.getColumn(4).numFmt = '#,##0.00'; // Interest
    worksheet.getColumn(5).numFmt = '#,##0.00'; // Total
    worksheet.getColumn(7).numFmt = '#,##0.00'; // Paid Amount

    worksheet.columns.forEach(col => {
      col.width = Math.max(12, col.header?.length || 0);
    });

    // Set response headers
    const filename = `repayment-schedule-${loan.loanNumber || loan._id}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel repayment schedule export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export repayment schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/loans
// @desc    Get all loans (with filters)
// @access  Private
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      companyId,
      lenderCompanyId,
      search,
      startDate,
      endDate
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status !== undefined) {
      const validStatuses = Loan.schema.path('status').enumValues;
      if (typeof status !== 'string' || !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter' });
      }
      filter.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.applicationDate = {};
      if (startDate) filter.applicationDate.$gte = new Date(startDate);
      if (endDate) filter.applicationDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { loanNumber: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } }
      ];
    }

    // Company access control (tenant scope)
    const scope = await loanScopeFilter(req.user);
    if (isPlatformAdmin(req.user)) {
      // Platform admins can additionally filter by explicit company/lender query params
      if (companyId) filter.company = companyId;
      if (lenderCompanyId) filter.lenderCompany = lenderCompanyId;
    }
    const finalFilter = mergeFilters(filter, scope);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Loan.countDocuments(finalFilter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get loans with pagination
    const loans = await Loan.find(finalFilter)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
      .populate('product', 'name category interestRate term amount')
      .populate('approvedBy', 'firstName lastName')
      .populate('disbursedBy', 'firstName lastName')
      .sort({ applicationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/loans/:id/summary
// @desc    Get loan summary
// @access  Private
router.get('/:id/summary', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findById(id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions based on role
    if (!canReadLoan(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    const summary = loan.getSummary();

    res.json({
      success: true,
      data: {
        summary
      }
    });

  } catch (error) {
    console.error('Get loan summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loan summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/loans/:id
// @desc    Get loan by ID
// @access  Private
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
      .populate('approvedBy', 'firstName lastName')
      .populate('disbursedBy', 'firstName lastName')
      .populate('product', 'name category interestRate term amount collateralRequired');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions based on role
    if (!canReadLoan(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    const collateral = await Collateral.find({ loan: loan._id }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: { loan, collateral }
    });

  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/loans
// @desc    Create new loan application
// @access  Private (Staff only)
router.post('/', requireAuth, authorize('borrower'), async (req, res) => {
  try {
    const {
      productId,
      amount,
      term,
      interestRate,
      purpose,
      description,
      monthlyIncome,
      collateral,
      guarantor,
      documents
    } = req.body;

    // Get user's company and lender company
    const user = await User.findById(req.user.id).populate('company');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.company) {
      return res.status(400).json({ success: false, message: 'User is not linked to a valid company' });
    }
    const company = user.company;

    // Find lender company. Direct-model lenders: the borrower's own company
    // *is* the lender company, so lenderCompany === company, explicitly (not
    // incidentally) — see Phase 19.
    let lenderCompany;
    const isDirectBorrower = company.type === 'lender';
    if (isDirectBorrower) {
      lenderCompany = company;
    } else {
      lenderCompany = await Company.findById(company.lenderCompany);
    }

    if (!lenderCompany) {
      return res.status(400).json({
        success: false,
        message: 'Lender company not found'
      });
    }

    // Handle product-based application
    let loanData = {};
    
    if (productId) {
      // Product-based loan application
      const product = await LoanProduct.findById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Product is not currently available'
        });
      }
      
      // Validate product belongs to lender
      if (product.company.toString() !== lenderCompany._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Product not available for your lender'
        });
      }
      
      // Validate amount against product limits
      if (!product.isAmountValid(amount)) {
        return res.status(400).json({
          success: false,
          message: `Loan amount must be between ${product.amount.currency} ${product.amount.min} and ${product.amount.currency} ${product.amount.max}`
        });
      }
      
      // Validate term against product limits
      if (!product.isTermValid(term)) {
        return res.status(400).json({
          success: false,
          message: `Loan term must be between ${product.term.min} and ${product.term.max} months`
        });
      }
      
      // Use interest rate from product (or allow within range)
      const loanRate = interestRate || product.interestRate.default;
      if (!product.isRateValid(loanRate)) {
        return res.status(400).json({
          success: false,
          message: `Interest rate must be between ${product.interestRate.min}% and ${product.interestRate.max}%`
        });
      }
      
      loanData = {
        product: productId,
        amount,
        term,
        interestRate: loanRate,
        purpose: purpose || `${product.name} Application`,
        description: description || product.description,
        interestCalculation: {
          method: product.interestCalculation.method,
          rateBasis: product.interestCalculation.rateBasis,
          accrualBasis: product.interestCalculation.dayCountConvention
        },
        termUnit: product.term.unit,
        repaymentFrequency: product.repaymentFrequency[0] // Use first frequency as default
      };
      
      // Calculate fees
      const processingFee = product.calculateProcessingFee(amount);
      const insuranceFee = product.calculateInsuranceFee(amount);
      
      loanData.fees = {
        processing: processingFee,
        insurance: insuranceFee
      };
      
    } else {
      // Legacy loan application (without product)
      // Validate required fields
      if (!amount || !term || !purpose) {
        return res.status(400).json({
          success: false,
          message: 'Amount, term, and purpose are required'
        });
      }

      // Validate amount
      if (amount < 100 || amount > 1000000) {
        return res.status(400).json({
          success: false,
          message: 'Loan amount must be between 100 and 1,000,000'
        });
      }

      // Validate term
      if (term < 1 || term > 60) {
        return res.status(400).json({
          success: false,
          message: 'Loan term must be between 1 and 60 months'
        });
      }

      // Check if amount exceeds company's maximum
      if (amount > lenderCompany.settings.maxLoanAmount) {
        return res.status(400).json({
          success: false,
          message: `Loan amount exceeds maximum allowed amount of ${lenderCompany.settings.maxLoanAmount}`
        });
      }

      loanData = {
        amount,
        interestRate: interestRate || lenderCompany.settings.interestRate,
        term,
        purpose,
        description: description || ''
      };
    }

    // Check if user has existing active loans
    const existingLoans = await Loan.find({
      applicant: req.user.id,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    if (existingLoans.length > 0 && !lenderCompany.settings.allowMultipleLoans) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active loan application'
      });
    }

    // Create new loan
    const loan = new Loan({
      ...loanData,
      applicant: user._id,
      company: user.company._id,
      lenderCompany: lenderCompany._id,
      monthlyIncome: monthlyIncome || 0,
      collateral: collateral || null,
      guarantor,
      documents: documents || []
    });
    
    await loan.save();

    // Populate references for response
    await loan.populate([
      { path: 'applicant', select: 'firstName lastName email employeeId department' },
      { path: 'company', select: 'name type' },
      { path: 'lenderCompany', select: 'name type' },
      { path: 'product', select: 'name category interestRate term amount' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: {
        loan: loan.toJSON()
      }
    });

  } catch (error) {
    console.error('Create loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan application',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/loans/:id/approve
// @desc    Approve loan application
// @access  Private (HR and Admin roles; lender_officer over direct loans only)
router.put('/:id/approve', requireAuth, authorize('employer_hr', 'employer_admin', 'lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email')
      .populate('company', 'name type');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check if loan can be approved
    if (!loan.canBeApproved()) {
      return res.status(400).json({
        success: false,
        message: 'Loan cannot be approved in its current status'
      });
    }

    // Check access permissions
    const ok = canActOnLoanApproval(req.user, loan);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Collateral gate (Phase 21) — no-op if the product doesn't require it
    const collateralCheck = await checkCollateralForApproval(loan);
    if (!collateralCheck.ok) {
      return res.status(422).json({
        success: false,
        message: collateralCheck.message
      });
    }

    // Update loan status
    loan.status = 'approved';
    loan.approvedBy = req.user.id;
    loan.approvedAt = new Date();
    if (approvalNotes) loan.approvalNotes = approvalNotes;

    await loan.save();

    if (loan.applicant) {
      void sendEmail({ to: loan.applicant.email, ...emailTemplates.loanApproved(loan.applicant, loan) });
    }

    // Populate references for response
    await loan.populate([
      { path: 'applicant', select: 'firstName lastName email' },
      { path: 'company', select: 'name type' },
      { path: 'approvedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Loan approved successfully',
      data: {
        loan: loan.toJSON()
      }
    });

  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve loan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/loans/:id/reject
// @desc    Reject loan application
// @access  Private (HR and Admin roles; lender_officer over direct loans only)
router.put('/:id/reject', requireAuth, authorize('employer_hr', 'employer_admin', 'lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;

    if (!approvalNotes) {
      return res.status(400).json({
        success: false,
        message: 'Rejection notes are required'
      });
    }

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email')
      .populate('company', 'name type');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check if loan can be rejected
    if (loan.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'Loan cannot be rejected in its current status'
      });
    }

    // Check access permissions
    const ok = canActOnLoanApproval(req.user, loan);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Update loan status
    loan.status = 'rejected';
    loan.approvedBy = req.user.id;
    loan.approvedAt = new Date();
    loan.approvalNotes = approvalNotes;

    await loan.save();

    if (loan.applicant) {
      void sendEmail({ to: loan.applicant.email, ...emailTemplates.loanRejected(loan.applicant, loan, approvalNotes) });
    }

    // Populate references for response
    await loan.populate([
      { path: 'applicant', select: 'firstName lastName email' },
      { path: 'company', select: 'name type' },
      { path: 'approvedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Loan rejected successfully',
      data: {
        loan: loan.toJSON()
      }
    });

  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject loan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/loans/:id/disburse
// @desc    Disburse approved loan
// @access  Private (Lender Admin only)
router.put('/:id/disburse', requireAuth, authorize('lender_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { disbursementMethod } = req.body;

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check if loan can be disbursed
    if (!loan.canBeDisbursed()) {
      return res.status(400).json({
        success: false,
        message: `Loan cannot be disbursed in its current status: ${loan.status}`
      });
    }

    // Check access permissions based on role
    if (!canWriteRepayment(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only disburse loans for your lender company'
      });
    }

    // Collateral gate (Phase 21) — no-op if the product doesn't require it
    const collateralCheck = await checkCollateralForDisbursement(loan);
    if (!collateralCheck.ok) {
      return res.status(422).json({
        success: false,
        message: collateralCheck.message
      });
    }

    // Update loan status to active after disbursement
    loan.status = 'active';
    loan.disbursedBy = req.user.id;
    loan.disbursedAt = new Date();
    loan.startDate = new Date();
    if (disbursementMethod) loan.disbursementMethod = disbursementMethod;

    loan.calculateLoanDetails(); // regenerate schedule anchored to disbursedAt
    loan.endDate = loan.repaymentSchedule.length > 0
      ? loan.repaymentSchedule[loan.repaymentSchedule.length - 1].dueDate
      : loan.endDate;

    await loan.save();

    if (loan.applicant) {
      void sendEmail({ to: loan.applicant.email, ...emailTemplates.loanDisbursed(loan.applicant, loan) });
    }

    // Populate references for response
    await loan.populate([
      { path: 'applicant', select: 'firstName lastName email' },
      { path: 'company', select: 'name type' },
      { path: 'disbursedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Loan disbursed successfully',
      data: {
        loan: loan.toJSON()
      }
    });

  } catch (error) {
    console.error('Disburse loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disburse loan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/loans/:id/default
// @desc    Manually mark a loan defaulted — the rollover kill-switch. A defaulted
//          loan never auto-recovers (Phase 07) and never rolls over again (Phase 20);
//          hands the loan to the collateral-recovery path.
// @access  Private (Lender Admin only, own-tenant only)
router.put('/:id/default', requireAuth, authorize('lender_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required to mark a loan defaulted'
      });
    }

    const loan = await Loan.findById(id);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    if (!canWriteRepayment(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only default loans for your lender company'
      });
    }

    if (loan.status === 'defaulted') {
      return res.status(400).json({
        success: false,
        message: 'Loan is already defaulted'
      });
    }

    loan.status = 'defaulted';
    loan.notes = loan.notes || [];
    loan.notes.push({ user: req.user.id, message: `Manually marked defaulted: ${reason}` });

    await loan.save();

    res.json({
      success: true,
      message: 'Loan marked defaulted',
      data: { loan: loan.toJSON() }
    });

  } catch (error) {
    console.error('Default loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark loan defaulted',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/loans/:id/repayment
// @desc    Record loan repayment with payment details
// @access  Private (Lender Admin only)
router.put('/:id/repayment', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      installmentNumber,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes
    } = req.body;

    if (!installmentNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Installment number and amount are required'
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Payment date is required'
      });
    }

    // Validate payment date is not in the future
    const paymentDateObj = new Date(paymentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    paymentDateObj.setHours(0, 0, 0, 0);
    if (paymentDateObj > today) {
      return res.status(400).json({
        success: false,
        message: 'Payment date cannot be in the future. Please use today or a past date.'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    if (!referenceNumber || !referenceNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required'
      });
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Tenancy check: a lender admin may only record payments on loans
    // where their company is the lender
    if (!canWriteRepayment(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Find the installment
    const installment = loan.repaymentSchedule.find(
      inst => inst.installmentNumber === parseInt(installmentNumber)
    );

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found'
      });
    }

    // Update installment with payment details
    installment.paidAmount += parseFloat(amount);
    installment.paidAt = new Date();
    installment.paymentDate = new Date(paymentDate);
    installment.paymentMethod = paymentMethod;
    installment.referenceNumber = referenceNumber.trim();
    if (notes && notes.trim()) {
      installment.paymentNotes = notes.trim();
    }

    // Calculate remaining amount
    const remaining = installment.amount - installment.paidAmount;
    
    // Mark as paid if remaining is less than 1 cent (handles rounding errors)
    if (remaining < 0.01) {
      installment.status = 'paid';
      installment.paidAmount = installment.amount; // Normalize to exact amount
    } else if (installment.paidAmount >= installment.amount) {
      installment.status = 'paid';
    } else {
      installment.status = 'partial';
    }

    // Check if all installments are paid (or waived via early settlement)
    const allPaid = loan.repaymentSchedule.every(inst => inst.status === 'paid' || inst.status === 'waived');
    if (allPaid) {
      loan.status = 'completed';
    } else {
      loan.status = 'active';
    }

    await loan.save();

    res.json({
      success: true,
      message: 'Repayment recorded successfully',
      data: {
        loan: loan.toJSON()
      }
    });

  } catch (error) {
    console.error('Record repayment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record repayment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================
// PREPAYMENT & EARLY SETTLEMENT ENDPOINTS
// ============================================================

// @route   GET /api/loans/:id/settlement-quote
// @desc    Get early settlement quote (read-only, no state change)
// @access  Private - Lender admin only
router.get('/:id/settlement-quote', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { settlementDate } = req.query;

    const loan = await Loan.findById(id).populate('product', 'name fees');
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions (multi-tenant, read-only)
    if (!canReadLoan(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Check if loan can be settled
    if (!loan.canAcceptPrepayment()) {
      return res.status(400).json({
        success: false,
        message: `Loan cannot be settled in current status: ${loan.status}`
      });
    }

    // Calculate settlement amount
    const proposedDate = settlementDate ? new Date(settlementDate) : new Date();
    const settlement = loan.calculateEarlySettlementAmount(proposedDate);

    res.json({
      success: true,
      message: 'Settlement quote generated successfully',
      data: {
        loanNumber: loan.loanNumber,
        currentStatus: loan.status,
        settlement: settlement,
        savingsMessage: settlement.futureInterestSaved > 0 
          ? `Pay off now and save ZMW ${settlement.futureInterestSaved.toFixed(2)} in future interest!`
          : null
      }
    });

  } catch (error) {
    console.error('Settlement quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate settlement quote',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/loans/:id/prepayment
// @desc    Record a prepayment (extra payment beyond schedule)
// @access  Private - Lender admin only
router.post('/:id/prepayment', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, allocationStrategy, notes } = req.body;

    // Validate inputs
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid prepayment amount is required (must be greater than zero)'
      });
    }

    if (!allocationStrategy || !['reduce_term', 'reduce_payment'].includes(allocationStrategy)) {
      return res.status(400).json({
        success: false,
        message: 'Allocation strategy must be either "reduce_term" or "reduce_payment"'
      });
    }

    const loan = await Loan.findById(id)
      .populate('product', 'name fees')
      .populate('applicant', 'firstName lastName email');
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions (multi-tenant)
    if (!canWriteRepayment(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Check if loan can accept prepayment
    if (!loan.canAcceptPrepayment()) {
      return res.status(400).json({
        success: false,
        message: `Loan cannot accept prepayments in current status: ${loan.status}`
      });
    }

    // Get balances before prepayment
    const beforeBalance = loan.calculateRemainingBalance();
    const beforeInterest = loan.calculateAccruedInterest();

    // Record prepayment
    const prepayment = loan.recordPrepayment(
      parseFloat(amount),
      allocationStrategy,
      req.user.id,
      notes || ''
    );

    // Recalculate schedule based on strategy
    const oldScheduleLength = loan.repaymentSchedule.length;
    loan.recalculateSchedule(allocationStrategy);
    const newScheduleLength = loan.repaymentSchedule.length;

    // Save loan with prepayment and new schedule
    await loan.save();

    // Get balances after prepayment
    const afterBalance = loan.calculateRemainingBalance();
    const afterInterest = loan.calculateAccruedInterest();

    res.json({
      success: true,
      message: 'Prepayment recorded successfully',
      data: {
        prepayment: prepayment,
        summary: {
          beforeBalance: parseFloat(beforeBalance.toFixed(2)),
          afterBalance: parseFloat(afterBalance.toFixed(2)),
          principalReduction: parseFloat((beforeBalance - afterBalance).toFixed(2)),
          beforeInterest: parseFloat(beforeInterest.toFixed(2)),
          afterInterest: parseFloat(afterInterest.toFixed(2)),
          interestReduction: parseFloat((beforeInterest - afterInterest).toFixed(2))
        },
        schedule: {
          oldLength: oldScheduleLength,
          newLength: newScheduleLength,
          installmentsReduced: allocationStrategy === 'reduce_term' 
            ? oldScheduleLength - newScheduleLength 
            : 0
        },
        loan: {
          loanNumber: loan.loanNumber,
          status: loan.status,
          applicant: loan.applicant,
          totalPrepayments: loan.prepayments.length
        },
        nextSteps: allocationStrategy === 'reduce_term' 
          ? `Schedule recalculated: ${oldScheduleLength - newScheduleLength} installment(s) removed`
          : 'Schedule recalculated: monthly payment reduced'
      }
    });

  } catch (error) {
    console.error('Prepayment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record prepayment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/loans/:id/early-settlement
// @desc    Settle loan completely (pay off entire remaining balance)
// @access  Private - Lender admin only
router.post('/:id/early-settlement', requireAuth, authorize('lender_admin', 'lender_officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { settlementDate, paymentReference } = req.body;

    const loan = await Loan.findById(id)
      .populate('product', 'name fees')
      .populate('applicant', 'firstName lastName email');
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions (multi-tenant)
    if (!canWriteRepayment(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Check if loan can be settled
    if (!loan.canAcceptPrepayment()) {
      return res.status(400).json({
        success: false,
        message: `Loan cannot be settled in current status: ${loan.status}`
      });
    }

    // Check if already settled
    if (loan.earlySettlement?.settled) {
      return res.status(400).json({
        success: false,
        message: 'Loan has already been settled early',
        data: {
          settlementDate: loan.earlySettlement.settlementDate,
          settlementAmount: loan.earlySettlement.settlementAmount
        }
      });
    }

    // Calculate settlement amount
    const proposedDate = settlementDate ? new Date(settlementDate) : new Date();
    const settlement = loan.calculateEarlySettlementAmount(proposedDate);

    // Record settlement
    loan.earlySettlement = {
      settled: true,
      settlementDate: proposedDate,
      settlementAmount: settlement.totalPayoff,
      earlySettlementFee: settlement.earlySettlementFee,
      principalBalance: settlement.principalBalance,
      interestBalance: settlement.interestBalance,
      savingsRealized: settlement.futureInterestSaved,
      settledBy: req.user.id
    };

    // Mark loan as completed
    loan.status = 'completed';

    // Mark all remaining installments as waived — the settlement amount is
    // recorded once in loan.earlySettlement.settlementAmount, not per-installment
    loan.repaymentSchedule.forEach(installment => {
      if (installment.status === 'pending') {
        installment.status = 'waived';
        installment.paidAt = proposedDate; // waived-at timestamp
        installment.paidAmount = 0;
      }
    });

    await loan.save();

    res.json({
      success: true,
      message: 'Loan settled successfully',
      data: {
        loanNumber: loan.loanNumber,
        applicant: loan.applicant,
        settlement: {
          settlementDate: loan.earlySettlement.settlementDate,
          totalPaid: loan.earlySettlement.settlementAmount,
          breakdown: {
            principal: loan.earlySettlement.principalBalance,
            interest: loan.earlySettlement.interestBalance,
            fee: loan.earlySettlement.earlySettlementFee
          },
          savingsRealized: loan.earlySettlement.savingsRealized
        },
        newStatus: loan.status,
        paymentReference: paymentReference || null,
        congratulationsMessage: loan.earlySettlement.savingsRealized > 0
          ? `Congratulations! You saved ZMW ${loan.earlySettlement.savingsRealized.toFixed(2)} in future interest by settling early!`
          : 'Loan settled successfully!'
      }
    });

  } catch (error) {
    console.error('Early settlement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process early settlement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/loans/:id/prepayment-history
// @desc    Get all prepayments for a loan
// @access  Private
router.get('/:id/prepayment-history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findById(id)
      .populate('prepayments.recordedBy', 'firstName lastName email')
      .select('loanNumber prepayments earlySettlement company lenderCompany');
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions (multi-tenant)
    if (!canReadLoan(req.user, loan)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    // Calculate summary
    const totalPrepaid = loan.prepayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPrincipalPaid = loan.prepayments.reduce((sum, p) => sum + p.principalPortion, 0);
    const totalInterestPaid = loan.prepayments.reduce((sum, p) => sum + p.interestPortion, 0);

    res.json({
      success: true,
      message: 'Prepayment history retrieved successfully',
      data: {
        loanNumber: loan.loanNumber,
        prepayments: loan.prepayments,
        summary: {
          totalPrepayments: loan.prepayments.length,
          totalAmount: parseFloat(totalPrepaid.toFixed(2)),
          totalPrincipal: parseFloat(totalPrincipalPaid.toFixed(2)),
          totalInterest: parseFloat(totalInterestPaid.toFixed(2))
        },
        earlySettlement: loan.earlySettlement?.settled ? {
          settled: true,
          date: loan.earlySettlement.settlementDate,
          amount: loan.earlySettlement.settlementAmount,
          savingsRealized: loan.earlySettlement.savingsRealized
        } : null
      }
    });

  } catch (error) {
    console.error('Prepayment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve prepayment history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
