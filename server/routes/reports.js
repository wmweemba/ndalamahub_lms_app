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
// @desc    Get overview statistics for reports dashboard
// @access  Private (Admin roles)
router.get('/overview', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    // Build company filter
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    }

    // Get loans by status
    const loansByStatus = await Loan.aggregate([
      { $match: companyFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const loansByStatusObj = {};
    loansByStatus.forEach(item => {
      loansByStatusObj[item._id] = item.count;
    });

    // Get companies by type
    let companiesFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        companiesFilter = {
          $or: [
            { _id: req.user.company },
            { lenderCompany: req.user.company }
          ]
        };
      } else {
        companiesFilter = { _id: req.user.company };
      }
    }

    const companiesByType = await Company.aggregate([
      { $match: { isActive: true, ...companiesFilter } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const companiesByTypeObj = {};
    companiesByType.forEach(item => {
      companiesByTypeObj[item._id] = item.count;
    });

    // Get monthly loan trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Loan.aggregate([
      { 
        $match: { 
          applicationDate: { $gte: sixMonthsAgo },
          ...companyFilter
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$applicationDate' },
            month: { $month: '$applicationDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get payment status overview
    const paymentStatus = await Loan.aggregate([
      { $match: { status: { $in: ['active', 'in_arrears', 'defaulted'] }, ...companyFilter } },
      { $unwind: '$repaymentSchedule' },
      {
        $group: {
          _id: '$repaymentSchedule.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$repaymentSchedule.amount' }
        }
      }
    ]);

    const paymentStatusObj = {};
    paymentStatus.forEach(item => {
      paymentStatusObj[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount
      };
    });

    res.json({
      success: true,
      data: {
        loansByStatus: loansByStatusObj,
        companiesByType: companiesByTypeObj,
        monthlyLoanTrends: monthlyTrends,
        paymentStatus: paymentStatusObj
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

// @route   GET /api/reports/active-loans
// @desc    Get active loans report
// @access  Private (Admin roles)
router.get('/active-loans', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    }

    const loans = await Loan.find({ 
      status: { $in: ['active', 'disbursed'] },
      ...companyFilter 
    })
    .populate('applicant', 'firstName lastName phone email')
    .populate('company', 'name')
    .populate('lenderCompany', 'name')
    .sort({ disbursedAt: -1 });

    const loansWithPaymentInfo = loans.map(loan => {
      const nextPayment = loan.repaymentSchedule?.find(payment => payment.status === 'pending');
      return {
        ...loan.toObject(),
        nextPaymentDate: nextPayment?.dueDate || null,
        nextPaymentAmount: nextPayment?.amount || 0
      };
    });

    res.json({
      success: true,
      data: loansWithPaymentInfo
    });

  } catch (error) {
    console.error('Get active loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active loans report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/overdue-loans
// @desc    Get overdue loans report
// @access  Private (Admin roles)
router.get('/overdue-loans', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    }

    const loans = await Loan.find({ 
      status: { $in: ['in_arrears', 'defaulted'] },
      ...companyFilter 
    })
    .populate('applicant', 'firstName lastName phone email')
    .populate('company', 'name')
    .populate('lenderCompany', 'name')
    .sort({ 'paymentTracking.daysInArrears': -1 });

    const loansWithOverdueInfo = loans.map(loan => {
      const overduePayments = loan.repaymentSchedule?.filter(payment => 
        payment.status === 'overdue' && new Date() > new Date(payment.dueDate)
      ) || [];
      
      const overdueAmount = overduePayments.reduce((sum, payment) => 
        sum + (payment.amount - (payment.paidAmount || 0)), 0
      );

      const lastPayment = loan.repaymentSchedule?.filter(payment => payment.status === 'paid')
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];

      return {
        ...loan.toObject(),
        overdueAmount,
        daysOverdue: loan.paymentTracking?.daysInArrears || 0,
        lastPaymentDate: lastPayment?.paidAt || null,
        lastPaymentAmount: lastPayment?.paidAmount || 0
      };
    });

    res.json({
      success: true,
      data: loansWithOverdueInfo
    });

  } catch (error) {
    console.error('Get overdue loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overdue loans report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/upcoming-payments
// @desc    Get upcoming payments report
// @access  Private (Admin roles)
router.get('/upcoming-payments', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { lenderCompany: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else {
        companyFilter.company = req.user.company;
      }
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const loans = await Loan.find({ 
      status: { $in: ['active', 'disbursed'] },
      ...companyFilter 
    })
    .populate('applicant', 'firstName lastName phone email')
    .populate('company', 'name')
    .populate('lenderCompany', 'name');

    const upcomingPayments = [];

    loans.forEach(loan => {
      const upcomingInstallments = loan.repaymentSchedule?.filter(payment => 
        payment.status === 'pending' && 
        new Date(payment.dueDate) <= thirtyDaysFromNow
      ) || [];

      upcomingInstallments.forEach(installment => {
        const daysUntilDue = Math.ceil((new Date(installment.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        upcomingPayments.push({
          loanId: loan._id,
          loanNumber: loan.loanNumber,
          installmentNumber: installment.installmentNumber,
          borrowerName: `${loan.applicant.firstName} ${loan.applicant.lastName}`,
          borrowerPhone: loan.applicant.phone,
          borrowerEmail: loan.applicant.email,
          companyName: loan.company.name,
          amount: installment.amount,
          dueDate: installment.dueDate,
          daysUntilDue: daysUntilDue,
          priority: daysUntilDue <= 7 ? 'high' : daysUntilDue <= 14 ? 'medium' : 'low'
        });
      });
    });

    // Sort by days until due (most urgent first)
    upcomingPayments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    res.json({
      success: true,
      data: upcomingPayments
    });

  } catch (error) {
    console.error('Get upcoming payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upcoming payments report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/reports/:type/export/:format
// @desc    Export reports in PDF or Excel format
// @access  Private (Admin roles)
router.get('/:type/export/:format', authenticateToken, authorizeMinRole('corporate_admin'), async (req, res) => {
  try {
    const { type, format } = req.params;
    
    // For now, return JSON data that the frontend can handle
    // In a real implementation, you would use libraries like:
    // - PDFKit or Puppeteer for PDF generation
    // - ExcelJS for Excel generation
    
    let data = [];
    
    // Get the same data as the report endpoints
    switch (type) {
      case 'active-loans':
        const activeResponse = await new Promise((resolve, reject) => {
          // Simulate the active-loans endpoint logic
          router.stack.find(layer => layer.route.path === '/active-loans').route.stack[0].handle(req, {
            json: (result) => resolve(result)
          }, () => {});
        });
        data = activeResponse.data;
        break;
        
      case 'overdue-loans':
        // Similar for overdue loans
        break;
        
      case 'upcoming-payments':
        // Similar for upcoming payments
        break;
    }

    // Set appropriate headers based on format
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
    } else if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
    }

    // For now, return the data (frontend will handle the actual export)
    res.json({
      success: true,
      data: data,
      format: format,
      type: type
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
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