// server/utils/clearDummyBorrowerData.js
//
// One-off cleanup: removes the test/dummy borrower(s), their loan(s),
// collateral, and any website test applications from a lender's tenant,
// before handing the account over to a real client user. Never touches the
// Company document itself, its products/publicIntake config, or any staff
// (lender_admin/lender_officer) accounts — only role:'borrower' users under
// that company, plus their Loans/Collateral/CustomerApplications.
//
// Safe by default: runs as a DRY RUN (reports what it would delete) unless
// CONFIRM=yes is set, so you can review the list before anything is removed.
//
// Usage:
//   COMPANY_NAME="MANIFI INVESTMENT LIMITED" node utils/clearDummyBorrowerData.js
//   COMPANY_NAME="MANIFI INVESTMENT LIMITED" CONFIRM=yes node utils/clearDummyBorrowerData.js

const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Collateral = require('../models/Collateral');
const CustomerApplication = require('../models/CustomerApplication');
require('dotenv').config();

const DEFAULT_COMPANY_NAME = 'MANIFI INVESTMENT LIMITED';

const run = async () => {
    const companyName = process.env.COMPANY_NAME || DEFAULT_COMPANY_NAME;
    const confirmed = process.env.CONFIRM === 'yes';

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected.');

        const company = await Company.findOne({ name: companyName });
        if (!company) {
            console.error(`❌ No company found with name: ${companyName}`);
            process.exitCode = 1;
            return;
        }
        console.log(`   Company: ${company.name} (${company._id})`);

        const borrowers = await User.find({ company: company._id, role: 'borrower' });
        const loans = await Loan.find({ lenderCompany: company._id });
        const collateral = await Collateral.find({ lenderCompany: company._id });
        const applications = await CustomerApplication.find({ lenderCompany: company._id });

        console.log(`\n   Found:`);
        console.log(`   - ${borrowers.length} borrower(s): ${borrowers.map(b => `${b.firstName} ${b.lastName} (${b.nrc || b.username})`).join(', ') || '-'}`);
        console.log(`   - ${loans.length} loan(s): ${loans.map(l => `${l.loanNumber} (${l.status})`).join(', ') || '-'}`);
        console.log(`   - ${collateral.length} collateral record(s)`);
        console.log(`   - ${applications.length} customer application(s): ${applications.map(a => a.reference).join(', ') || '-'}`);

        if (!confirmed) {
            console.log('\nℹ️  Dry run only — nothing deleted. Re-run with CONFIRM=yes to actually delete the above.');
            return;
        }

        const collateralResult = await Collateral.deleteMany({ lenderCompany: company._id });
        const loanResult = await Loan.deleteMany({ lenderCompany: company._id });
        const applicationResult = await CustomerApplication.deleteMany({ lenderCompany: company._id });
        const userResult = await User.deleteMany({ company: company._id, role: 'borrower' });

        console.log('\n✅ Deleted:');
        console.log(`   - ${collateralResult.deletedCount} collateral record(s)`);
        console.log(`   - ${loanResult.deletedCount} loan(s)`);
        console.log(`   - ${applicationResult.deletedCount} customer application(s)`);
        console.log(`   - ${userResult.deletedCount} borrower user(s)`);
        console.log('\nCompany, staff accounts, products, and publicIntake config were left untouched.');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

run();
