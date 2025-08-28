const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Loan = require('../models/Loan');
const { authenticateToken, authorizeMinRole } = require('../middleware/auth');

// @route   GET /api/system/info
// @desc    Get system information
// @access  Private (Lender Admin and above)
router.get('/info', authenticateToken, authorizeMinRole('lender_admin'), async (req, res) => {
  try {
    // Get basic system statistics
    const totalUsers = await User.countDocuments();
    const totalCompanies = await Company.countDocuments();
    const totalLoans = await Loan.countDocuments();

    // Mock system info - in a real app, you'd get this from actual system monitoring
    const systemInfo = {
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      dbStatus: 'connected',
      totalUsers,
      totalCompanies,
      totalLoans,
      storageUsed: 1024 * 1024 * 250, // 250MB mock data
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    };

    res.json({
      success: true,
      data: systemInfo
    });

  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/system/settings
// @desc    Get system settings
// @access  Private (Lender Admin and above)
router.get('/settings', authenticateToken, authorizeMinRole('lender_admin'), async (req, res) => {
  try {
    // In a real application, these would be stored in the database
    // For now, return default settings
    const settings = {
      system: {
        maintenanceMode: false,
        allowRegistration: true,
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        backupFrequency: 'daily'
      },
      email: {
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT) || 587,
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: '', // Never return password
        smtpSecure: true,
        fromEmail: process.env.FROM_EMAIL || '',
        fromName: process.env.FROM_NAME || 'NdalamaHub'
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        adminEmail: process.env.ADMIN_EMAIL || ''
      },
      api: {
        rateLimit: 100,
        enableCors: true,
        allowedOrigins: process.env.ALLOWED_ORIGINS || '',
        apiVersion: 'v1'
      }
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/system/settings
// @desc    Update system settings
// @access  Private (Super User only)
router.put('/settings', authenticateToken, authorizeMinRole('super_user'), async (req, res) => {
  try {
    const { system, email, notifications, api } = req.body;

    // In a real application, you would save these to the database
    // For now, just validate and return success
    
    // Basic validation
    if (system) {
      if (system.sessionTimeout && (system.sessionTimeout < 5 || system.sessionTimeout > 480)) {
        return res.status(400).json({
          success: false,
          message: 'Session timeout must be between 5 and 480 minutes'
        });
      }
      
      if (system.maxLoginAttempts && (system.maxLoginAttempts < 3 || system.maxLoginAttempts > 10)) {
        return res.status(400).json({
          success: false,
          message: 'Max login attempts must be between 3 and 10'
        });
      }
    }

    if (email) {
      if (email.smtpPort && (email.smtpPort < 1 || email.smtpPort > 65535)) {
        return res.status(400).json({
          success: false,
          message: 'SMTP port must be between 1 and 65535'
        });
      }
    }

    if (api) {
      if (api.rateLimit && (api.rateLimit < 10 || api.rateLimit > 1000)) {
        return res.status(400).json({
          success: false,
          message: 'Rate limit must be between 10 and 1000 requests per minute'
        });
      }
    }

    // In a real app, save to database here
    console.log('System settings would be saved:', { system, email, notifications, api });

    res.json({
      success: true,
      message: 'System settings updated successfully'
    });

  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/system/backup
// @desc    Trigger system backup
// @access  Private (Super User only)
router.post('/backup', authenticateToken, authorizeMinRole('super_user'), async (req, res) => {
  try {
    // In a real application, this would trigger an actual backup process
    const backupId = `backup_${Date.now()}`;
    
    res.json({
      success: true,
      message: 'Backup initiated successfully',
      data: {
        backupId,
        status: 'initiated',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate backup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/system/health
// @desc    Get system health status
// @access  Private (Admin roles)
router.get('/health', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected', // In real app, check actual DB connection
      services: {
        api: 'operational',
        database: 'operational',
        email: 'operational',
        storage: 'operational'
      }
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
