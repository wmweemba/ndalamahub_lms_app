require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const LoanProduct = require('../models/LoanProduct');
const { generateToken } = require('./auth');

// Sample data for seeding - matches FRONTEND_TEST_PLAN.md
const sampleData = {
  companies: [
    // Lender Companies
    {
      name: 'FirstBank Lending',
      type: 'lender',
      registrationNumber: 'LND-FB-2026',
      taxNumber: 'TAX-FB-2026',
      address: {
        street: 'Plot 45, Cairo Road',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10101'
      },
      contactInfo: {
        phone: '+260211123456',
        email: 'info@firstbank.zm',
        website: 'https://firstbank.zm'
      },
      settings: {
        maxLoanAmount: 500000,
        interestRate: 18,
        repaymentPeriod: 60,
        allowMultipleLoans: true,
        requireGuarantor: false
      },
      description: 'FirstBank Lending - Premier financial services provider'
    },
    {
      name: 'QuickCash Microfinance',
      type: 'lender',
      registrationNumber: 'LND-QCM-2026',
      taxNumber: 'TAX-QCM-2026',
      address: {
        street: 'Plot 123, Cairo Road',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10101'
      },
      contactInfo: {
        phone: '+260977123456',
        email: 'info@quickcash.zm',
        website: 'https://quickcash.zm'
      },
      settings: {
        maxLoanAmount: 100000,
        interestRate: 28,
        repaymentPeriod: 24,
        allowMultipleLoans: true,
        requireGuarantor: true
      },
      description: 'QuickCash Microfinance - Fast loans for small businesses'
    },
    // Corporate Companies
    {
      name: 'TechCorp Zambia',
      type: 'corporate',
      registrationNumber: 'CORP-TC-2026',
      taxNumber: 'TAX-TC-2026',
      address: {
        street: '456 Business Avenue',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10102'
      },
      contactInfo: {
        phone: '+260211654321',
        email: 'hr@techcorpzambia.com',
        website: 'https://techcorpzambia.com'
      },
      description: 'Technology company with employee loan program'
    },
    {
      name: 'Mining Corp Zambia',
      type: 'corporate',
      registrationNumber: 'CORP-MCZ-2026',
      taxNumber: 'TAX-MCZ-2026',
      address: {
        street: 'Industrial Area',
        city: 'Ndola',
        province: 'Copperbelt',
        postalCode: '20101'
      },
      contactInfo: {
        phone: '+260212987654',
        email: 'hr@miningcorp.zm',
        website: 'https://miningcorp.zm'
      },
      description: 'Mining operations with comprehensive employee benefits'
    },
    {
      name: 'RetailMart Ltd',
      type: 'corporate',
      registrationNumber: 'CORP-RM-2026',
      taxNumber: 'TAX-RM-2026',
      address: {
        street: 'Manda Hill Mall',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10103'
      },
      contactInfo: {
        phone: '+260211789456',
        email: 'hr@retailmart.zm',
        website: 'https://retailmart.zm'
      },
      description: 'Retail chain with employee financial assistance program'
    }
  ],
  users: [
    // Super User
    {
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      email: 'admin@ndalamahub.com',
      phone: '+260955123456',
      password: 'Admin@2025',
      role: 'super_user',
      department: 'System',
      position: 'System Administrator',
      isActive: true
    },
    // FirstBank Lending Users
    {
      firstName: 'John',
      lastName: 'Manager',
      username: 'manager',
      email: 'manager@firstbank.zm',
      phone: '+260955654321',
      password: 'Manager@2025',
      role: 'lender_admin',
      department: 'Loans',
      position: 'Loans Manager',
      isActive: true
    },
    {
      firstName: 'Alice',
      lastName: 'Officer',
      username: 'loan_officer',
      email: 'alice@firstbank.zm',
      phone: '+260955555111',
      password: 'Officer@2025',
      role: 'lender_user',
      department: 'Loans',
      position: 'Loan Officer',
      isActive: true
    },
    // QuickCash Microfinance Users
    {
      firstName: 'James',
      lastName: 'Banda',
      username: 'james_admin',
      email: 'james.banda@quickcash.zm',
      phone: '+260977555111',
      password: 'Lender@2025',
      role: 'lender_admin',
      department: 'Management',
      position: 'Loans Manager',
      isActive: true
    },
    // TechCorp Zambia Users
    {
      firstName: 'Sarah',
      lastName: 'Mulenga',
      username: 'hr_sarah',
      email: 'hr@techcorpzambia.com',
      phone: '+260955789012',
      password: 'HR@2025',
      role: 'corporate_hr',
      department: 'Human Resources',
      position: 'HR Manager',
      employeeId: 'TC-HR-001',
      salary: 15000,
      isActive: true
    },
    {
      firstName: 'David',
      lastName: 'Phiri',
      username: 'david_admin',
      email: 'david@techcorpzambia.com',
      phone: '+260955987654',
      password: 'Corporate@2025',
      role: 'corporate_admin',
      department: 'Management',
      position: 'Operations Manager',
      employeeId: 'TC-MGT-001',
      salary: 20000,
      isActive: true
    },
    {
      firstName: 'John',
      lastName: 'Banda',
      username: 'john_employee',
      email: 'john@techcorpzambia.com',
      phone: '+260955345678',
      password: 'Employee@2025',
      role: 'corporate_user',
      department: 'IT',
      position: 'Software Developer',
      employeeId: 'TC-IT-101',
      salary: 12000,
      isActive: true
    },
    // Mining Corp Zambia Users
    {
      firstName: 'Grace',
      lastName: 'Mwansa',
      username: 'grace_admin',
      email: 'grace.mwansa@miningcorp.zm',
      phone: '+260966444222',
      password: 'Mining@2025',
      role: 'corporate_admin',
      department: 'Human Resources',
      position: 'HR Manager',
      employeeId: 'MCZ-HR-001',
      salary: 18000,
      isActive: true
    },
    {
      firstName: 'Patrick',
      lastName: 'Phiri',
      username: 'patrick_employee',
      email: 'patrick.phiri@miningcorp.zm',
      phone: '+260955333444',
      password: 'Employee@2025',
      role: 'corporate_user',
      department: 'Operations',
      position: 'Machine Operator',
      employeeId: 'MCZ-OPS-123',
      salary: 8500,
      isActive: true
    },
    // RetailMart Ltd Users
    {
      firstName: 'Mary',
      lastName: 'Chola',
      username: 'mary_hr',
      email: 'mary@retailmart.zm',
      phone: '+260977888999',
      password: 'Retail@2025',
      role: 'corporate_hr',
      department: 'Human Resources',
      position: 'HR Officer',
      employeeId: 'RM-HR-001',
      salary: 10000,
      isActive: true
    },
    {
      firstName: 'Peter',
      lastName: 'Siame',
      username: 'peter_employee',
      email: 'peter@retailmart.zm',
      phone: '+260966222333',
      password: 'Employee@2025',
      role: 'corporate_user',
      department: 'Sales',
      position: 'Sales Associate',
      employeeId: 'RM-SLS-045',
      salary: 5500,
      isActive: true
    }
  ],
  loanProducts: [
    // FirstBank Products
    {
      name: 'Personal Loan - 18%',
      category: 'personal',
      calculationMethod: 'reducing_balance',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 15, max: 22, default: 18 },
      loanAmount: { min: 5000, max: 50000, default: 15000 },
      loanTerm: { min: 6, max: 36, default: 12 },
      fees: {
        processingFee: { type: 'percentage', value: 2.5, timing: 'upfront' },
        insuranceFee: { required: false },
        latePaymentFee: { type: 'fixed', value: 100 },
        earlySettlementFee: { type: 'percentage', value: 2 }
      },
      eligibility: {
        minAge: 21,
        maxAge: 65,
        minIncome: 3000,
        minEmploymentDuration: 6,
        minCreditScore: 600,
        employmentTypes: ['permanent', 'contract']
      },
      status: 'active',
      description: 'Standard personal loan with competitive rates'
    },
    {
      name: 'Business Loan - 22%',
      category: 'business',
      calculationMethod: 'reducing_balance',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 20, max: 25, default: 22 },
      loanAmount: { min: 10000, max: 200000, default: 50000 },
      loanTerm: { min: 12, max: 60, default: 24 },
      fees: {
        processingFee: { type: 'percentage', value: 3, timing: 'upfront' },
        insuranceFee: { required: true, type: 'percentage', value: 1.5 },
        latePaymentFee: { type: 'percentage', value: 5 },
        earlySettlementFee: { type: 'percentage', value: 3 }
      },
      eligibility: {
        minAge: 25,
        maxAge: 65,
        minIncome: 10000,
        minEmploymentDuration: 12,
        minCreditScore: 650,
        employmentTypes: ['self-employed', 'business']
      },
      status: 'active',
      description: 'Business expansion and working capital loans'
    },
    {
      name: 'Payday Loan - 7%',
      category: 'payday',
      calculationMethod: 'flat_rate',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 5, max: 10, default: 7 },
      loanAmount: { min: 500, max: 5000, default: 2000 },
      loanTerm: { min: 1, max: 3, default: 1 },
      fees: {
        processingFee: { type: 'percentage', value: 5, timing: 'upfront' },
        insuranceFee: { required: false },
        latePaymentFee: { type: 'fixed', value: 50 },
        earlySettlementFee: { type: 'percentage', value: 1 }
      },
      eligibility: {
        minAge: 18,
        maxAge: 65,
        minIncome: 2000,
        minEmploymentDuration: 3,
        minCreditScore: 550,
        employmentTypes: ['permanent', 'contract', 'casual']
      },
      status: 'active',
      description: 'Quick short-term loans for emergency expenses'
    },
    {
      name: 'Bridge Loan - 24%',
      category: 'bridge',
      calculationMethod: 'simple_interest',
      dayCountConvention: 'actual/360',
      paymentFrequency: 'monthly',
      interestRate: { min: 22, max: 28, default: 24 },
      loanAmount: { min: 20000, max: 100000, default: 50000 },
      loanTerm: { min: 3, max: 12, default: 6 },
      fees: {
        processingFee: { type: 'percentage', value: 4, timing: 'upfront' },
        insuranceFee: { required: false },
        latePaymentFee: { type: 'percentage', value: 5 },
        earlySettlementFee: { type: 'percentage', value: 2 }
      },
      eligibility: {
        minAge: 25,
        maxAge: 65,
        minIncome: 15000,
        minEmploymentDuration: 12,
        minCreditScore: 650,
        employmentTypes: ['permanent', 'self-employed', 'business']
      },
      status: 'active',
      description: 'Short-term financing for business opportunities'
    },
    {
      name: 'Microfinance Loan - 28%',
      category: 'microfinance',
      calculationMethod: 'flat_rate',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 25, max: 32, default: 28 },
      loanAmount: { min: 1000, max: 20000, default: 5000 },
      loanTerm: { min: 3, max: 24, default: 12 },
      fees: {
        processingFee: { type: 'percentage', value: 5, timing: 'upfront' },
        insuranceFee: { required: false },
        latePaymentFee: { type: 'fixed', value: 75 },
        earlySettlementFee: { type: 'percentage', value: 1.5 }
      },
      eligibility: {
        minAge: 18,
        maxAge: 70,
        minIncome: 1500,
        minEmploymentDuration: 0,
        minCreditScore: 500,
        employmentTypes: ['permanent', 'contract', 'casual', 'self-employed']
      },
      status: 'active',
      description: 'Microloans for small businesses and entrepreneurs'
    },
    {
      name: 'Auto Loan - 18%',
      category: 'auto',
      calculationMethod: 'reducing_balance',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 16, max: 20, default: 18 },
      loanAmount: { min: 30000, max: 300000, default: 100000 },
      loanTerm: { min: 24, max: 72, default: 48 },
      fees: {
        processingFee: { type: 'percentage', value: 2, timing: 'upfront' },
        insuranceFee: { required: true, type: 'percentage', value: 2 },
        latePaymentFee: { type: 'percentage', value: 3 },
        earlySettlementFee: { type: 'percentage', value: 2 }
      },
      eligibility: {
        minAge: 23,
        maxAge: 65,
        minIncome: 8000,
        minEmploymentDuration: 12,
        minCreditScore: 650,
        employmentTypes: ['permanent', 'contract']
      },
      status: 'active',
      description: 'Vehicle financing with competitive rates'
    },
    {
      name: 'Education Loan - 14%',
      category: 'education',
      calculationMethod: 'interest_only',
      dayCountConvention: 'actual/365',
      paymentFrequency: 'monthly',
      interestRate: { min: 12, max: 16, default: 14 },
      loanAmount: { min: 10000, max: 100000, default: 30000 },
      loanTerm: { min: 12, max: 48, default: 24 },
      fees: {
        processingFee: { type: 'percentage', value: 1.5, timing: 'upfront' },
        insuranceFee: { required: false },
        latePaymentFee: { type: 'fixed', value: 50 },
        earlySettlementFee: { type: 'percentage', value: 1 }
      },
      eligibility: {
        minAge: 18,
        maxAge: 35,
        minIncome: 5000,
        minEmploymentDuration: 6,
        minCreditScore: 600,
        employmentTypes: ['permanent', 'contract', 'student']
      },
      status: 'active',
      description: 'Education financing with interest-only payments'
    }
  ]
};

