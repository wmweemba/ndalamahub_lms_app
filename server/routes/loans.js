const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const User = require('../models/User');
const Company = require('../models/Company');
const { 
  authenticateToken, 
  authorize, 
  authorizeMinRole, 
  authorizeCompany 
} = require('../middleware/auth');

// @route   GET /api/loans
// @desc    Get all loans (with filters)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
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
    if (status) {
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

    // Company access control
    if (req.user.role === 'super_user') {
      // Super users can see all loans
      if (companyId) filter.company = companyId;
      if (lenderCompanyId) filter.lenderCompany = lenderCompanyId;
    } else if (req.user.role === 'client_admin') {
      // Client admins see loans from their lender company and their corporate clients
      filter.$or = [
        { lenderCompany: req.user.company },
        { company: { $in: await Company.find({ lenderCompany: req.user.company }).select('_id') } }
      ];
    } else if (req.user.role === 'corporate_admin') {
      // Corporate admins see loans from their company
      filter.company = req.user.company;
    } else if (req.user.role === 'corporate_hr') {
      // HR can see loans from their company
      filter.company = req.user.company;
    } else {
      // Staff can only see their own loans
      filter.applicant = req.user._id;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Loan.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get loans with pagination
    const loans = await Loan.find(filter)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
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
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findById(id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'staff' && loan.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    if (req.user.role !== 'super_user' && req.user.role !== 'staff') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
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
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
      .populate('approvedBy', 'firstName lastName')
      .populate('disbursedBy', 'firstName lastName');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'staff' && loan.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
    }

    if (req.user.role !== 'super_user' && req.user.role !== 'staff') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    res.json({
      success: true,
      data: { loan }
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
router.post('/', authenticateToken, authorize('staff'), async (req, res) => {
  try {
    const {
      amount,
      term,
      purpose,
      guarantor,
      documents
    } = req.body;

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

    // Get user's company and lender company
    const user = await User.findById(req.user._id).populate('company');
    const company = user.company;

    // Find lender company
    let lenderCompany;
    if (company.type === 'corporate') {
      lenderCompany = await Company.findById(company.lenderCompany);
    } else {
      lenderCompany = company;
    }

    if (!lenderCompany) {
      return res.status(400).json({
        success: false,
        message: 'Lender company not found'
      });
    }

    // Check if user has existing active loans
    const existingLoans = await Loan.find({
      applicant: req.user._id,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    if (existingLoans.length > 0 && !lenderCompany.settings.allowMultipleLoans) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active loan application'
      });
    }

    // Check if amount exceeds company's maximum
    if (amount > lenderCompany.settings.maxLoanAmount) {
      return res.status(400).json({
        success: false,
        message: `Loan amount exceeds maximum allowed amount of ${lenderCompany.settings.maxLoanAmount}`
      });
    }

    // Create loan object
    const loanData = {
      applicant: req.user._id,
      company: company._id,
      lenderCompany: lenderCompany._id,
      amount,
      interestRate: lenderCompany.settings.interestRate,
      term,
      purpose,
      guarantor
    };

    // Add documents if provided
    if (documents && documents.length > 0) {
      loanData.documents = documents;
    }

    // Create new loan
    const loan = new Loan(loanData);
    await loan.save();

    // Populate references for response
    await loan.populate([
      { path: 'applicant', select: 'firstName lastName email employeeId department' },
      { path: 'company', select: 'name type' },
      { path: 'lenderCompany', select: 'name type' }
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
// @access  Private (HR and Admin roles)
router.put('/:id/approve', authenticateToken, authorize('corporate_hr', 'corporate_admin', 'client_admin'), async (req, res) => {
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
    if (req.user.role !== 'super_user' && req.user.role !== 'client_admin') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    // Update loan status
    loan.status = 'approved';
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    if (approvalNotes) loan.approvalNotes = approvalNotes;

    await loan.save();

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
// @access  Private (HR and Admin roles)
router.put('/:id/reject', authenticateToken, authorize('corporate_hr', 'corporate_admin', 'client_admin'), async (req, res) => {
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
    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan cannot be rejected in its current status'
      });
    }

    // Check access permissions
    if (req.user.role !== 'super_user' && req.user.role !== 'client_admin') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    // Update loan status
    loan.status = 'rejected';
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    loan.approvalNotes = approvalNotes;

    await loan.save();

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
// @access  Private (Admin roles)
router.put('/:id/disburse', authenticateToken, authorize('corporate_admin', 'client_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { disbursementMethod } = req.body;

    const loan = await Loan.findById(id)
      .populate('applicant', 'firstName lastName email')
      .populate('company', 'name type');

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
        message: 'Loan cannot be disbursed in its current status'
      });
    }

    // Check access permissions
    if (req.user.role !== 'super_user' && req.user.role !== 'client_admin') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    // Update loan status
    loan.status = 'disbursed';
    loan.disbursedBy = req.user._id;
    loan.disbursedAt = new Date();
    loan.startDate = new Date();
    loan.endDate = new Date(Date.now() + (loan.term * 30 * 24 * 60 * 60 * 1000)); // Approximate end date
    if (disbursementMethod) loan.disbursementMethod = disbursementMethod;

    await loan.save();

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

// @route   PUT /api/loans/:id/repayment
// @desc    Record loan repayment
// @access  Private (Admin roles)
router.put('/:id/repayment', authenticateToken, authorize('corporate_admin', 'client_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { installmentNumber, amount } = req.body;

    if (!installmentNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Installment number and amount are required'
      });
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'super_user' && req.user.role !== 'client_admin') {
      if (req.user.company.toString() !== loan.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
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

    // Update installment
    installment.paidAmount += parseFloat(amount);
    installment.paidAt = new Date();

    if (installment.paidAmount >= installment.amount) {
      installment.status = 'paid';
    } else {
      installment.status = 'partial';
    }

    // Check if all installments are paid
    const allPaid = loan.repaymentSchedule.every(inst => inst.status === 'paid');
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

module.exports = router; 