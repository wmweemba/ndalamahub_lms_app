/**
 * Reapply prepayment logic to fix schedule term reduction
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ndalamahub_lms');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

async function reapplyPrepayment(loanNumber) {
  const Loan = require('../models/Loan');
  const LoanProduct = require('../models/LoanProduct');
  
  try {
    const loan = await Loan.findOne({ loanNumber });
    
    if (!loan) {
      console.error(`Loan ${loanNumber} not found`);
      return;
    }
    
    console.log('\n========================================');
    console.log(`Loan: ${loan.loanNumber}`);
    console.log(`Original term: ${loan.term} months`);
    console.log(`Current schedule: ${loan.repaymentSchedule.length} installments`);
    console.log(`Paid installments: ${loan.repaymentSchedule.filter(i => i.status === 'paid').length}`);
    console.log(`Prepayments: ${loan.prepayments.length}`);
    console.log('========================================\n');
    
    if (loan.prepayments.length === 0) {
      console.log('No prepayments found. Nothing to reapply.');
      return;
    }
    
    const prepayment = loan.prepayments[0];
    console.log(`Prepayment details:`);
    console.log(`  Amount: K${prepayment.amount.toFixed(2)}`);
    console.log(`  Strategy: ${prepayment.allocationStrategy}`);
    console.log(`  Date: ${new Date(prepayment.date).toISOString().split('T')[0]}`);
    
    console.log('\nRecalculating schedule with reduce_term strategy...\n');
    
    // Use the loan model's recalculateSchedule method
    loan.recalculateSchedule('reduce_term');
    
    console.log(`New schedule length: ${loan.repaymentSchedule.length} installments`);
    console.log(`Paid: ${loan.repaymentSchedule.filter(i => i.status === 'paid').length}`);
    console.log(`Pending: ${loan.repaymentSchedule.filter(i => i.status === 'pending').length}`);
    console.log(`Term reduced by: ${loan.term - loan.repaymentSchedule.length} months`);
    
    // Save the loan
    await loan.save();
    
    console.log('\n✅ Schedule successfully recalculated and saved!');
    console.log(`\nExpected outcome:`);
    console.log(`  - Original: ${loan.term} months`);
    console.log(`  - After prepayment: ${loan.repaymentSchedule.length} months`);
    console.log(`  - Months saved: ${loan.term - loan.repaymentSchedule.length}`);
    
  } catch (error) {
    console.error('Error reapplying prepayment:', error);
  }
}

// Main execution
(async () => {
  const loanNumber = process.argv[2];
  
  if (!loanNumber) {
    console.log('\nUsage: node utils/reapplyPrepayment.js <LOAN_NUMBER>');
    console.log('Example: node utils/reapplyPrepayment.js LN20260001\n');
    process.exit(1);
  }
  
  await connectDB();
  await reapplyPrepayment(loanNumber);
  await mongoose.connection.close();
  process.exit(0);
})();
