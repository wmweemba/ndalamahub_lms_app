const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const User = require('../models/User');
const Company = require('../models/Company');
const LoanProduct = require('../models/LoanProduct');
const { 
  authenticateToken, 
  authorize, 
  authorizeMinRole, 
  authorizeCompany 
} = require('../middleware/auth');

// ...existing code...

const ExcelJS = require('exceljs');
// @route   GET /api/loans/:id/repayment-schedule/export/excel
// @desc    Export detailed repayment schedule for a loan as Excel
// @access  Private (same as loan details)
router.get('/:id/repayment-schedule/export/excel', authenticateToken, async (req, res) => {
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
    let hasAccess = false;
    if (req.user.role === 'platform_admin') {
      hasAccess = true;
    } else if (req.user.role === 'lender_admin') {
      hasAccess = loan.lenderCompany && loan.lenderCompany._id.toString() === req.user.company.toString();
    } else if (req.user.role === 'employer_admin' || req.user.role === 'employer_hr') {
      hasAccess = loan.company && loan.company._id.toString() === req.user.company.toString();
    } else if (req.user.role === 'borrower' || req.user.role === 'lender_officer') {
      hasAccess = loan.applicant && loan.applicant._id.toString() === req.user.id.toString();
    } else {
      hasAccess = loan.applicant && loan.applicant._id.toString() === req.user.id.toString();
    }
    if (!hasAccess) {
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
    if (req.user.role === 'platform_admin') {
      // Super users can see all loans
      if (companyId) filter.company = companyId;
      if (lenderCompanyId) filter.lenderCompany = lenderCompanyId;
    } else if (req.user.role === 'lender_admin') {
      // Lender admins see loans from their lender company and their corporate clients
      filter.$or = [
        { lenderCompany: req.user.company },
        { company: { $in: await Company.find({ lenderCompany: req.user.company }).select('_id') } }
      ];
    } else if (req.user.role === 'employer_admin') {
      // Corporate admins see loans from their company
      filter.company = req.user.company;
    } else if (req.user.role === 'employer_hr') {
      // HR can see loans from their company
      filter.company = req.user.company;
    } else if (req.user.role === 'borrower' || req.user.role === 'lender_officer') {
      // Corporate users and lender users can only see their own loans
      filter.applicant = req.user.id;
    } else {
      // Default: users can only see their own loans
      filter.applicant = req.user.id;
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

    // Check access permissions based on role
    let hasAccess = false;

    if (req.user.role === 'platform_admin') {
      hasAccess = true;
    } else if (req.user.role === 'lender_admin') {
      // Lender admins can see loans from their lender company and their corporate clients
      hasAccess = loan.lenderCompany.toString() === req.user.company.toString();
    } else if (req.user.role === 'employer_admin' || req.user.role === 'employer_hr') {
      // Corporate admins and HR can see loans from their company
      hasAccess = loan.company.toString() === req.user.company.toString();
    } else if (req.user.role === 'borrower' || req.user.role === 'lender_officer') {
      // Corporate users and lender users can only see their own loans
      hasAccess = loan.applicant.toString() === req.user.id.toString();
    } else {
      // Default: users can only see their own loans
      hasAccess = loan.applicant.toString() === req.user.id.toString();
    }

    if (!hasAccess) {
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

    // Check access permissions based on role
    let hasAccess = false;

    if (req.user.role === 'platform_admin') {
      hasAccess = true;
    } else if (req.user.role === 'lender_admin') {
      // Lender admins can see loans from their lender company and their corporate clients
      hasAccess = loan.lenderCompany._id.toString() === req.user.company.toString();
    } else if (req.user.role === 'employer_admin' || req.user.role === 'employer_hr') {
      // Corporate admins and HR can see loans from their company
      hasAccess = loan.company._id.toString() === req.user.company.toString();
    } else if (req.user.role === 'borrower' || req.user.role === 'lender_officer') {
      // Corporate users and lender users can only see their own loans
      hasAccess = loan.applicant._id.toString() === req.user.id.toString();
    } else {
      // Default: users can only see their own loans
      hasAccess = loan.applicant._id.toString() === req.user.id.toString();
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this loan'
      });
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
router.post('/', authenticateToken, authorize('borrower'), async (req, res) => {
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
          accrualBasis: product.interestCalculation.dayCountConvention
        },
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
// @access  Private (HR and Admin roles)
router.put('/:id/approve', authenticateToken, authorize('employer_hr', 'employer_admin', 'lender_admin'), async (req, res) => {
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
    if (
      req.user.role !== 'platform_admin' &&
      req.user.role !== 'lender_admin'
    ) {
      // Compare the _id of the populated company object
      if (
        req.user.company.toString() !== loan.company._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    // Update loan status
    loan.status = 'approved';
    loan.approvedBy = req.user.id;
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
router.put('/:id/reject', authenticateToken, authorize('employer_hr', 'employer_admin', 'lender_admin'), async (req, res) => {
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
    if (loan.status !== 'pending' && loan.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'Loan cannot be rejected in its current status'
      });
    }

    // Check access permissions
    if (req.user.role !== 'platform_admin' && req.user.role !== 'lender_admin') {
      if (req.user.company.toString() !== loan.company._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }

    // Update loan status
    loan.status = 'rejected';
    loan.approvedBy = req.user.id;
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
// @access  Private (Lender Admin only)
router.put('/:id/disburse', authenticateToken, authorize('lender_admin'), async (req, res) => {
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
    let hasAccess = false;

    if (req.user.role === 'platform_admin') {
      hasAccess = true;
    } else if (req.user.role === 'lender_admin') {
      // Lender admins can disburse loans where they are the lender company
      hasAccess = loan.lenderCompany && loan.lenderCompany._id.toString() === req.user.company.toString();
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only disburse loans for your lender company'
      });
    }

    // Update loan status to active after disbursement
    loan.status = 'active';
    loan.disbursedBy = req.user.id;
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
// @desc    Record loan repayment with payment details
// @access  Private (Lender Admin only)
router.put('/:id/repayment', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
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
    if (req.user.role !== 'platform_admin') {
      if (!loan.lenderCompany || loan.lenderCompany.toString() !== req.user.company.toString()) {
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

// ============================================================
// PREPAYMENT & EARLY SETTLEMENT ENDPOINTS
// ============================================================

// @route   GET /api/loans/:id/settlement-quote
// @desc    Get early settlement quote (read-only, no state change)
// @access  Private - Lender admin only
router.get('/:id/settlement-quote', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
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

    // Check access permissions (multi-tenant)
    if (req.user.role !== 'platform_admin') {
      // Lender admin/officer can only access loans from their corporate clients
      if (req.user.role === 'lender_admin' || req.user.role === 'lender_officer') {
        if (loan.lenderCompany.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      } else {
        // Other roles can only access their own company loans
        if (loan.company.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      }
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
router.post('/:id/prepayment', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
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
    if (req.user.role !== 'platform_admin') {
      if (req.user.role === 'lender_admin' || req.user.role === 'lender_officer') {
        if (loan.lenderCompany.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Only lender staff can record prepayments'
        });
      }
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
router.post('/:id/early-settlement', authenticateToken, authorize('lender_admin', 'lender_officer'), async (req, res) => {
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
    if (req.user.role !== 'platform_admin') {
      if (req.user.role === 'lender_admin' || req.user.role === 'lender_officer') {
        if (loan.lenderCompany.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Only lender staff can process early settlements'
        });
      }
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

    // Mark all remaining installments as cancelled/settled
    loan.repaymentSchedule.forEach(installment => {
      if (installment.status === 'pending') {
        installment.status = 'paid';
        installment.paidAt = proposedDate;
        installment.paidAmount = 0; // Settled via early settlement, not individual payment
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
router.get('/:id/prepayment-history', authenticateToken, async (req, res) => {
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
    if (req.user.role !== 'platform_admin') {
      if (req.user.role === 'lender_admin') {
        if (loan.lenderCompany.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      } else {
        if (loan.company.toString() !== req.user.company.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this loan'
          });
        }
      }
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
