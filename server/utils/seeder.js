require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const { generateToken } = require('./auth');

// Sample data for seeding
const sampleData = {
  companies: [
    {
      name: 'NdalamaHub Financial Services',
      type: 'lender',
      registrationNumber: 'LND0012025',
      taxNumber: 'TAX0012025',
      address: {
        street: '123 Finance Street',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10101'
      },
      contactInfo: {
        phone: '260211123456',
        email: 'info@ndalamahub.com',
        website: 'https://ndalamahub.com'
      },
      settings: {
        maxLoanAmount: 100000,
        interestRate: 15,
        repaymentPeriod: 12,
        allowMultipleLoans: false,
        requireGuarantor: true
      },
      description: 'Leading financial services provider in Zambia'
    },
    {
      name: 'TechCorp Zambia Ltd',
      type: 'corporate',
      registrationNumber: 'CORP0012025',
      taxNumber: 'TAX0022025',
      address: {
        street: '456 Business Avenue',
        city: 'Lusaka',
        province: 'Lusaka',
        postalCode: '10102'
      },
      contactInfo: {
        phone: '260211654321',
        email: 'hr@techcorpzambia.com',
        website: 'https://techcorpzambia.com'
      },
      description: 'Technology company with employee loan program'
    }
  ],
  users: [
    {
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      email: 'admin@ndalamahub.com',
      phone: '260955123456',
      password: 'Admin@2025',
      role: 'super_user',
      isActive: true
    },
    {
      firstName: 'John',
      lastName: 'Manager',
      username: 'manager',
      email: 'manager@ndalamahub.com',
      phone: '260955654321',
      password: 'Manager@2025',
      role: 'client_admin',
      isActive: true
    },
    {
      firstName: 'Sarah',
      lastName: 'HR',
      username: 'hr_sarah',
      email: 'hr@techcorpzambia.com',
      phone: '260955789012',
      password: 'HR@2025',
      role: 'corporate_hr',
      department: 'Human Resources',
      isActive: true
    },
    {
      firstName: 'Mike',
      lastName: 'Employee',
      username: 'mike_employee',
      email: 'mike@techcorpzambia.com',
      phone: '260955345678',
      password: 'Employee@2025',
      role: 'staff',
      department: 'IT',
      employeeId: 'EMP001',
      isActive: true
    },
    {
      firstName: 'David',
      lastName: 'Corporate Admin',
      username: 'david_admin',
      email: 'david@techcorpzambia.com',
      phone: '260955987654',
      password: 'Corporate@2025',
      role: 'corporate_admin',
      isActive: true
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
    console.log('🗑️  Cleared existing data');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
};

// Seed companies
const seedCompanies = async () => {
  try {
    const companies = [];
    
    // First, create the lender company
    const lenderCompanyData = sampleData.companies.find(c => c.type === 'lender');
    const lenderCompany = new Company(lenderCompanyData);
    await lenderCompany.save();
    companies.push(lenderCompany);
    console.log(`✅ Created company: ${lenderCompany.name}`);
    
    // Then, create the corporate company with lender reference
    const corporateCompanyData = sampleData.companies.find(c => c.type === 'corporate');
    const corporateCompany = new Company({
      ...corporateCompanyData,
      lenderCompany: lenderCompany._id
    });
    await corporateCompany.save();
    companies.push(corporateCompany);
    console.log(`✅ Created company: ${corporateCompany.name}`);
    
    return companies;
  } catch (error) {
    console.error('❌ Error seeding companies:', error);
    throw error;
  }
};

// Seed users
const seedUsers = async (companies) => {
  try {
    const lenderCompany = companies.find(c => c.type === 'lender');
    const corporateCompany = companies.find(c => c.type === 'corporate');
    
    const users = [];
    
    for (const userData of sampleData.users) {
      // Assign company based on role
      let companyId;
      if (userData.role === 'super_user') {
        companyId = lenderCompany._id; // Super user belongs to lender company
      } else if (userData.role === 'client_admin') {
        companyId = lenderCompany._id;
      } else if (userData.role === 'corporate_admin' || userData.role === 'corporate_hr' || userData.role === 'staff') {
        companyId = corporateCompany._id;
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
    const lenderCompany = companies.find(c => c.type === 'lender');
    const corporateCompany = companies.find(c => c.type === 'corporate');
    
    // Add corporate to lender's clients (lenderCompany is already set during creation)
    lenderCompany.corporateClients.push(corporateCompany._id);
    await lenderCompany.save();
    
    console.log('✅ Updated company relationships');
  } catch (error) {
    console.error('❌ Error updating company relationships:', error);
  }
};

// Generate login tokens
const generateLoginInfo = (users) => {
  console.log('\n🔑 Login Information:');
  console.log('========================');
  
  users.forEach(user => {
    const token = generateToken(user._id);
    console.log(`\n👤 ${user.getFullName()} (${user.role})`);
    console.log(`👤 Username: ${user.username}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔐 Password: ${user.password}`);
    console.log(`🎫 Token: ${token}`);
  });
  
  console.log('\n📝 Note: Save these credentials securely!');
  console.log('\n💡 Login using username instead of email address.');
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');
    
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
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n🚀 You can now start the server and login with the credentials above.');
    console.log('\n📋 Sample API calls:');
    console.log('   Login: POST /api/auth/login');
    console.log('   Body: {"username": "superadmin", "password": "Admin@2025"}');
    
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