const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Loan = require('../models/Loan');
const { authenticateToken, authorizeMinRole } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Admin and above)
router.get('/stats', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
    try {
        let filter = {};
        
        // If not super_user, filter by company
        if (req.user.role !== 'super_user') {
            filter.company = req.user.company;
        }

        // Get active companies count
        const activeCompanies = await Company.countDocuments({ 
            status: 'active',
            ...filter
        });

        // Get active corporate clients
        const activeCorporates = await Company.countDocuments({
            status: 'active',
            type: 'corporate',
            ...filter
        });

        // Get active users
        const activeUsers = await User.countDocuments({
            status: 'active',
            ...filter
        });

        // Get active loans and total amount
        const loans = await Loan.find({
            status: 'active',
            ...filter
        });

        const activeLoans = loans.length;
        const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.amount, 0);

        res.json({
            success: true,
            data: {
                activeCompanies,
                activeCorporates,
                activeUsers,
                activeLoans,
                totalLoanAmount
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics',
            error: error.message
        });
    }
});

module.exports = router;