// Connect to database
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Remove deprecated options
            // useNewUrlParser and useUnifiedTopology are no longer needed
        });
        console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

// Clear existing data
const clearData = async () => {
  try {
    await User.deleteMany({});
    await Company.deleteMany({});
    await LoanProduct.deleteMany({});
    console.log('🗑️  Cleared existing data');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
};

// Seed companies
const seedCompanies = async () => {
  try {
    const companies = [];
    
    // Create lender companies first
    const lenderCompanies = sampleData.companies.filter(c => c.type === 'lender');
    for (const lenderData of lenderCompanies) {
      const lender = new Company(lenderData);
      await lender.save();
      companies.push(lender);
      console.log(`✅ Created lender: ${lender.name}`);
    }
    
    // Get FirstBank as the primary lender for corporate companies
    const firstBank = companies.find(c => c.name === 'FirstBank Lending');
    
    // Create corporate companies with lender reference
    const corporateCompanies = sampleData.companies.filter(c => c.type === 'corporate');
    for (const corporateData of corporateCompanies) {
      const corporate = new Company({
        ...corporateData,
        lenderCompany: firstBank._id
      });
      await corporate.save();
      companies.push(corporate);
      console.log(`✅ Created corporate: ${corporate.name} (linked to ${firstBank.name})`);
    }
    
    return companies;
  } catch (error) {
    console.error('❌ Error seeding companies:', error);
    throw error;
  }
};

// Seed users
const seedUsers = async (companies) => {
  try {
    const firstBank = companies.find(c => c.name === 'FirstBank Lending');
    const quickCash = companies.find(c => c.name === 'QuickCash Microfinance');
    const techCorp = companies.find(c => c.name === 'TechCorp Zambia');
    const miningCorp = companies.find(c => c.name === 'Mining Corp Zambia');
    const retailMart = companies.find(c => c.name === 'RetailMart Ltd');
    
    const users = [];
    
    for (const userData of sampleData.users) {
      // Assign company based on user email domain
      let companyId;
      
      if (userData.role === 'super_user') {
        companyId = firstBank._id; // Super user belongs to first lender
      } else if (userData.email.includes('firstbank.zm')) {
        companyId = firstBank._id;
      } else if (userData.email.includes('quickcash.zm')) {
        companyId = quickCash._id;
      } else if (userData.email.includes('techcorpzambia.com')) {
        companyId = techCorp._id;
      } else if (userData.email.includes('miningcorp.zm')) {
        companyId = miningCorp._id;
      } else if (userData.email.includes('retailmart.zm')) {
        companyId = retailMart._id;
      } else {
        companyId = firstBank._id; // Default to FirstBank
      }
      
      const user = new User({
        ...userData,
        company: companyId
      });
      
      await user.save();
      users.push(user);
      console.log(`✅ Created user: ${user.getFullName()} (${user.role}) - Username: ${user.username}`);
    }
    
    return users;
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
};

// Update company relationships
const updateCompanyRelationships = async (companies) => {
  try {
    const firstBank = companies.find(c => c.name === 'FirstBank Lending');
    const corporateCompanies = companies.filter(c => c.type === 'corporate');
    
    // Add all corporate companies to FirstBank's clients
    firstBank.corporateClients = corporateCompanies.map(c => c._id);
    await firstBank.save();
    
    console.log(`✅ Updated company relationships: FirstBank has ${corporateCompanies.length} corporate clients`);
  } catch (error) {
    console.error('❌ Error updating company relationships:', error);
  }
};

// Generate login tokens
const generateLoginInfo = (users) => {
  console.log('\n🔑 Login Information:');
  console.log('========================\n');
  
  // Group users by company for better readability
  const usersByRole = {
    'super_user': [],
    'lender_admin': [],
    'lender_user': [],
    'corporate_admin': [],
    'corporate_hr': [],
    'corporate_user': []
  };
  
  users.forEach(user => {
    if (usersByRole[user.role]) {
      usersByRole[user.role].push(user);
    }
  });
  
  // Display by role
  Object.entries(usersByRole).forEach(([role, roleUsers]) => {
    if (roleUsers.length > 0) {
      console.log(`\n📋 ${role.toUpperCase().replace('_', ' ')}:`);
      roleUsers.forEach(user => {
        console.log(`   👤 ${user.getFullName()}`);
        console.log(`      Username: ${user.username}`);
        console.log(`      Password: ${user.password}`);
        console.log(`      Email: ${user.email}`);
      });
    }
  });
  
  console.log('\n\n📝 Quick Test Credentials:');
  console.log('==========================');
  console.log('Super User:      superadmin / Admin@2025');
  console.log('Lender Admin:    manager / Manager@2025');
  console.log('Corporate HR:    hr_sarah / HR@2025');
  console.log('Corporate Admin: david_admin / Corporate@2025');
  console.log('Employee:        john_employee / Employee@2025');
  
  console.log('\n💡 Login using username, not email.');
  console.log('🌐 Frontend: http://localhost:5173');
  console.log('🔌 Backend: http://localhost:5000');
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');
    console.log('📋 This will create test data for FRONTEND_TEST_PLAN.md\n');
    
    // Connect to database
    await connectDB();
    
    // Clear existing data
    await clearData();
    
    // Seed companies
    console.log('\n🏢 Seeding companies...');
    const companies = await seedCompanies();
    
    // Seed users
    console.log('\n👥 Seeding users...');
    const users = await seedUsers(companies);
    
    // Update relationships
    console.log('\n🔗 Updating relationships...');
    await updateCompanyRelationships(companies);
    
    // Generate login info
    generateLoginInfo(users);
    
    // Display summary (without products)
    console.log('\n\n📊 Seeding Summary:');
    console.log('===================');
    
    const lenders = companies.filter(c => c.type === 'lender');
    const corporates = companies.filter(c => c.type === 'corporate');
    
    console.log(`\n🏢 Companies:`);
    console.log(`   - Lenders: ${lenders.length}`);
    lenders.forEach(l => console.log(`     • ${l.name}`));
    console.log(`   - Corporates: ${corporates.length}`);
    corporates.forEach(c => console.log(`     • ${c.name}`));
    
    console.log(`\n👥 Users: ${users.length} total`);
    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    Object.entries(usersByRole).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count}`);
    });
    
    console.log(`\n✅ Companies and users created successfully!`);
    console.log(`\n💰 Seeding loan products...`);
    console.log(`   Run: pnpm run seed:products`);
    console.log(`   Or: node utils/seedProducts.js`);
    
    console.log(`\n🚀 Ready to test! Start the application:`);
    console.log('   cd .. && pnpm start');
    console.log('\n📖 Follow FRONTEND_TEST_PLAN.md for comprehensive testing\n');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run seeder if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  clearData,
  sampleData
};