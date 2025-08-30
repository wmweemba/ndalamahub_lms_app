const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserCompany() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const User = require('./models/User');
    const Company = require('./models/Company');
    const Loan = require('./models/Loan');
    
    // Find the corporate_hr user
    const hrUser = await User.findOne({ role: 'corporate_hr' }).populate('company', 'name type');
    
    if (hrUser) {
      console.log('📋 Corporate HR User Details:');
      console.log('- Username:', hrUser.username);
      console.log('- Company ID:', hrUser.company._id);
      console.log('- Company Name:', hrUser.company.name);
      console.log('- Company Type:', hrUser.company.type);
      
      // Check loans for this company
      const companyLoans = await Loan.find({ company: hrUser.company._id }).populate('company', 'name');
      console.log('\n📊 Loans for HR user company:', companyLoans.length);
      
      // Check loans where lenderCompany matches
      const lenderLoans = await Loan.find({ lenderCompany: hrUser.company._id }).populate('company', 'name');
      console.log('📊 Loans where HR company is lender:', lenderLoans.length);
      
      // Show all loans and their company relationships
      const allLoans = await Loan.find({}).populate('company', 'name type').populate('lenderCompany', 'name type');
      console.log('\n📈 All Loans in Database:');
      allLoans.forEach((loan, index) => {
        console.log(`Loan ${index + 1}:`);
        console.log(`  - ID: ${loan._id}`);
        console.log(`  - Status: ${loan.status}`);
        console.log(`  - Company: ${loan.company?.name} (${loan.company?._id})`);
        console.log(`  - Lender: ${loan.lenderCompany?.name} (${loan.lenderCompany?._id})`);
        console.log(`  - Amount: ${loan.amount}`);
        console.log('');
      });
      
    } else {
      console.log('❌ No corporate_hr user found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUserCompany();
