/**
 * Utility to fix corrupted loan schedules after prepayment
 * Run this to recalculate schedule for specific loan
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

async function fixLoanSchedule(loanNumber) {
  const Loan = require('../models/Loan');
  const LoanProduct = require('../models/LoanProduct'); // Register the model
  
  try {
    const loan = await Loan.findOne({ loanNumber }).populate('product');
    
    if (!loan) {
      console.error(`Loan ${loanNumber} not found`);
      return;
    }
    
    console.log(`\nFound loan: ${loan.loanNumber}`);
    console.log(`Status: ${loan.status}`);
    console.log(`Amount: K${loan.amount}`);
    console.log(`Calculation Method: ${loan.interestCalculation?.method || 'N/A'}`);
    console.log(`Current schedule length: ${loan.repaymentSchedule.length} installments`);
    
    // Count paid installments
    const paidInstallments = loan.repaymentSchedule.filter(inst => 
      inst.status === 'paid' && inst.paidAmount > 0
    );
    console.log(`Paid installments: ${paidInstallments.length}`);
    
    // Calculate remaining principal
    let remainingPrincipal = loan.amount;
    for (const inst of paidInstallments) {
      remainingPrincipal -= (inst.principal || 0);
    }
    
    console.log(`Remaining principal: K${remainingPrincipal.toFixed(2)}`);
    
    // Ask for confirmation
    if (remainingPrincipal <= 0 || remainingPrincipal > loan.amount) {
      console.error('Invalid remaining principal calculated. Please check the loan data.');
      return;
    }
    
    // Recalculate schedule using the loan model method
    console.log('\nRecalculating schedule...');
    
    // Preserve payment details from paid installments
    const paidInstallmentDetails = new Map();
    for (const inst of loan.repaymentSchedule) {
      if (inst.status === 'paid' && inst.paidAmount > 0) {
        paidInstallmentDetails.set(inst.installmentNumber, {
          paidAmount: inst.paidAmount,
          paidAt: inst.paidAt,
          paymentDate: inst.paymentDate,
          paymentMethod: inst.paymentMethod,
          referenceNumber: inst.referenceNumber,
          paymentNotes: inst.paymentNotes
        });
      }
    }
    
    // Manually recalculate for reducing_balance
    if (loan.interestCalculation?.method === 'reducing_balance') {
      const annualRate = loan.interestRate / 100;
      const monthlyRate = annualRate / 12;
      
      // Find last paid installment
      const lastPaidIndex = paidInstallments.length - 1;
      const lastPaidInstallment = paidInstallments[lastPaidIndex];
      
      // Calculate new term based on remaining principal
      const monthlyPayment = loan.monthlyPayment;
      let newTerm;
      
      if (monthlyRate === 0) {
        newTerm = Math.ceil(remainingPrincipal / monthlyPayment);
      } else {
        const numerator = Math.log(monthlyPayment / (monthlyPayment - remainingPrincipal * monthlyRate));
        const denominator = Math.log(1 + monthlyRate);
        newTerm = Math.ceil(numerator / denominator);
      }
      
      // Safety checks
      if (!isFinite(newTerm) || newTerm <= 0 || newTerm > loan.loanTerm) {
        console.error('Invalid calculated term:', newTerm);
        return;
      }
      
      console.log(`New term: ${newTerm} months`);
      
      // Build new schedule
      const newSchedule = [];
      
      // Keep paid installments as-is
      for (let i = 0; i < paidInstallments.length; i++) {
        newSchedule.push(paidInstallments[i]);
      }
      
      // Generate new unpaid installments
      let currentBalance = remainingPrincipal;
      const lastPaidDate = lastPaidInstallment.dueDate;
      
      for (let i = 0; i < newTerm; i++) {
        const installmentNumber = paidInstallments.length + i + 1;
        
        // Calculate due date (1 month after last payment or previous installment)
        const dueDate = new Date(lastPaidDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        
        // Calculate interest on remaining balance
        const interestAmount = currentBalance * monthlyRate;
        
        // For last installment, use exact remaining balance
        const isLastInstallment = (i === newTerm - 1);
        let principalAmount, installmentAmount;
        
        if (isLastInstallment) {
          principalAmount = currentBalance;
          installmentAmount = principalAmount + interestAmount;
        } else {
          principalAmount = monthlyPayment - interestAmount;
          
          // Safety check: prevent negative principal
          if (principalAmount <= 0) {
            principalAmount = currentBalance;
            installmentAmount = principalAmount + interestAmount;
          } else {
            installmentAmount = monthlyPayment;
          }
        }
        
        newSchedule.push({
          installmentNumber,
          dueDate,
          amount: Math.round(installmentAmount * 100) / 100,
          principal: Math.round(principalAmount * 100) / 100,
          interest: Math.round(interestAmount * 100) / 100,
          status: 'pending',
          paidAmount: 0
        });
        
        currentBalance -= principalAmount;
      }
      
      // Update loan
      loan.repaymentSchedule = newSchedule;
      loan.loanTerm = paidInstallments.length + newTerm;
      
      await loan.save();
      
      console.log('\n✅ Schedule recalculated successfully!');
      console.log(`New total term: ${loan.loanTerm} months`);
      console.log(`Remaining installments: ${newTerm}`);
      console.log(`Final balance should be: K0.00`);
      
      // Verify calculation
      const finalBalance = newSchedule[newSchedule.length - 1];
      console.log(`\nLast installment:`);
      console.log(`  Due date: ${finalBalance.dueDate.toISOString().split('T')[0]}`);
      console.log(`  Amount: K${finalBalance.amount}`);
      console.log(`  Principal: K${finalBalance.principal}`);
      console.log(`  Interest: K${finalBalance.interest}`);
      
    } else {
      console.error('This utility currently only supports reducing_balance loans');
      return;
    }
    
  } catch (error) {
    console.error('Error fixing schedule:', error);
  }
}

// Main execution
(async () => {
  const loanNumber = process.argv[2];
  
  if (!loanNumber) {
    console.log('\nUsage: node utils/fixCorruptedSchedule.js <LOAN_NUMBER>');
    console.log('Example: node utils/fixCorruptedSchedule.js LN20260001\n');
    process.exit(1);
  }
  
  await connectDB();
  await fixLoanSchedule(loanNumber);
  await mongoose.connection.close();
  process.exit(0);
})();
