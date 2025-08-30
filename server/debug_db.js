const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const Loan = require('./models/Loan');
    const Company = require('./models/Company');
    const User = require('./models/User');
    
    console.log('=== DATABASE QUERY RESULTS ===');
    
    // Get all loans
    const allLoans = await Loan.find({});
    console.log('Total loans in database:', allLoans.length);
    
    // Show loan statuses
    const loansByStatus = await Loan.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Loans by status:', loansByStatus);
    
    // Get all companies
    const allCompanies = await Company.find({});
    console.log('Total companies in database:', allCompanies.length);
    
    // Show companies by type
    const companiesByType = await Company.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    console.log('Companies by type:', companiesByType);
    
    // Check if we have any users with corporate_hr role
    const hrUsers = await User.find({ role: 'corporate_hr' }).populate('company', 'name');
    console.log('Corporate HR users:', hrUsers.length);
    if (hrUsers.length > 0) {
      console.log('HR User company:', hrUsers[0].company?.name);
      console.log('HR User company ID:', hrUsers[0].company?._id);
    }
    
    // If there are loans, check if any belong to HR user's company
    if (allLoans.length > 0 && hrUsers.length > 0) {
      const hrCompanyId = hrUsers[0].company._id;
      const companyLoans = await Loan.find({ company: hrCompanyId });
      console.log('Loans for HR company:', companyLoans.length);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

checkDatabase();
