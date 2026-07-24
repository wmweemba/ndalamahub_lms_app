// server/utils/seedSuperUser.js
//
// One-off production bootstrap for the very first platform_admin account.
// No self-serve registration exists (removed in Phase 01 as a security fix),
// so this is the only way to create that first account. Credentials come
// from env vars at runtime — never hardcode them here, this file is committed.
//
// Usage (run once, in the production container, then discard the env vars):
//   BOOTSTRAP_ADMIN_USERNAME=... BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \
//     node utils/seedSuperUser.js

const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
require('dotenv').config();

const REQUIRED_ENV_VARS = ['BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD'];

const seedDatabase = async () => {
    const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        console.error(`❌ Missing required env var(s): ${missing.join(', ')}`);
        console.error('   Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD before running.');
        process.exitCode = 1;
        return;
    }

    const { BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = process.env;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected for seeding.');

        // 1. Check if this admin already exists
        const existingAdmin = await User.findOne({ username: BOOTSTRAP_ADMIN_USERNAME });
        if (existingAdmin) {
            console.log('⚠️ A user with that username already exists. Skipping seeding.');
            return;
        }

        // 2. Every User requires a company ref (schema constraint) even for
        // platform_admin, whose access is scoped to {} regardless — this is
        // a structural placeholder, not a real lender/tenant record.
        const company = await Company.create({
            name: 'Nexus (Platform Owner)',
            type: 'lender',
            registrationNumber: 'NEXUS-INTERNAL',
            status: 'active',
            address: {
                street: 'N/A',
                city: 'Lusaka',
                province: 'Lusaka',
                country: 'Zambia'
            },
            contactInfo: {
                email: BOOTSTRAP_ADMIN_EMAIL,
                phone: '000000000'
            },
            description: 'Internal placeholder company for the platform owner account. Not a real tenant.'
        });
        console.log(`✅ Created placeholder company: ${company.name}`);

        // 3. Create the platform_admin account
        const admin = await User.create({
            username: BOOTSTRAP_ADMIN_USERNAME,
            password: BOOTSTRAP_ADMIN_PASSWORD,
            firstName: 'Platform',
            lastName: 'Administrator',
            email: BOOTSTRAP_ADMIN_EMAIL,
            phone: '000000000',
            role: 'platform_admin',
            company: company._id,
            status: 'active',
            department: 'Administration',
            isActive: true
        });
        console.log(`✅ Created platform_admin: ${admin.username}`);
        console.log('   Log in now and treat this as done — do not leave the env vars set in shell history.');

    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

seedDatabase();