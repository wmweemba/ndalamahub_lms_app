const express = require('express');
const router = express.Router();
const LoanProduct = require('../models/LoanProduct');
const Company = require('../models/Company');
const { authenticateToken, authorize } = require('../middleware/auth');

// Get products available for loan application (for corporate users, returns lender's products)
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    
    const filter = { isActive: true }; // Only active products for applications
    
    // Determine which company's products to show
    let productCompanyId;
    
    if (req.user.role === 'super_user') {
      // Super user can see all products, or filter by company
      if (req.query.company) {
        productCompanyId = req.query.company;
      }
      // If no company specified, show all
    } else {
      // Get user's company to check if it's a lender or corporate
      const userCompany = await Company.findById(req.user.company);
      
      if (!userCompany) {
        return res.status(404).json({
          success: false,
          message: 'User company not found'
        });
      }
      
      if (userCompany.type === 'lender') {
        // Lender users see their own products
        productCompanyId = req.user.company;
      } else if (userCompany.type === 'corporate') {
        // Corporate users see their lender's products
        if (!userCompany.lenderCompany) {
          return res.status(400).json({
            success: false,
            message: 'Your company is not linked to a lender. Please contact your administrator.'
          });
        }
        productCompanyId = userCompany.lenderCompany;
      }
    }
    
    // Apply company filter if determined
    if (productCompanyId) {
      filter.company = productCompanyId;
    }
    
    // Category filter
    if (category) {
      filter.category = category;
    }
    
    // Active status filter (override default if specified)
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Text search
    if (search) {
      filter.$text = { $search: search };
    }
    
    const products = await LoanProduct.find(filter)
      .populate('company', 'name type')
      .sort({ category: 1, name: 1 });
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching available products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all products (filtered by company for non-super users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    
    const filter = {};
    
    // Company-based filtering (multi-tenant isolation)
    if (req.user.role !== 'super_user') {
      filter.company = req.user.company;
    } else if (req.query.company) {
      // Allow super_user to filter by specific company
      filter.company = req.query.company;
    }
    
    // Category filter
    if (category) {
      filter.category = category;
    }
    
    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Text search
    if (search) {
      filter.$text = { $search: search };
    }
    
    const products = await LoanProduct.find(filter)
      .populate('company', 'name type')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ category: 1, name: 1 });
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single product by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id)
      .populate('company', 'name type')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Verify company access (unless super_user)
    if (req.user.role !== 'super_user' && product.company._id.toString() !== req.user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this product'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get products by category
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.role === 'super_user' ? null : req.user.company;
    const products = await LoanProduct.findByCategory(req.params.category, companyId);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new product (admin only)
router.post('/', authenticateToken, authorize(['super_user', 'lender_admin']), async (req, res) => {
  try {
    // Set company from authenticated user (unless super_user specifies one)
    const productData = {
      ...req.body,
      company: req.user.role === 'super_user' && req.body.company ? req.body.company : req.user.company,
      createdBy: req.user.id
    };
    
    const product = new LoanProduct(productData);
    await product.save();
    
    const populatedProduct = await LoanProduct.findById(product._id)
      .populate('company', 'name type')
      .populate('createdBy', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      data: populatedProduct,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, authorize(['super_user', 'lender_admin']), async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Verify company access (unless super_user)
    if (req.user.role !== 'super_user' && product.company.toString() !== req.user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this product'
      });
    }
    
    // Update fields
    Object.assign(product, req.body);
    product.updatedBy = req.user.id;
    
    await product.save();
    
    const updatedProduct = await LoanProduct.findById(product._id)
      .populate('company', 'name type')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, authorize(['super_user', 'lender_admin']), async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Verify company access (unless super_user)
    if (req.user.role !== 'super_user' && product.company.toString() !== req.user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to delete this product'
      });
    }
    
    // Soft delete by setting isActive to false
    product.isActive = false;
    product.updatedBy = req.user.id;
    await product.save();
    
    res.json({
      success: true,
      message: 'Product deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Check eligibility for a product
router.post('/:id/check-eligibility', authenticateToken, async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not currently active'
      });
    }
    
    const { applicant } = req.body;
    
    if (!applicant) {
      return res.status(400).json({
        success: false,
        message: 'Applicant details are required'
      });
    }
    
    const result = product.checkEligibility(applicant);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Calculate fees for a loan amount
router.post('/:id/calculate-fees', authenticateToken, async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const { loanAmount } = req.body;
    
    if (!loanAmount || loanAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid loan amount is required'
      });
    }
    
    if (!product.isAmountValid(loanAmount)) {
      return res.status(400).json({
        success: false,
        message: `Loan amount must be between ${product.amount.currency} ${product.amount.min} and ${product.amount.currency} ${product.amount.max}`
      });
    }
    
    const processingFee = product.calculateProcessingFee(loanAmount);
    const insuranceFee = product.calculateInsuranceFee(loanAmount);
    const totalUpfrontFees = product.calculateUpfrontFees(loanAmount);
    
    res.json({
      success: true,
      data: {
        loanAmount,
        currency: product.amount.currency,
        fees: {
          processingFee,
          insuranceFee,
          totalUpfrontFees
        },
        netDisbursement: loanAmount - totalUpfrontFees
      }
    });
  } catch (error) {
    console.error('Error calculating fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating fees',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get product statistics (admin only)
router.get('/stats/overview', authenticateToken, authorize(['super_user', 'lender_admin']), async (req, res) => {
  try {
    const companyFilter = req.user.role === 'super_user' ? {} : { company: req.user.company };
    
    const [
      totalProducts,
      activeProducts,
      productsByCategory,
      avgInterestRate
    ] = await Promise.all([
      LoanProduct.countDocuments(companyFilter),
      LoanProduct.countDocuments({ ...companyFilter, isActive: true }),
      LoanProduct.aggregate([
        { $match: companyFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      LoanProduct.aggregate([
        { $match: { ...companyFilter, isActive: true } },
        { $group: { _id: null, avgRate: { $avg: '$interestRate.default' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
        productsByCategory,
        avgInterestRate: avgInterestRate[0]?.avgRate || 0
      }
    });
  } catch (error) {
    console.error('Error fetching product statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Calculate repayment schedule preview for a loan
router.post('/:id/calculate-schedule', authenticateToken, async (req, res) => {
  try {
    const product = await LoanProduct.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const { amount, term, repaymentFrequency } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid loan amount is required'
      });
    }
    
    if (!term || term <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid loan term is required'
      });
    }
    
    if (!product.isAmountValid(amount)) {
      return res.status(400).json({
        success: false,
        message: `Loan amount must be between ${product.amount.currency} ${product.amount.min} and ${product.amount.currency} ${product.amount.max}`
      });
    }
    
    if (term < product.term.min || term > product.term.max) {
      return res.status(400).json({
        success: false,
        message: `Loan term must be between ${product.term.min} and ${product.term.max} months`
      });
    }
    
    // Use interest calculator to generate schedule
    const interestCalculator = require('../utils/interestCalculator');
    const frequency = repaymentFrequency || product.repaymentFrequency[0] || 'monthly';
    const interestRate = product.interestRate.default;
    const accrualBasis = product.interestCalculation.dayCountConvention || 'actual/365';
    
    let schedule = [];
    let monthlyPayment = 0;
    let totalRepayment = 0;
    let totalInterest = 0;
    
    // Calculate based on method
    switch (product.interestCalculation.method) {
      case 'reducing_balance':
        // Calculate monthly payment using PMT formula
        monthlyPayment = interestCalculator.calculateMonthlyPayment(amount, interestRate, term);
        
        // Build schedule
        let balance = amount;
        const startDate = new Date();
        
        for (let i = 1; i <= term; i++) {
          const dueDate = interestCalculator.addMonths(startDate, i);
          const prevDate = i === 1 ? startDate : interestCalculator.addMonths(startDate, i - 1);
          
          const interestPayment = interestCalculator.calculatePeriodInterest(
            balance,
            interestRate,
            prevDate,
            dueDate,
            accrualBasis
          );
          
          const principalPayment = monthlyPayment - interestPayment;
          balance = Math.max(0, balance - principalPayment);
          
          schedule.push({
            installmentNumber: i,
            principalPayment,
            interestPayment,
            totalPayment: monthlyPayment,
            remainingBalance: balance
          });
          
          totalRepayment += monthlyPayment;
          totalInterest += interestPayment;
        }
        break;
        
      case 'flat_rate':
        // Flat rate: Interest calculated on original principal for entire term
        const flatInterest = interestCalculator.calculateFlatRateInterest(amount, interestRate, term);
        totalInterest = flatInterest;
        totalRepayment = amount + flatInterest;
        monthlyPayment = totalRepayment / term;
        
        // Build schedule with equal payments
        let flatBalance = amount;
        const flatPrincipalPerPayment = amount / term;
        const flatInterestPerPayment = flatInterest / term;
        
        for (let i = 1; i <= term; i++) {
          flatBalance -= flatPrincipalPerPayment;
          
          schedule.push({
            installmentNumber: i,
            principalPayment: flatPrincipalPerPayment,
            interestPayment: flatInterestPerPayment,
            totalPayment: monthlyPayment,
            remainingBalance: Math.max(0, flatBalance)
          });
        }
        break;
        
      case 'simple_interest':
        // Simple interest: Interest per period on original principal
        // Formula: Total Interest = Principal × Rate × (Term in months / 12)
        // For 6 months at 24%: K50,000 × 0.24 × (6/12) = K6,000
        const simpleInterestTotal = amount * (interestRate / 100) * (term / 12);
        totalInterest = simpleInterestTotal;
        totalRepayment = amount + simpleInterestTotal;
        monthlyPayment = totalRepayment / term;
        
        // Build schedule with equal payments
        let simpleBalance = amount;
        const simplePrincipalPerPayment = amount / term;
        const simpleInterestPerPayment = simpleInterestTotal / term;
        
        for (let i = 1; i <= term; i++) {
          simpleBalance -= simplePrincipalPerPayment;
          
          schedule.push({
            installmentNumber: i,
            principalPayment: simplePrincipalPerPayment,
            interestPayment: simpleInterestPerPayment,
            totalPayment: monthlyPayment,
            remainingBalance: Math.max(0, simpleBalance)
          });
        }
        break;
        
      case 'interest_only':
        // Interest-only: Pay interest each period, principal at end
        // Formula: Monthly Interest = Principal × (Rate / 12)
        // For 24 months at 14%: K40,000 × 0.14 / 12 = K466.67 per month
        const monthlyInterest = (amount * (interestRate / 100)) / 12;
        
        for (let i = 1; i <= term; i++) {
          const isLastPayment = i === term;
          const principalPayment = isLastPayment ? amount : 0;
          const interestPayment = monthlyInterest;
          const totalPayment = principalPayment + interestPayment;
          
          schedule.push({
            installmentNumber: i,
            principalPayment,
            interestPayment,
            totalPayment,
            remainingBalance: isLastPayment ? 0 : amount
          });
          
          totalRepayment += totalPayment;
          totalInterest += interestPayment;
        }
        
        monthlyPayment = monthlyInterest; // Show regular payment (not balloon)
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported calculation method: ${product.interestCalculation.method}`
        });
    }
    
    res.json({
      success: true,
      data: {
        amount,
        term,
        frequency,
        method: product.interestCalculation.method,
        interestRate,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalRepayment: Math.round(totalRepayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        schedule: schedule.map(inst => ({
          installmentNumber: inst.installmentNumber,
          principalPayment: Math.round(inst.principalPayment * 100) / 100,
          interestPayment: Math.round(inst.interestPayment * 100) / 100,
          totalPayment: Math.round(inst.totalPayment * 100) / 100,
          remainingBalance: Math.round(inst.remainingBalance * 100) / 100
        }))
      }
    });
  } catch (error) {
    console.error('Error calculating schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating repayment schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
