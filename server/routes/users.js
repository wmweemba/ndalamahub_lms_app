const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const { 
  authenticateToken, 
  authorize, 
  authorizeMinRole, 
  authorizeCompany 
} = require('../middleware/auth');
const { 
  validatePassword, 
  validateEmail, 
  validatePhoneNumber, 
  formatPhoneNumber 
} = require('../utils/auth');

// @route   GET /api/users
// @desc    Get all users (with filters)
// @access  Private (Admin roles only)
router.get('/', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      department,
      isActive,
      companyId,
      search
    } = req.query;

    // Build filter object
    const filter = {};

    // Company filter
    if (req.user.role !== 'super_user') {
      filter.company = req.user.company;
    } else if (companyId) {
      filter.company = companyId;
    }

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
        { username: { $regex: search, $options: 'i' } },
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
      .populate('company', 'name type')
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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin roles or own profile)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is accessing their own profile or has admin rights
    if (req.user._id.toString() !== id && 
        !req.user.hasPermission('corporate_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(id)
      .populate('company', 'name type')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check company access for non-super users
    if (req.user.role !== 'super_user' && 
        req.user.company.toString() !== user.company._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this user'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin roles only)
router.post('/', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      phone,
      password,
      role,
      companyId,
      department,
      employeeId
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !username || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate phone number
    if (!validatePhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Determine company ID
    let targetCompanyId = companyId;
    if (req.user.role !== 'super_user') {
      targetCompanyId = req.user.company;
    }

    // Check if company exists
    const company = await Company.findById(targetCompanyId);
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Create user object
    const userData = {
      firstName,
      lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone: formatPhoneNumber(phone),
      password,
      role,
      company: targetCompanyId
    };

    // Add department and employeeId for staff and HR roles
    if (role === 'staff' || role === 'corporate_hr') {
      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Department is required for staff and HR roles'
        });
      }
      userData.department = department;
    }

    if (role === 'staff') {
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is required for staff role'
        });
      }
      userData.employeeId = employeeId;
    }

    // Create new user
    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin roles or own profile)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      department,
      employeeId,
      isActive
    } = req.body;

    // Check if user is updating their own profile or has admin rights
    if (req.user._id.toString() !== id && 
        !req.user.hasPermission('corporate_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check company access for non-super users
    if (req.user.role !== 'super_user' && 
        req.user.company.toString() !== user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this user'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      if (!validatePhoneNumber(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number'
        });
      }
      user.phone = formatPhoneNumber(phone);
    }

    // Email update with validation
    if (email && email !== user.email) {
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      user.email = email.toLowerCase();
    }

    // Role update (admin only)
    if (role && req.user.hasPermission('corporate_admin')) {
      user.role = role;
    }

    // Department update
    if (department && (user.role === 'staff' || user.role === 'corporate_hr')) {
      user.department = department;
    }

    // Employee ID update (staff only)
    if (employeeId && user.role === 'staff') {
      user.employeeId = employeeId;
    }

    // Active status update (admin only)
    if (isActive !== undefined && req.user.hasPermission('corporate_admin')) {
      user.isActive = isActive;
    }

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin roles only)
router.delete('/:id', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check company access for non-super users
    if (req.user.role !== 'super_user' && 
        req.user.company.toString() !== user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this user'
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/users/:id/password
// @desc    Change user password
// @access  Private (Own profile or admin)
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Check if user is changing their own password or has admin rights
    if (req.user._id.toString() !== id && 
        !req.user.hasPermission('corporate_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check company access for non-super users
    if (req.user.role !== 'super_user' && 
        req.user.company.toString() !== user.company.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this user'
      });
    }

    // If changing own password, verify current password
    if (req.user._id.toString() === id) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required'
        });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router; 