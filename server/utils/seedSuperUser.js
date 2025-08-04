// server/scripts/seedSuperUser.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI); 
        console.log('🌱 Database connected for seeding.');

        // 1. Check if a super user already exists
        const existingSuperUser = await User.findOne({ username: 'superadmin' });
        if (existingSuperUser) {
            console.log('⚠️ Super user already exists. Skipping seeding.');
            return;
        }

        // 2. Create the lending company for the super user
        const company = await Company.create({
            name: 'NdalamaHub Financial Services',
            type: 'lender',
            registrationNumber: 'NH001',
            taxNumber: 'TAX001',
            status: 'active',
            address: {
                street: '123 Cairo Road',
                city: 'Lusaka',
                province: 'Lusaka',
                country: 'Zambia',
                postalCode: '10101'
            },
            contactInfo: {
                email: 'admin@ndalamahub.com',
                phone: '260955000000',
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
        });
        console.log(`✅ Created company: ${company.name}`);

        // 3. Create the super user account
        const superUser = await User.create({
            username: 'superadmin',
            password: 'Admin@2025',
            firstName: 'System',
            lastName: 'Administrator',
            email: 'admin@ndalamahub.com',
            phone: '260955000000',
            role: 'super_user',
            company: company._id,
            status: 'active',
            department: 'Administration',
            isActive: true
        });
        console.log(`✅ Created super user: ${superUser.username}`);
        console.log('\n🔑 Login credentials:');
        console.log('Username: superadmin');
        console.log('Password: Admin@2025');

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

seedDatabase();