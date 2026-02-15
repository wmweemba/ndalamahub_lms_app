/**
 * Script to remove prepayment and restore original schedule
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

async function removePrepaymentAndRestore(loanNumber) {
  const Loan = require('../models/Loan');
  const LoanProduct = require('../models/LoanProduct');
  
  try {
    const loan = await Loan.findOne({ loanNumber });
    
    if (!loan) {
      console.error(`Loan ${loanNumber} not found`);
      return;
    }
    
    console.log(`\nFound loan: ${loan.loanNumber}`);
    console.log(`Current term: ${loan.loanTerm} months`);
    console.log(`Current schedule: ${loan.repaymentSchedule.length} installments`);
    console.log(`Prepayments: ${loan.prepayments?.length || 0}`);
    
    // Save paid installment details
    const paidInstallments = loan.repaymentSchedule
      .filter(inst => inst.status === 'paid' && inst.paidAmount > 0)
      .map(inst => ({
        installmentNumber: inst.installmentNumber,
        paidAmount: inst.paidAmount,
        paidAt: inst.paidAt,
        paymentDate: inst.paymentDate,
        paymentMethod: inst.paymentMethod,
        referenceNumber: inst.referenceNumber,
        paymentNotes: inst.paymentNotes
      }));
    
    console.log(`\nPaid installments to preserve: ${paidInstallments.length}`);
    paidInstallments.forEach(p => {
      console.log(`  #${p.installmentNumber}: K${p.paidAmount} on ${p.paymentDate?.toISOString().split('T')[0]}`);
    });
    
    // Remove prepayments
    if (loan.prepayments && loan.prepayments.length > 0) {
      console.log(`\nRemoving ${loan.prepayments.length} prepayment(s)...`);
      loan.prepayments = [];
    }
    
    // Regenerate original 24-month schedule
    console.log('\nRegenerating original 24-month schedule...');
    
    const annualRate = loan.interestRate / 100;
    const monthlyRate = annualRate / 12;
    const originalTerm = loan.term; // Should be 24
    const monthlyPayment = loan.monthlyPayment;
    
    console.log(`Original term: ${originalTerm} months`);
    console.log(`Monthly payment: K${monthlyPayment}`);
    console.log(`Interest rate: ${loan.interestRate}% p.a.`);
    
    const newSchedule = [];
    let balance = loan.amount;
    
    for (let i = 0; i < originalTerm; i++) {
      const installmentNumber = i + 1;
      
      // Calculate due date
      const dueDate = new Date(loan.disbursementDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      
      // Calculate interest on remaining balance
      const interestAmount = balance * monthlyRate;
      
      // Last installment uses exact remaining balance
      const isLastInstallment = (i === originalTerm - 1);
      let principalAmount, installmentAmount;
      
      if (isLastInstallment) {
        principalAmount = balance;
        installmentAmount = principalAmount + interestAmount;
      } else {
        principalAmount = monthlyPayment - interestAmount;
        installmentAmount = monthlyPayment;
      }
      
      // Create installment
      const installment = {
        installmentNumber,
        dueDate,
        amount: Math.round(installmentAmount * 100) / 100,
        principal: Math.round(principalAmount * 100) / 100,
        interest: Math.round(interestAmount * 100) / 100,
        status: 'pending',
        paidAmount: 0
      };
      
      // Check if this installment was paid
      const paidInfo = paidInstallments.find(p => p.installmentNumber === installmentNumber);
      if (paidInfo) {
        installment.status = 'paid';
        installment.paidAmount = paidInfo.paidAmount;
        installment.paidAt = paidInfo.paidAt;
        installment.paymentDate = paidInfo.paymentDate;
        installment.paymentMethod = paidInfo.paymentMethod;
        installment.referenceNumber = paidInfo.referenceNumber;
        installment.paymentNotes = paidInfo.paymentNotes;
      }
      
      newSchedule.push(installment);
      balance -= principalAmount;
    }
    
    // Update loan
    loan.repaymentSchedule = newSchedule;
    loan.loanTerm = originalTerm;
    
    await loan.save();
    
    console.log(`\n✅ Loan restored successfully!`);
    console.log(`Term: ${loan.loanTerm} months (original)`);
    console.log(`Schedule: ${loan.repaymentSchedule.length} installments`);
    console.log(`Paid: ${paidInstallments.length} installments`);
    console.log(`Remaining: ${originalTerm - paidInstallments.length} installments`);
    console.log(`Prepayments: ${loan.prepayments.length}`);
    
    console.log(`\nNext payment due:`);
    const nextDue = newSchedule.find(inst => inst.status !== 'paid');
    if (nextDue) {
      console.log(`  Installment #${nextDue.installmentNumber}`);
      console.log(`  Due: ${nextDue.dueDate.toISOString().split('T')[0]}`);
      console.log(`  Amount: K${nextDue.amount}`);
    }
    
  } catch (error) {
    console.error('Error removing prepayment:', error);
  }
}

// Main execution
(async () => {
  const loanNumber = process.argv[2];
  
  if (!loanNumber) {
    console.log('\nUsage: node utils/removePrepayment.js <LOAN_NUMBER>');
    console.log('Example: node utils/removePrepayment.js LN20260001\n');
    process.exit(1);
  }
  
  await connectDB();
  await removePrepaymentAndRestore(loanNumber);
  await mongoose.connection.close();
  console.log('\nDone!');
  process.exit(0);
})();
