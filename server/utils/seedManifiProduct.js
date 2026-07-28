// server/utils/seedManifiProduct.js
//
// One-off seed for Manifi's single loan product (Phase 26 launch decisions:
// 25% flat per 30-day term, rollover enabled with a 14-day grace, collateral
// required). Manifi uses exactly one product for all loans — this isn't a
// generic reusable seeder, it's specific to this launch. Idempotent: skips
// if a product with this name already exists under the company, since
// Clement can adjust details afterward via the Products UI.
//
// Usage: node utils/seedManifiProduct.js

const mongoose = require('mongoose');
const Company = require('../models/Company');
const LoanProduct = require('../models/LoanProduct');
require('dotenv').config();

const COMPANY_NAME = 'MANIFI INVESTMENT LIMITED';
const PRODUCT_NAME = 'Manifi 30-Day Payday Loan';

const seedProduct = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected.');

        const company = await Company.findOne({ name: COMPANY_NAME });
        if (!company) {
            console.error(`❌ No company found with name: ${COMPANY_NAME}`);
            process.exitCode = 1;
            return;
        }
        if (company.lendingModel !== 'direct') {
            console.error(`❌ ${COMPANY_NAME} has lendingModel="${company.lendingModel}", expected "direct". Fix that first.`);
            process.exitCode = 1;
            return;
        }

        const existing = await LoanProduct.findOne({ company: company._id, name: PRODUCT_NAME });
        if (existing) {
            console.log(`⚠️  Product already exists (id: ${existing._id}) — skipping. Adjust it via the Products page instead.`);
            return;
        }

        const product = await LoanProduct.create({
            name: PRODUCT_NAME,
            description: '25% flat interest per 30-day term, with automatic rollover (14-day grace window) and required collateral.',
            category: 'payday',
            company: company._id,
            interestRate: { min: 25, max: 25, default: 25 },
            term: { min: 30, max: 30, default: 30, unit: 'days' },
            amount: { min: 500, max: 100000, currency: 'ZMW' },
            interestCalculation: {
                method: 'flat_rate',
                rateBasis: 'per_term'
            },
            collateralRequired: true,
            collateralTypes: ['vehicle', 'business_equipment', 'title_deed', 'other'],
            rollover: { enabled: true, graceDays: 14 },
            isActive: true
        });

        console.log(`✅ Created product: ${product.name} (id: ${product._id})`);
        console.log('   Amount range: K500 – K100,000 · 25% flat per 30-day term · rollover on, 14-day grace · collateral required (all 4 types)');

    } catch (error) {
        console.error('❌ Product seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

seedProduct();
