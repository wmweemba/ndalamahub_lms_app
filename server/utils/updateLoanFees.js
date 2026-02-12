/**
 * Update existing loans to populate fees.processing field
 * Run this after adding fees field to Loan schema
 */

const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const LoanProduct = require('../models/LoanProduct');
const Company = require('../models/Company');
const User = require('../models/User');
require('dotenv').config();

async function updateLoanFees() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ndalamahub_lms');
    console.log('✅ Connected to MongoDB');

    // Get all loans that don't have fees.processing populated
    const loans = await Loan.find({
      $or: [
        { 'fees.processing': { $exists: false } },
        { 'fees.processing': null },
        { fees: { $exists: false } }
      ]
    }).populate('product');

    console.log(`\n📊 Found ${loans.length} loans without processing fees\n`);

    let updated = 0;
    for (const loan of loans) {
      if (!loan.product) {
        console.log(`⚠️  Skipping loan ${loan.loanNumber} - no product found`);
        continue;
      }

      // Calculate processing fee from product
      const processingFeeAmount = loan.product.calculateProcessingFee(loan.amount);
      
      // Update loan with fees object
      await Loan.findByIdAndUpdate(loan._id, {
        $set: {
          'fees.processing': processingFeeAmount,
          'fees.insurance': 0, // Add insurance if needed
          'fees.legal': 0,
          'fees.other': 0
        }
      });

      console.log(`✅ Updated ${loan.loanNumber} - Processing Fee: K${processingFeeAmount.toFixed(2)}`);
      updated++;
    }

    console.log(`\n✨ Successfully updated ${updated} loans`);
    
    // Verify updates
    console.log('\n🔍 Verification - Recent Loans:');
    const verifyLoans = await Loan.find({}).sort({ applicationDate: -1 }).limit(5);
    
    for (const loan of verifyLoans) {
      const netDisbursement = loan.amount - (loan.fees?.processing || 0);
      console.log(`
Loan: ${loan.loanNumber}
  Status: ${loan.status}
  Amount: K${loan.amount.toFixed(2)}
  Processing Fee: K${(loan.fees?.processing || 0).toFixed(2)}
  Net Disbursement: K${netDisbursement.toFixed(2)}
  Has Product: ${loan.product ? 'Yes' : 'No'}
      `);
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating loan fees:', error);
    process.exit(1);
  }
}

updateLoanFees();
