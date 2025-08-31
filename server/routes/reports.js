const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
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
// @access  Private (HR and Admin roles)
router.get('/overview', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
  try {
    console.log('=== Reports overview request ===');
    console.log('User:', req.user);
    console.log('User role:', req.user.role);
    console.log('User company:', req.user.company);

    // First, let's get all loans to see what's in the database
    const allLoans = await Loan.find({}).populate('company', 'name').populate('applicant', 'firstName lastName');
    console.log('📊 Total loans in database:', allLoans.length);
    
    if (allLoans.length > 0) {
      console.log('Sample loan companies:');
      allLoans.slice(0, 3).forEach((loan, index) => {
        console.log(`Loan ${index + 1}:`, {
          id: loan._id,
          status: loan.status,
          companyId: loan.company?._id,
          companyName: loan.company?.name,
          applicant: loan.applicant ? `${loan.applicant.firstName} ${loan.applicant.lastName}` : 'No applicant'
        });
      });
    }

    // Build company filter based on user role
    let companyFilter = {};
    if (req.user.role !== 'super_user') {
      if (req.user.role === 'lender_admin') {
        const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
        companyFilter.$or = [
          { company: req.user.company },
          { company: { $in: corporateCompanies.map(c => c._id) } }
        ];
      } else if (req.user.role === 'corporate_admin' || req.user.role === 'corporate_hr') {
        // Get user's company details to determine if it's a lender or corporate company
        const userCompany = await Company.findById(req.user.company);
        console.log('🏢 User company details:', userCompany);
        
        if (userCompany.type === 'lender') {
          // If user belongs to a lender company, show loans where lenderCompany matches
          // Also include loans from corporate companies that this lender serves
          const corporateCompanies = await Company.find({ lenderCompany: req.user.company }).select('_id');
          console.log('🏢 Corporate companies served by this lender:', corporateCompanies.length);
          
          companyFilter.$or = [
            { lenderCompany: req.user.company },
            { company: { $in: corporateCompanies.map(c => c._id) } }
          ];
        } else {
          // If user belongs to a corporate company, show loans where company matches
          companyFilter.company = req.user.company;
        }
        
        console.log('🔍 HR/Admin company filter - looking for loans with filter:', companyFilter);
        
        // Let's also check what loans match this filter
        const matchingLoans = await Loan.find(companyFilter).populate('company', 'name').populate('lenderCompany', 'name');
        console.log('📈 Loans matching company filter:', matchingLoans.length);
        if (matchingLoans.length > 0) {
          console.log('Matching loan details:');
          matchingLoans.forEach((loan, index) => {
            console.log(`Match ${index + 1}:`, {
              id: loan._id,
              status: loan.status,
              companyId: loan.company?._id,
              companyName: loan.company?.name,
              lenderCompanyId: loan.lenderCompany?._id,
              lenderCompanyName: loan.lenderCompany?.name
            });
          });
        }
      }
    }

    console.log('Applied company filter:', companyFilter);

    // Get loans by status
    const loansByStatus = await Loan.aggregate([
      { $match: companyFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('📊 Loans by status aggregation result:', loansByStatus);

    const loansByStatusObj = {};
    loansByStatus.forEach(item => {
      loansByStatusObj[item._id] = item.count;
    });
    
    console.log('📈 Processed loans by status object:', loansByStatusObj);

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
      } else if (req.user.role === 'corporate_admin' || req.user.role === 'corporate_hr') {
        // Get user's company details to determine filtering approach
        const userCompany = await Company.findById(req.user.company);
        
        if (userCompany.type === 'lender') {
          // If user belongs to a lender company, show both the lender and its corporate companies
          companiesFilter = {
            $or: [
              { _id: req.user.company },
              { lenderCompany: req.user.company }
            ]
          };
        } else {
          // If user belongs to a corporate company, show only their company
          companiesFilter = { _id: req.user.company };
        }
      }
    }

    const companiesByType = await Company.aggregate([
      { $match: { isActive: true, ...companiesFilter } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    console.log('🏢 Companies by type aggregation result:', companiesByType);

    const companiesByTypeObj = {};
    companiesByType.forEach(item => {
      companiesByTypeObj[item._id] = item.count;
    });
    
    console.log('🏢 Processed companies by type object:', companiesByTypeObj);

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

    const responseData = {
      loansByStatus: loansByStatusObj,
      companiesByType: companiesByTypeObj,
      monthlyLoanTrends: monthlyTrends,
      paymentStatus: paymentStatusObj
    };
    
    console.log('📋 Final response data:', responseData);

    res.json({
      success: true,
      data: responseData
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
router.get('/active-loans', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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
router.get('/overdue-loans', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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
router.get('/upcoming-payments', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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
router.get('/:type/export/:format', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
  try {
    const { type, format } = req.params;
    
    console.log(`Export request: type=${type}, format=${format}`);
    
    // Build company filter based on user role
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

    let data = [];
    let reportTitle = '';
    
    // Get the appropriate data based on report type
    switch (type) {
      case 'active-loans':
        reportTitle = 'Active Loans Report';
        const activeLoans = await Loan.find({ 
          status: { $in: ['active', 'disbursed'] },
          ...companyFilter 
        })
        .populate('applicant', 'firstName lastName phone email')
        .populate('company', 'name')
        .populate('lenderCompany', 'name')
        .sort({ disbursedAt: -1 });

        data = activeLoans.map(loan => {
          const nextPayment = loan.repaymentSchedule?.find(payment => payment.status === 'pending');
          return {
            loanNumber: loan.loanNumber,
            borrower: `${loan.applicant?.firstName || ''} ${loan.applicant?.lastName || ''}`.trim(),
            company: loan.company?.name || '',
            amount: loan.amount,
            monthlyPayment: loan.monthlyPayment,
            nextPaymentDate: nextPayment?.dueDate || null,
            status: loan.status
          };
        });
        break;
        
      case 'overdue-loans':
        reportTitle = 'Overdue Loans Report';
        const overdueLoans = await Loan.find({ 
          status: { $in: ['in_arrears', 'defaulted'] },
          ...companyFilter 
        })
        .populate('applicant', 'firstName lastName phone email')
        .populate('company', 'name')
        .populate('lenderCompany', 'name')
        .sort({ 'paymentTracking.daysInArrears': -1 });

        data = overdueLoans.map(loan => {
          const overduePayments = loan.repaymentSchedule?.filter(payment => 
            payment.status === 'overdue' && new Date() > new Date(payment.dueDate)
          ) || [];
          
          const overdueAmount = overduePayments.reduce((sum, payment) => 
            sum + (payment.amount - (payment.paidAmount || 0)), 0
          );

          const lastPayment = loan.repaymentSchedule?.filter(payment => payment.status === 'paid')
            .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];

          return {
            loanNumber: loan.loanNumber,
            borrower: `${loan.applicant?.firstName || ''} ${loan.applicant?.lastName || ''}`.trim(),
            company: loan.company?.name || '',
            overdueAmount: overdueAmount,
            daysOverdue: loan.paymentTracking?.daysInArrears || 0,
            lastPaymentDate: lastPayment?.paidAt || null,
            status: loan.status
          };
        });
        break;
        
      case 'upcoming-payments':
        reportTitle = 'Upcoming Payments Report';
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const loansForPayments = await Loan.find({ 
          status: { $in: ['active', 'disbursed'] },
          ...companyFilter 
        })
        .populate('applicant', 'firstName lastName phone email')
        .populate('company', 'name')
        .populate('lenderCompany', 'name');

        const upcomingPayments = [];
        loansForPayments.forEach(loan => {
          const upcomingInstallments = loan.repaymentSchedule?.filter(payment => 
            payment.status === 'pending' && 
            new Date(payment.dueDate) <= thirtyDaysFromNow
          ) || [];

          upcomingInstallments.forEach(installment => {
            const daysUntilDue = Math.ceil((new Date(installment.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
            
            upcomingPayments.push({
              loanNumber: loan.loanNumber,
              borrower: `${loan.applicant?.firstName || ''} ${loan.applicant?.lastName || ''}`.trim(),
              company: loan.company?.name || '',
              amount: installment.amount,
              dueDate: installment.dueDate,
              daysUntilDue: daysUntilDue,
              contact: loan.applicant?.phone || ''
            });
          });
        });

        data = upcomingPayments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument({ margin: 50 });
      const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Pipe the PDF to the response
      doc.pipe(res);
      
      // Add title
      doc.fontSize(20).text(reportTitle, 50, 50);
      doc.fontSize(12).text(`Generated on ${new Date().toLocaleDateString()}`, 50, 80);
      doc.text(`Total Records: ${data.length}`, 50, 95);
      
      // Add content based on report type
      let yPosition = 130;
      
      if (data.length === 0) {
        doc.text('No data available for this report.', 50, yPosition);
      } else {
        // Add table headers and data based on report type
        if (type === 'active-loans') {
          // Headers
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Loan Number', 50, yPosition);
          doc.text('Borrower', 150, yPosition);
          doc.text('Company', 250, yPosition);
          doc.text('Amount', 350, yPosition);
          doc.text('Monthly Payment', 420, yPosition);
          doc.text('Status', 500, yPosition);
          
          yPosition += 20;
          doc.font('Helvetica');
          
          data.forEach((loan, index) => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }
            
            doc.text(loan.loanNumber || '', 50, yPosition);
            doc.text(loan.borrower || '', 150, yPosition);
            doc.text(loan.company || '', 250, yPosition);
            doc.text(`K${(loan.amount || 0).toLocaleString()}`, 350, yPosition);
            doc.text(`K${(loan.monthlyPayment || 0).toLocaleString()}`, 420, yPosition);
            doc.text(loan.status || '', 500, yPosition);
            
            yPosition += 15;
          });
        } else if (type === 'overdue-loans') {
          // Headers
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Loan Number', 50, yPosition);
          doc.text('Borrower', 150, yPosition);
          doc.text('Company', 250, yPosition);
          doc.text('Overdue Amount', 350, yPosition);
          doc.text('Days Overdue', 450, yPosition);
          doc.text('Status', 520, yPosition);
          
          yPosition += 20;
          doc.font('Helvetica');
          
          data.forEach((loan, index) => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }
            
            doc.text(loan.loanNumber || '', 50, yPosition);
            doc.text(loan.borrower || '', 150, yPosition);
            doc.text(loan.company || '', 250, yPosition);
            doc.text(`K${(loan.overdueAmount || 0).toLocaleString()}`, 350, yPosition);
            doc.text(`${loan.daysOverdue || 0} days`, 450, yPosition);
            doc.text(loan.status || '', 520, yPosition);
            
            yPosition += 15;
          });
        } else if (type === 'upcoming-payments') {
          // Headers
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Loan Number', 50, yPosition);
          doc.text('Borrower', 140, yPosition);
          doc.text('Company', 230, yPosition);
          doc.text('Amount', 320, yPosition);
          doc.text('Due Date', 380, yPosition);
          doc.text('Days Until Due', 450, yPosition);
          doc.text('Contact', 520, yPosition);
          
          yPosition += 20;
          doc.font('Helvetica');
          
          data.forEach((payment, index) => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }
            
            doc.text(payment.loanNumber || '', 50, yPosition);
            doc.text(payment.borrower || '', 140, yPosition);
            doc.text(payment.company || '', 230, yPosition);
            doc.text(`K${(payment.amount || 0).toLocaleString()}`, 320, yPosition);
            doc.text(payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '', 380, yPosition);
            doc.text(`${payment.daysUntilDue || 0} days`, 450, yPosition);
            doc.text(payment.contact || '', 520, yPosition);
            
            yPosition += 15;
          });
        }
      }
      
      // Finalize the PDF
      doc.end();
      
    } else if (format === 'excel') {
      // Generate Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportTitle);
      
      // Add title and metadata
      worksheet.mergeCells('A1:G1');
      worksheet.getCell('A1').value = reportTitle;
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      worksheet.getCell('A2').value = `Generated on: ${new Date().toLocaleDateString()}`;
      worksheet.getCell('A3').value = `Total Records: ${data.length}`;
      
      if (data.length === 0) {
        worksheet.getCell('A5').value = 'No data available for this report.';
      } else {
        // Add headers and data based on report type
        let startRow = 5;
        
        if (type === 'active-loans') {
          // Add headers
          const headers = ['Loan Number', 'Borrower', 'Company', 'Amount', 'Monthly Payment', 'Next Payment Date', 'Status'];
          worksheet.addRow(headers);
          worksheet.getRow(startRow).font = { bold: true };
          
          // Add data
          data.forEach(loan => {
            worksheet.addRow([
              loan.loanNumber,
              loan.borrower,
              loan.company,
              loan.amount,
              loan.monthlyPayment,
              loan.nextPaymentDate ? new Date(loan.nextPaymentDate).toLocaleDateString() : '',
              loan.status
            ]);
          });
          
          // Format currency columns
          worksheet.getColumn(4).numFmt = '#,##0';
          worksheet.getColumn(5).numFmt = '#,##0';
          
        } else if (type === 'overdue-loans') {
          // Add headers
          const headers = ['Loan Number', 'Borrower', 'Company', 'Overdue Amount', 'Days Overdue', 'Last Payment Date', 'Status'];
          worksheet.addRow(headers);
          worksheet.getRow(startRow).font = { bold: true };
          
          // Add data
          data.forEach(loan => {
            worksheet.addRow([
              loan.loanNumber,
              loan.borrower,
              loan.company,
              loan.overdueAmount,
              loan.daysOverdue,
              loan.lastPaymentDate ? new Date(loan.lastPaymentDate).toLocaleDateString() : 'No payments',
              loan.status
            ]);
          });
          
          // Format currency column
          worksheet.getColumn(4).numFmt = '#,##0';
          
        } else if (type === 'upcoming-payments') {
          // Add headers
          const headers = ['Loan Number', 'Borrower', 'Company', 'Payment Amount', 'Due Date', 'Days Until Due', 'Contact'];
          worksheet.addRow(headers);
          worksheet.getRow(startRow).font = { bold: true };
          
          // Add data
          data.forEach(payment => {
            worksheet.addRow([
              payment.loanNumber,
              payment.borrower,
              payment.company,
              payment.amount,
              payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : '',
              payment.daysUntilDue,
              payment.contact
            ]);
          });
          
          // Format currency column
          worksheet.getColumn(4).numFmt = '#,##0';
        }
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
          column.width = Math.max(12, column.header?.length || 0);
        });
      }
      
      // Set response headers
      const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use "pdf" or "excel".'
      });
    }

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
router.get('/export', authenticateToken, authorizeMinRole('corporate_hr'), async (req, res) => {
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