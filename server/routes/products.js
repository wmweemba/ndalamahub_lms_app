const express = require('express');
const router = express.Router();
const LoanProduct = require('../models/LoanProduct');
const { authenticateToken, authorize } = require('../middleware/auth');

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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
    });
  }
});

module.exports = router;
