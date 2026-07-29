// server/utils/fixStuckPrepaidLoan.js
//
// One-off data fix for loans stuck by the Phase 27 follow-up bug: a
// prepayment (POST /:id/prepayment) that covered the full remaining balance
// never marked the loan 'completed' (only /repayment and /early-settlement
// did that check). The route is now fixed for future prepayments — this
// script repairs any loan that already got stuck in that state before the
// fix landed.
//
// Only touches a loan whose remaining balance is already ~0 and whose
// status isn't already a terminal one — never forces completion on a loan
// that still has money outstanding.
//
// Usage:
//   LOAN_NUMBER=LN20260001 node utils/fixStuckPrepaidLoan.js

const mongoose = require('mongoose');
const Loan = require('../models/Loan');
require('dotenv').config();

const TERMINAL_STATUSES = ['completed', 'cancelled', 'rejected', 'defaulted'];

const run = async () => {
    const { LOAN_NUMBER } = process.env;
    if (!LOAN_NUMBER) {
        console.error('❌ Missing required env var: LOAN_NUMBER');
        console.error('   Set LOAN_NUMBER before running.');
        process.exitCode = 1;
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected.');

        const loan = await Loan.findOne({ loanNumber: LOAN_NUMBER });
        if (!loan) {
            console.error(`❌ No loan found with loanNumber "${LOAN_NUMBER}".`);
            process.exitCode = 1;
            return;
        }

        const remainingBalance = loan.calculateRemainingBalance();
        console.log(`   Loan ${loan.loanNumber}: status=${loan.status}, remainingBalance=${remainingBalance.toFixed(2)}, scheduleLength=${loan.repaymentSchedule.length}`);

        if (TERMINAL_STATUSES.includes(loan.status)) {
            console.log(`ℹ️  Loan is already in a terminal status (${loan.status}) — no change made.`);
            return;
        }

        if (remainingBalance > 0.01) {
            console.error(`❌ Refusing to complete this loan — remaining balance is ${remainingBalance.toFixed(2)}, not zero.`);
            process.exitCode = 1;
            return;
        }

        loan.status = 'completed';
        await loan.save();

        const reloaded = await Loan.findById(loan._id);
        console.log(`✅ Loan ${reloaded.loanNumber} status is now: ${reloaded.status}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

run();
