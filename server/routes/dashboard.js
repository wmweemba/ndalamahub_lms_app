const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Loan = require('../models/Loan');
const { authenticateToken, authorizeMinRole } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Corporate Admin and above)
router.get('/stats', authenticateToken, authorizeMinRole('employer_admin'), async (req, res) => {
    try {
        let filter = {};
        
        // If not platform_admin, filter by company
        if (req.user.role !== 'platform_admin') {
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
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   GET /api/dashboard/lender-stats
// @desc    Get lender-specific dashboard statistics
// @access  Private (Lender Admin and above)
router.get('/lender-stats', authenticateToken, authorizeMinRole('lender_admin'), async (req, res) => {
    try {
        // Get lender company information
        const lenderCompany = await Company.findById(req.user.company);
        if (!lenderCompany) {
            return res.status(404).json({
                success: false,
                message: 'Lender company not found'
            });
        }

                // Get all corporate companies linked to this lender
                const corporateClients = await Company.find({ lenderCompany: req.user.company, isActive: true });

                // Get all loans for this lender and their corporate clients
                const allLoans = await Loan.find({
                    $or: [
                        { lenderCompany: req.user.company },
                        { company: { $in: corporateClients.map(c => c._id) } }
                    ]
                })
                .populate('applicant', 'firstName lastName')
                .populate('company', 'name');

                // Get total active users across all client companies
                const totalActiveUsers = await User.countDocuments({
                    company: { $in: corporateClients.map(c => c._id) },
                    isActive: true
                });

                // Calculate loan statistics
                const totalLoans = allLoans.length;
                const activeLoans = allLoans.filter(loan => loan.status === 'active').length;
                const pendingLoans = allLoans.filter(loan => 
                        loan.status === 'pending' || 
                        loan.status === 'pending_approval' || 
                        loan.status === 'pending_documents' || 
                        loan.status === 'under_review' ||
                        loan.status === 'pending_disbursement'
                ).length;
                const approvedLoans = allLoans.filter(loan => loan.status === 'approved').length;
                const disbursedLoans = allLoans.filter(loan => loan.status === 'disbursed').length;
                const completedLoans = allLoans.filter(loan => loan.status === 'completed').length;
                const rejectedLoans = allLoans.filter(loan => loan.status === 'rejected').length;

                // Calculate loan amounts
                const totalLoanAmount = allLoans.reduce((sum, loan) => sum + loan.amount, 0);
                const activeLoanAmount = allLoans
                        .filter(loan => loan.status === 'active')
                        .reduce((sum, loan) => sum + loan.amount, 0);
                const pendingLoanAmount = allLoans
                        .filter(loan => 
                                loan.status === 'pending' || 
                                loan.status === 'pending_approval' || 
                                loan.status === 'pending_documents' || 
                                loan.status === 'under_review' ||
                                loan.status === 'pending_disbursement'
                        )
                        .reduce((sum, loan) => sum + loan.amount, 0);

                // Outstanding balance: sum of remaining principal for all active loans
                let totalOutstandingBalance = 0;
                for (const loan of allLoans) {
                    if (loan.status === 'active' && typeof loan.calculateRemainingBalance === 'function') {
                        totalOutstandingBalance += loan.calculateRemainingBalance();
                    } else if (loan.status === 'active' && loan.repaymentSchedule) {
                        // fallback if method not available (shouldn't happen)
                        let remaining = loan.amount;
                        loan.repaymentSchedule.forEach(inst => {
                            if (inst.status === 'paid') remaining -= inst.principal;
                        });
                        totalOutstandingBalance += Math.max(0, remaining);
                    }
                }

                // Total interest earned: sum of all paid interest for all loans
                let totalInterestEarned = 0;
                for (const loan of allLoans) {
                    if (loan.repaymentSchedule) {
                        loan.repaymentSchedule.forEach(inst => {
                            if (inst.status === 'paid') totalInterestEarned += inst.interest;
                        });
                    }
                    // Add interest from prepayments (if any)
                    if (loan.prepayments) {
                        loan.prepayments.forEach(prep => {
                            if (prep.interestPortion) totalInterestEarned += prep.interestPortion;
                        });
                    }
                }

                // Get recent loan applications (last 10)
                const recentApplications = allLoans
                        .sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate))
                        .slice(0, 10)
                        .map(loan => ({
                                id: loan._id,
                                loanNumber: loan.loanNumber,
                                applicantName: loan.applicant ? `${loan.applicant.firstName} ${loan.applicant.lastName}` : 'N/A',
                                companyName: loan.company ? loan.company.name : 'N/A',
                                amount: loan.amount,
                                status: loan.status,
                                applicationDate: loan.applicationDate,
                                purpose: loan.purpose
                        }));

                // Get pending approvals that need attention
                const pendingApprovals = allLoans.filter(loan => 
                        loan.status === 'pending' || 
                        loan.status === 'pending_approval' || 
                        loan.status === 'pending_documents' || 
                        loan.status === 'under_review'
                );

                // Get loans ready for disbursement
                const readyForDisbursement = allLoans.filter(loan => 
                        loan.status === 'approved'
                );

                res.json({
                        success: true,
                        data: {
                                lenderCompany: {
                                        name: lenderCompany.name,
                                        type: lenderCompany.type
                                },
                                portfolioSummary: {
                                        activeCompanies: corporateClients.length,
                                        activeCorporates: corporateClients.length, // Same as activeCompanies for lenders
                                        activeUsers: totalActiveUsers,
                                        totalLoans,
                                        activeLoans,
                                        pendingLoans,
                                        approvedLoans,
                                        disbursedLoans,
                                        completedLoans,
                                        rejectedLoans,
                                        totalLoanAmount,
                                        activeLoanAmount,
                                        pendingLoanAmount,
                                        totalOutstandingBalance,
                                        totalInterestEarned
                                },
                                recentApplications,
                                pendingApprovals: pendingApprovals.length,
                                readyForDisbursement: readyForDisbursement.length,
                                needsAttention: pendingApprovals.length
                        }
                });

    } catch (error) {
        console.error('Lender dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching lender dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   GET /api/dashboard/hr-stats
// @desc    Get HR-specific dashboard statistics
// @access  Private (Corporate HR and above)
router.get('/hr-stats', authenticateToken, authorizeMinRole('employer_hr'), async (req, res) => {
    try {
        // Get company information
        const company = await Company.findById(req.user.company);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Get company employees (users in the same company)
        const companyUsers = await User.find({ 
            company: req.user.company,
            isActive: true 
        });

        // Get all loans for company employees
        const companyLoans = await Loan.find({
            company: req.user.company
        }).populate('applicant', 'firstName lastName');

        // Calculate loan statistics
        const totalEmployees = companyUsers.length;
        const totalLoans = companyLoans.length;
        const pendingLoans = companyLoans.filter(loan => 
            loan.status === 'pending' || 
            loan.status === 'pending_approval' || 
            loan.status === 'pending_documents' || 
            loan.status === 'under_review' ||
            loan.status === 'pending_disbursement'
        ).length;
        const approvedLoans = companyLoans.filter(loan => loan.status === 'approved').length;
        const activeLoans = companyLoans.filter(loan => loan.status === 'active').length;
        const rejectedLoans = companyLoans.filter(loan => loan.status === 'rejected').length;
        const completedLoans = companyLoans.filter(loan => loan.status === 'completed').length;


                // Calculate amounts
                const totalLoanAmount = companyLoans.reduce((sum, loan) => sum + loan.amount, 0);
                const pendingLoanAmount = companyLoans
                        .filter(loan => 
                                loan.status === 'pending' || 
                                loan.status === 'pending_approval' || 
                                loan.status === 'pending_documents' || 
                                loan.status === 'under_review' ||
                                loan.status === 'pending_disbursement'
                        )
                        .reduce((sum, loan) => sum + loan.amount, 0);
                const activeLoanAmount = companyLoans
                        .filter(loan => loan.status === 'active')
                        .reduce((sum, loan) => sum + loan.amount, 0);

                // Outstanding balance: sum of remaining principal for all active loans
                let totalOutstandingBalance = 0;
                for (const loan of companyLoans) {
                    if (loan.status === 'active' && typeof loan.calculateRemainingBalance === 'function') {
                        totalOutstandingBalance += loan.calculateRemainingBalance();
                    } else if (loan.status === 'active' && loan.repaymentSchedule) {
                        // fallback if method not available (shouldn't happen)
                        let remaining = loan.amount;
                        loan.repaymentSchedule.forEach(inst => {
                            if (inst.status === 'paid') remaining -= inst.principal;
                        });
                        totalOutstandingBalance += Math.max(0, remaining);
                    }
                }

                // Total interest earned: sum of all paid interest for all loans
                let totalInterestEarned = 0;
                for (const loan of companyLoans) {
                    if (loan.repaymentSchedule) {
                        loan.repaymentSchedule.forEach(inst => {
                            if (inst.status === 'paid') totalInterestEarned += inst.interest;
                        });
                    }
                    // Add interest from prepayments (if any)
                    if (loan.prepayments) {
                        loan.prepayments.forEach(prep => {
                            if (prep.interestPortion) totalInterestEarned += prep.interestPortion;
                        });
                    }
                }

        // Get recent loan applications (last 10)
        const recentApplications = companyLoans
            .sort((a, b) => new Date(b.applicationDate) - new Date(a.applicationDate))
            .slice(0, 10)
            .map(loan => ({
                id: loan._id,
                loanNumber: loan.loanNumber,
                applicantName: `${loan.applicant.firstName} ${loan.applicant.lastName}`,
                amount: loan.amount,
                status: loan.status,
                applicationDate: loan.applicationDate,
                purpose: loan.purpose
            }));

        // Get pending approvals that need HR attention
        const pendingApprovals = companyLoans.filter(loan => 
            loan.status === 'pending' || 
            loan.status === 'pending_approval' || 
            loan.status === 'pending_documents' || 
            loan.status === 'under_review'
        );

        // Calculate employee loan statistics
        const employeesWithLoans = [...new Set(companyLoans.map(loan => loan.applicant.toString()))].length;
        const employeesWithoutLoans = totalEmployees - employeesWithLoans;

        // Get role distribution
        const roleDistribution = companyUsers.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                company: {
                    name: company.name,
                    type: company.type,
                    totalEmployees
                },
                loanSummary: {
                    totalLoans,
                    pendingLoans,
                    approvedLoans,
                    activeLoans,
                    rejectedLoans,
                    completedLoans,
                    totalLoanAmount,
                    pendingLoanAmount,
                    activeLoanAmount,
                    totalOutstandingBalance,
                    totalInterestEarned
                },
                employeeStats: {
                    totalEmployees,
                    employeesWithLoans,
                    employeesWithoutLoans,
                    roleDistribution
                },
                recentApplications,
                pendingApprovals: pendingApprovals.length,
                needsAttention: pendingApprovals.length
            }
        });

    } catch (error) {
        console.error('HR dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching HR dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   GET /api/dashboard/user-stats
// @desc    Get user-specific dashboard statistics
// @access  Private (All authenticated users)
router.get('/user-stats', authenticateToken, async (req, res) => {
    try {
        // Get user's loans
        const userLoans = await Loan.find({
            applicant: req.user.id
        }).populate('company', 'name');

        // Calculate loan statistics
        const totalLoans = userLoans.length;
        const activeLoans = userLoans.filter(loan => loan.status === 'active').length;
        const pendingLoans = userLoans.filter(loan => 
            loan.status === 'pending' || 
            loan.status === 'pending_approval' || 
            loan.status === 'pending_documents' || 
            loan.status === 'under_review' ||
            loan.status === 'pending_disbursement'
        ).length;
        const approvedLoans = userLoans.filter(loan => loan.status === 'approved').length;
        const completedLoans = userLoans.filter(loan => loan.status === 'completed').length;
        const rejectedLoans = userLoans.filter(loan => loan.status === 'rejected').length;

        // Calculate total loan amounts
        const totalLoanAmount = userLoans.reduce((sum, loan) => sum + loan.amount, 0);
        const activeLoanAmount = userLoans
            .filter(loan => loan.status === 'active')
            .reduce((sum, loan) => sum + loan.amount, 0);
        const pendingLoanAmount = userLoans
            .filter(loan => 
                loan.status === 'pending' || 
                loan.status === 'pending_approval' || 
                loan.status === 'pending_documents' || 
                loan.status === 'under_review' ||
                loan.status === 'pending_disbursement'
            )
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
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;