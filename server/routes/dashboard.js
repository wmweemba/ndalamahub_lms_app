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
            isActive: true,
            ...filter
        });

        // Get active corporate clients
        const activeCorporates = await Company.countDocuments({
            isActive: true,
            type: 'corporate',
            ...filter
        });

        // Get active users
        const activeUsers = await User.countDocuments({
            isActive: true,
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

// @route   GET /api/dashboard/user-stats
// @desc    Get user-specific dashboard statistics
// @access  Private (All authenticated users)
router.get('/user-stats', authenticateToken, async (req, res) => {
    try {
        console.log('=== User dashboard stats request ===');
        console.log('User:', req.user);

        // Get user's loans
        const userLoans = await Loan.find({ 
            applicant: req.user.id 
        }).populate('company', 'name');

        console.log('Found user loans:', userLoans.length);

        // Calculate loan statistics
        const totalLoans = userLoans.length;
        const activeLoans = userLoans.filter(loan => loan.status === 'active').length;
        const pendingLoans = userLoans.filter(loan => loan.status === 'pending').length;
        const approvedLoans = userLoans.filter(loan => loan.status === 'approved').length;
        const completedLoans = userLoans.filter(loan => loan.status === 'completed').length;
        const rejectedLoans = userLoans.filter(loan => loan.status === 'rejected').length;

        // Calculate total loan amounts
        const totalLoanAmount = userLoans.reduce((sum, loan) => sum + loan.amount, 0);
        const activeLoanAmount = userLoans
            .filter(loan => loan.status === 'active')
            .reduce((sum, loan) => sum + loan.amount, 0);
        const pendingLoanAmount = userLoans
            .filter(loan => loan.status === 'pending')
            .reduce((sum, loan) => sum + loan.amount, 0);

        // Get recent loan activity (last 5 loans)
        const recentLoans = userLoans
            .sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate))
            .slice(0, 5);

        // Calculate next payment due (for active loans)
        let nextPaymentDue = null;
        const activeLoanWithPayments = userLoans.find(loan => 
            loan.status === 'active' && loan.repaymentSchedule && loan.repaymentSchedule.length > 0
        );
        
        if (activeLoanWithPayments) {
            const nextPayment = activeLoanWithPayments.repaymentSchedule.find(payment => 
                payment.status === 'pending'
            );
            if (nextPayment) {
                nextPaymentDue = {
                    amount: nextPayment.amount,
                    dueDate: nextPayment.dueDate,
                    loanNumber: activeLoanWithPayments.loanNumber
                };
            }
        }

        res.json({
            success: true,
            data: {
                loanSummary: {
                    totalLoans,
                    activeLoans,
                    pendingLoans,
                    approvedLoans,
                    completedLoans,
                    rejectedLoans,
                    totalLoanAmount,
                    activeLoanAmount,
                    pendingLoanAmount
                },
                recentActivity: recentLoans.map(loan => ({
                    id: loan._id,
                    loanNumber: loan.loanNumber,
                    amount: loan.amount,
                    status: loan.status,
                    applicationDate: loan.applicationDate,
                    purpose: loan.purpose
                })),
                nextPaymentDue,
                hasLoans: totalLoans > 0
            }
        });

    } catch (error) {
        console.error('User dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user dashboard statistics',
            error: error.message
        });
    }
});

module.exports = router;