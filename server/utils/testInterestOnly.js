/**
 * Test interest-only loans with balloon payment
 * Demonstrates how interest-only works compared to other methods
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Loan = require('../models/Loan');

async function testInterestOnly() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test parameters
    const loanParams = {
      amount: 50000, // ZMW 50,000
      interestRate: 18, // 18% annual rate
      term: 12, // 12 months
      repaymentFrequency: 'monthly'
    };

    console.log('=== LOAN PARAMETERS ===');
    console.log(`Principal: ZMW ${loanParams.amount.toLocaleString()}`);
    console.log(`Annual Rate: ${loanParams.interestRate}%`);
    console.log(`Term: ${loanParams.term} months`);
    console.log(`Frequency: ${loanParams.repaymentFrequency}\n`);

    // Create interest-only loan
    const interestOnlyLoan = new Loan({
      ...loanParams,
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      interestCalculation: {
        method: 'interest_only',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });

    interestOnlyLoan.calculateLoanDetails();
    interestOnlyLoan.generateRepaymentSchedule();

    // Create reducing balance loan for comparison
    const reducingBalanceLoan = new Loan({
      ...loanParams,
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      interestCalculation: {
        method: 'reducing_balance',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });

    reducingBalanceLoan.calculateLoanDetails();
    reducingBalanceLoan.generateRepaymentSchedule();

    // Display interest-only results
    console.log('=== INTEREST-ONLY LOAN ===');
    console.log(`Regular Payment (Interest Only): ZMW ${interestOnlyLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${interestOnlyLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${interestOnlyLoan.totalAmount.toFixed(2)}`);
    console.log(`\nPayment Schedule:`);
    
    interestOnlyLoan.repaymentSchedule.forEach(installment => {
      if (installment.isBalloonPayment) {
        console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)} 🎈 BALLOON`);
      } else {
        console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
      }
    });

    console.log('\n=== REDUCING BALANCE LOAN (for comparison) ===');
    console.log(`Monthly Payment: ZMW ${reducingBalanceLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${reducingBalanceLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${reducingBalanceLoan.totalAmount.toFixed(2)}`);
    
    // Show first and last payments only
    console.log(`\nFirst Payment: Principal ZMW ${reducingBalanceLoan.repaymentSchedule[0].principal.toFixed(2)} | Interest ZMW ${reducingBalanceLoan.repaymentSchedule[0].interest.toFixed(2)}`);
    console.log(`Last Payment: Principal ZMW ${reducingBalanceLoan.repaymentSchedule[11].principal.toFixed(2)} | Interest ZMW ${reducingBalanceLoan.repaymentSchedule[11].interest.toFixed(2)}`);

    // Calculate comparison
    const interestDiff = interestOnlyLoan.totalInterest - reducingBalanceLoan.totalInterest;
    const percentHigher = ((interestDiff / reducingBalanceLoan.totalInterest) * 100).toFixed(2);

    console.log('\n=== COMPARISON ===');
    console.log(`Interest-Only Total Interest: ZMW ${interestOnlyLoan.totalInterest.toFixed(2)}`);
    console.log(`Reducing Balance Total Interest: ZMW ${reducingBalanceLoan.totalInterest.toFixed(2)}`);
    console.log(`Difference: ZMW ${interestDiff.toFixed(2)} (${percentHigher}% higher)`);
    
    console.log('\n💡 Key Features of Interest-Only Loans:');
    console.log('✓ Lower monthly payments (interest only)');
    console.log('✓ Preserves capital for other investments');
    console.log('✓ Full principal due at maturity (balloon payment)');
    console.log('✗ Higher total interest cost vs reducing balance');
    console.log('✗ Requires refinancing or lump sum at end');
    
    console.log('\n📊 Use Cases:');
    console.log('- Bridge financing');
    console.log('- Investment properties (rental income covers interest)');
    console.log('- Short-term business expansion');
    console.log('- When capital preservation is important');

    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testInterestOnly();
