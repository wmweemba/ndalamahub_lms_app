const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const { 
  authenticateToken, 
  authorize, 
  authorizeMinRole, 
  authorizeCompany 
} = require('../middleware/auth');

// @route   GET /api/companies
// @desc    Get all companies (with filters)
// @access  Private (Admin roles only)
router.get('/', authenticateToken, authorizeMinRole('client_admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      isActive,
      search
    } = req.query;

    // Build filter object
    const filter = {};

    // Type filter
    if (type) {
      filter.type = type;
    }

    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { 'contactInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Super users can see all companies, others see only their company and related companies
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        // Client admins see their lender company and all their corporate clients
        filter.$or = [
          { _id: req.user.company },
          { lenderCompany: req.user.company }
        ];
      } else {
        // Other roles see only their company
        filter._id = req.user.company;
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Company.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get companies with pagination
    const companies = await Company.find(filter)
      .populate('lenderCompany', 'name type')
      .populate('corporateClients', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        companies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get companies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/companies/:id
// @desc    Get company by ID
// @access  Private (Admin roles only)
router.get('/:id', authenticateToken, authorizeMinRole('client_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check access permissions
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        // Client admins can access their lender company and their corporate clients
        if (req.user.company.toString() !== id && 
            !(await Company.findOne({ _id: id, lenderCompany: req.user.company }))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      } else {
        // Other roles can only access their own company
        if (req.user.company.toString() !== id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      }
    }

    const company = await Company.findById(id)
      .populate('lenderCompany', 'name type')
      .populate('corporateClients', 'name type');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: { company }
    });

  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get company',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (Super user and client admin only)
router.post('/', authenticateToken, authorize('super_user', 'client_admin'), async (req, res) => {
  try {
    const {
      name,
      type,
      registrationNumber,
      taxNumber,
      address,
      contactInfo,
      lenderCompanyId,
      settings,
      logo,
      description
    } = req.body;

    // Validate required fields
    if (!name || !type || !registrationNumber || !address || !contactInfo) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if registration number already exists
    const existingCompany = await Company.findOne({ registrationNumber });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this registration number already exists'
      });
    }

    // Create company object
    const companyData = {
      name,
      type,
      registrationNumber,
      address,
      contactInfo
    };

    // Add optional fields
    if (taxNumber) companyData.taxNumber = taxNumber;
    if (logo) companyData.logo = logo;
    if (description) companyData.description = description;
    if (settings) companyData.settings = settings;

    // Handle lender company relationship
    if (type === 'corporate') {
      if (!lenderCompanyId) {
        return res.status(400).json({
          success: false,
          message: 'Lender company is required for corporate companies'
        });
      }

      // Check if lender company exists and is a lender
      const lenderCompany = await Company.findById(lenderCompanyId);
      if (!lenderCompany || lenderCompany.type !== 'lender') {
        return res.status(400).json({
          success: false,
          message: 'Invalid lender company'
        });
      }

      // Check access permissions
      if (req.user.role !== 'super_user' && 
          req.user.company.toString() !== lenderCompanyId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to create corporate for this lender'
        });
      }

      companyData.lenderCompany = lenderCompanyId;
    }

    // Create new company
    const company = new Company(companyData);
    await company.save();

    // Update lender company's corporate clients list
    if (type === 'corporate' && lenderCompanyId) {
      await Company.findByIdAndUpdate(lenderCompanyId, {
        $push: { corporateClients: company._id }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: {
        company: company.toJSON()
      }
    });

  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (Admin roles only)
router.put('/:id', authenticateToken, authorizeMinRole('client_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      taxNumber,
      address,
      contactInfo,
      settings,
      logo,
      description,
      isActive
    } = req.body;

    // Check access permissions
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        // Client admins can update their lender company and their corporate clients
        if (req.user.company.toString() !== id && 
            !(await Company.findOne({ _id: id, lenderCompany: req.user.company }))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      } else {
        // Other roles can only update their own company
        if (req.user.company.toString() !== id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      }
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update fields
    if (name) company.name = name;
    if (taxNumber !== undefined) company.taxNumber = taxNumber;
    if (address) company.address = address;
    if (contactInfo) company.contactInfo = contactInfo;
    if (settings) company.settings = { ...company.settings, ...settings };
    if (logo !== undefined) company.logo = logo;
    if (description !== undefined) company.description = description;
    if (isActive !== undefined) company.isActive = isActive;

    await company.save();

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: {
        company: company.toJSON()
      }
    });

  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Super user only)
router.delete('/:id', authenticateToken, authorize('super_user'), async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if company has users
    const userCount = await User.countDocuments({ company: id });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete company with active users'
      });
    }

    // Remove from lender's corporate clients list
    if (company.type === 'corporate' && company.lenderCompany) {
      await Company.findByIdAndUpdate(company.lenderCompany, {
        $pull: { corporateClients: company._id }
      });
    }

    await Company.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });

  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete company',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/companies/:id/users
// @desc    Get users for a specific company
// @access  Private (Admin roles only)
router.get('/:id/users', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      role,
      department,
      isActive,
      search
    } = req.query;

    // Check access permissions
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        // Client admins can access their lender company and their corporate clients
        if (req.user.company.toString() !== id && 
            !(await Company.findOne({ _id: id, lenderCompany: req.user.company }))) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      } else {
        // Other roles can only access their own company
        if (req.user.company.toString() !== id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this company'
          });
        }
      }
    }

    // Build filter object
    const filter = { company: id };

    // Role filter
    if (role) {
      filter.role = role;
    }

    // Department filter
    if (department) {
      filter.department = { $regex: department, $options: 'i' };
    }

    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Get company users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get company users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router; 