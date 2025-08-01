const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const User = require('../models/User');
const Company = require('../models/Company');
const { 
  authenticateToken, 
  authorize, 
  authorizeMinRole 
} = require('../middleware/auth');

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'yesterday':
      startDate.setDate(now.getDate() - 1);
      return { startDate, endDate: now };
    case 'last_week':
      startDate.setDate(now.getDate() - 7);
      return { startDate, endDate: now };
    case 'this_month':
      startDate.setDate(1);
      return { startDate, endDate: now };
    case 'last_month':
      startDate.setMonth(now.getMonth() - 1);
      startDate.setDate(1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate.setDate(endDate.getDate() - 1);
      return { startDate, endDate };
    case 'last_three_months':
      startDate.setMonth(now.getMonth() - 3);
      return { startDate, endDate: now };
    default:
      return { startDate: null, endDate: null };
  }
};

// @route   GET /api/reports/overview
// @desc    Get overview statistics
// @access  Private (Admin roles)
router.get('/overview', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period && period !== 'custom') {
      const { startDate: periodStart, endDate: periodEnd } = getDateRange(period);
      dateFilter.applicationDate = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate && endDate) {
      dateFilter.applicationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        // Client admins see their lender company and their corporate clients
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        // Other roles see only their company
        companyFilter.company = req.user.company;
      }
    }

    // Combine filters
    const filter = { ...dateFilter, ...companyFilter };

    // Get loan statistics
    const totalLoans = await Loan.countDocuments(filter);
    const pendingLoans = await Loan.countDocuments({ ...filter, status: 'pending' });
    const approvedLoans = await Loan.countDocuments({ ...filter, status: 'approved' });
    const disbursedLoans = await Loan.countDocuments({ ...filter, status: 'disbursed' });
    const activeLoans = await Loan.countDocuments({ ...filter, status: 'active' });
    const completedLoans = await Loan.countDocuments({ ...filter, status: 'completed' });
    const rejectedLoans = await Loan.countDocuments({ ...filter, status: 'rejected' });

    // Get financial statistics
    const totalAmount = await Loan.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalDisbursed = await Loan.aggregate([
      { $match: { ...filter, status: { $in: ['disbursed', 'active', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRepaid = await Loan.aggregate([
      { $match: { ...filter, status: { $in: ['active', 'completed'] } } },
      { $unwind: '$repaymentSchedule' },
      { $match: { 'repaymentSchedule.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$repaymentSchedule.paidAmount' } } }
    ]);

    // Calculate approval rate
    const approvalRate = totalLoans > 0 ? ((approvedLoans + disbursedLoans + activeLoans + completedLoans) / totalLoans * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalLoans,
          pendingLoans,
          approvedLoans,
          disbursedLoans,
          activeLoans,
          completedLoans,
          rejectedLoans,
          approvalRate: parseFloat(approvalRate),
          totalAmount: totalAmount[0]?.total || 0,
          totalDisbursed: totalDisbursed[0]?.total || 0,
          totalRepaid: totalRepaid[0]?.total || 0
        }
      }
    });

  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overview statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/loans
// @desc    Get detailed loan report
// @access  Private (Admin roles)
router.get('/loans', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { 
      period, 
      startDate, 
      endDate, 
      status, 
      companyId,
      page = 1,
      limit = 10
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period && period !== 'custom') {
      const { startDate: periodStart, endDate: periodEnd } = getDateRange(period);
      dateFilter.applicationDate = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate && endDate) {
      dateFilter.applicationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    } else if (companyId) {
      companyFilter.company = companyId;
    }

    // Build status filter
    let statusFilter = {};
    if (status) {
      statusFilter.status = status;
    }

    // Combine filters
    const filter = { ...dateFilter, ...companyFilter, ...statusFilter };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Loan.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get loans with pagination
    const loans = await Loan.find(filter)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
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
    console.error('Get loans report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loans report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/companies
// @desc    Get company-wise loan statistics
// @access  Private (Admin roles)
router.get('/companies', authenticateToken, authorizeMinRole('client_admin'), async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period && period !== 'custom') {
      const { startDate: periodStart, endDate: periodEnd } = getDateRange(period);
      dateFilter.applicationDate = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate && endDate) {
      dateFilter.applicationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    }

    // Combine filters
    const filter = { ...dateFilter, ...companyFilter };

    // Get company-wise statistics
    const companyStats = await Loan.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          as: 'companyInfo'
        }
      },
      { $unwind: '$companyInfo' },
      {
        $group: {
          _id: '$company',
          companyName: { $first: '$companyInfo.name' },
          companyType: { $first: '$companyInfo.type' },
          totalLoans: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          pendingLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          disbursedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'disbursed'] }, 1, 0] }
          },
          activeLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          rejectedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $multiply: [
              {
                $cond: [
                  { $gt: ['$totalLoans', 0] },
                  {
                    $divide: [
                      { $add: ['$approvedLoans', '$disbursedLoans', '$activeLoans', '$completedLoans'] },
                      '$totalLoans'
                    ]
                  },
                  0
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalLoans: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        companies: companyStats
      }
    });

  } catch (error) {
    console.error('Get companies report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get companies report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/users
// @desc    Get user-wise loan statistics
// @access  Private (Admin roles)
router.get('/users', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { period, startDate, endDate, companyId } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period && period !== 'custom') {
      const { startDate: periodStart, endDate: periodEnd } = getDateRange(period);
      dateFilter.applicationDate = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate && endDate) {
      dateFilter.applicationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    } else if (companyId) {
      companyFilter.company = companyId;
    }

    // Combine filters
    const filter = { ...dateFilter, ...companyFilter };

    // Get user-wise statistics
    const userStats = await Loan.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'applicant',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id: '$applicant',
          firstName: { $first: '$userInfo.firstName' },
          lastName: { $first: '$userInfo.lastName' },
          email: { $first: '$userInfo.email' },
          employeeId: { $first: '$userInfo.employeeId' },
          department: { $first: '$userInfo.department' },
          totalLoans: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          pendingLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          disbursedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'disbursed'] }, 1, 0] }
          },
          activeLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          rejectedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          approvalRate: {
            $multiply: [
              {
                $cond: [
                  { $gt: ['$totalLoans', 0] },
                  {
                    $divide: [
                      { $add: ['$approvedLoans', '$disbursedLoans', '$activeLoans', '$completedLoans'] },
                      '$totalLoans'
                    ]
                  },
                  0
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalLoans: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        users: userStats
      }
    });

  } catch (error) {
    console.error('Get users report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/export
// @desc    Export loan data to CSV/Excel
// @access  Private (Admin roles)
router.get('/export', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { 
      period, 
      startDate, 
      endDate, 
      status, 
      companyId,
      format = 'json'
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (period && period !== 'custom') {
      const { startDate: periodStart, endDate: periodEnd } = getDateRange(period);
      dateFilter.applicationDate = { $gte: periodStart, $lte: periodEnd };
    } else if (startDate && endDate) {
      dateFilter.applicationDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'client_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    } else if (companyId) {
      companyFilter.company = companyId;
    }

    // Build status filter
    let statusFilter = {};
    if (status) {
      statusFilter.status = status;
    }

    // Combine filters
    const filter = { ...dateFilter, ...companyFilter, ...statusFilter };

    // Get loans for export
    const loans = await Loan.find(filter)
      .populate('applicant', 'firstName lastName email employeeId department')
      .populate('company', 'name type')
      .populate('lenderCompany', 'name type')
      .populate('approvedBy', 'firstName lastName')
      .populate('disbursedBy', 'firstName lastName')
      .sort({ applicationDate: -1 });

    // Transform data for export
    const exportData = loans.map(loan => ({
      loanNumber: loan.loanNumber,
      applicantName: `${loan.applicant.firstName} ${loan.applicant.lastName}`,
      applicantEmail: loan.applicant.email,
      employeeId: loan.applicant.employeeId,
      department: loan.applicant.department,
      company: loan.company.name,
      lenderCompany: loan.lenderCompany.name,
      amount: loan.amount,
      interestRate: loan.interestRate,
      term: loan.term,
      totalAmount: loan.totalAmount,
      monthlyPayment: loan.monthlyPayment,
      purpose: loan.purpose,
      status: loan.status,
      applicationDate: loan.applicationDate,
      approvedBy: loan.approvedBy ? `${loan.approvedBy.firstName} ${loan.approvedBy.lastName}` : '',
      approvedAt: loan.approvedAt,
      disbursedBy: loan.disbursedBy ? `${loan.disbursedBy.firstName} ${loan.disbursedBy.lastName}` : '',
      disbursedAt: loan.disbursedAt,
      approvalNotes: loan.approvalNotes
    }));

    if (format === 'csv') {
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=loans_export.csv');
      
      // Convert to CSV
      const csvHeaders = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      );
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: {
          loans: exportData,
          total: exportData.length
        }
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router; 