const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const { 
  authenticateToken, 
  authorize,
  authorizeRole,  // Add this
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
// @access  Private (Admin and HR roles)
router.get('/', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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
    let filter = {};

    // Company filter based on user role
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        // Lender admins can see users from their company and corporate clients
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        filter.company = {
          $in: [req.user.company, ...corporateCompanies.map(c => c._id)]
        };
      } else {
        // Other roles see only their company
        filter.company = req.user.company;
      }
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
      const searchConditions = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];

      // Add search filter to existing filters
      filter.$or = searchConditions;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);

    // Get users without pagination for settings page
    const users = await User.find(filter)
      .populate('company', 'name type')
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users // Return users array directly for settings page
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
// @access  Private (Admin and HR roles)
router.post('/', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
    try {
        console.log('=== Create User Request ===');
        console.log('Request body:', req.body);
        console.log('Request user:', req.user);
        
        const {
            firstName,
            lastName,
            username,
            email,
            phone,
            password,
            role,
            company,
            department,
            employeeId
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !username || !email || !phone || !password || !role || !company) {
            console.log('Missing required fields:', {
                firstName: !!firstName,
                lastName: !!lastName,
                username: !!username,
                email: !!email,
                phone: !!phone,
                password: !!password,
                role: !!role,
                company: !!company
            });
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Verify company exists
        const companyDoc = await Company.findById(company);
        if (!companyDoc) {
            return res.status(400).json({ 
                success: false,
                message: `Company not found with ID: ${company}` 
            });
        }

        // Company access validation - corporate users can only create users in their own company
        if (req.user.role === 'corporate_admin' || req.user.role === 'corporate_hr') {
            if (company !== req.user.company.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only create users within your own company'
                });
            }
            
            // Corporate users cannot create lender roles
            const lenderRoles = ['super_user', 'lender_admin', 'lender_user'];
            if (lenderRoles.includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot create users with lender roles'
                });
            }
            
            // Corporate HR can only create specific roles
            if (req.user.role === 'corporate_hr') {
                const allowedRoles = ['corporate_user', 'corporate_hr'];
                if (!allowedRoles.includes(role)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Corporate HR can only create corporate_user and corporate_hr roles'
                    });
                }
            }
            
            // Corporate admin can create corporate roles but not lender roles
            if (req.user.role === 'corporate_admin') {
                const allowedRoles = ['corporate_user', 'corporate_hr', 'corporate_admin'];
                if (!allowedRoles.includes(role)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Corporate admin can only create corporate roles'
                    });
                }
            }
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
                message: 'Email already exists'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Create user
        const userData = {
            firstName,
            lastName,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            phone,
            password,
            role,
            company,
            department: department || undefined
        };

        // Auto-generate employeeId for corporate users if not provided
        if ((role === 'corporate_user' || role === 'corporate_hr') && !employeeId) {
            // Generate a simple employee ID based on company and current timestamp
            const companyDoc = await Company.findById(company);
            const companyPrefix = companyDoc?.name?.substring(0, 3).toUpperCase() || 'EMP';
            const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
            userData.employeeId = `${companyPrefix}${timestamp}`;
        } else if (employeeId) {
            userData.employeeId = employeeId;
        }

        const user = new User(userData);
        const savedUser = await user.save();
        
        // Populate company information before returning
        await savedUser.populate('company', 'name type');

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: savedUser.toJSON()
        });
    } catch (error) {
        console.error('User creation error:', error);
        res.status(400).json({ 
            success: false,
            message: error.message || 'Failed to create user'
        });
    }
});

// @route   PATCH /api/users/:id/status
// @desc    Toggle user active status
// @access  Private (Admin and HR roles)
router.patch('/:id/status', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Prevent self-deactivation
    if (req.user._id.toString() === id && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
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

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user.toJSON()
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
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
    if (department !== undefined && (user.role === 'corporate_user' || user.role === 'corporate_hr')) {
      user.department = department;
    }

    // Employee ID update (corporate_user only)
    if (employeeId !== undefined && user.role === 'corporate_user') {
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
// @access  Private (Admin and HR roles)
router.delete('/:id', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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

module.exports = router;