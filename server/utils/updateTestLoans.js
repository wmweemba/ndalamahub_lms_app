const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const LoanProduct = require('../models/LoanProduct');
require('dotenv').config();

async function updateTestLoans() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get the 3 test loans (approved ones ready for disbursement)
    const loanNumbers = ['LN20260001', 'LN20260002', 'LN20260003'];
    const loans = await Loan.find({
      loanNumber: { $in: loanNumbers }
    }).populate('product');
    
    console.log(`📊 Found ${loans.length} test loans to update\n`);
    
    for (const loan of loans) {
      if (loan.product) {
        const processingFee = loan.product.calculateProcessingFee(loan.amount);
        const insuranceFee = loan.product.calculateInsuranceFee(loan.amount);
        
        await Loan.findByIdAndUpdate(loan._id, {
          $set: {
            'fees.processing': processingFee,
            'fees.insurance': insuranceFee
          }
        });
        
        const netDisbursement = loan.amount - processingFee - insuranceFee;
        console.log(`✅ ${loan.loanNumber} (${loan.product.name})`);
        console.log(`   Amount: K${loan.amount.toFixed(2)}`);
        console.log(`   Processing Fee (${loan.product.fees.processingFee.amount}%): K${processingFee.toFixed(2)}`);
        console.log(`   Net Disbursement: K${netDisbursement.toFixed(2)}\n`);
      }
    }
    
    // Verify
    console.log('🔍 Verification after update:');
    const verifyLoans = await Loan.find({
      loanNumber: { $in: loanNumbers }
    }).populate('product');
    
    for (const loan of verifyLoans) {
      console.log(`${loan.loanNumber}: fees.processing = K${(loan.fees?.processing || 0).toFixed(2)}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateTestLoans();
