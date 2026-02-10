/**
 * Test comparing flat rate vs reducing balance amortization
 * Demonstrates the difference in interest calculations
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Loan = require('../models/Loan');

async function testFlatRateVsReducingBalance() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test parameters - same for both methods
    const loanParams = {
      amount: 10000, // ZMW 10,000
      interestRate: 24, // 24% annual rate
      term: 6, // 6 months
      repaymentFrequency: 'monthly'
    };

    console.log('=== LOAN PARAMETERS ===');
    console.log(`Principal: ZMW ${loanParams.amount.toLocaleString()}`);
    console.log(`Annual Rate: ${loanParams.interestRate}%`);
    console.log(`Term: ${loanParams.term} months`);
    console.log(`Frequency: ${loanParams.repaymentFrequency}\n`);

    // Create flat rate loan
    const flatRateLoan = new Loan({
      ...loanParams,
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      interestCalculation: {
        method: 'flat_rate',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });

    flatRateLoan.calculateLoanDetails();
    flatRateLoan.generateRepaymentSchedule();

    // Create reducing balance loan
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

    // Display flat rate results
    console.log('=== FLAT RATE METHOD ===');
    console.log(`Monthly Payment: ZMW ${flatRateLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${flatRateLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${flatRateLoan.totalAmount.toFixed(2)}`);
    console.log(`\nSchedule:`);
    flatRateLoan.repaymentSchedule.forEach(installment => {
      console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
    });

    // Display reducing balance results
    console.log('\n=== REDUCING BALANCE METHOD ===');
    console.log(`Monthly Payment: ZMW ${reducingBalanceLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${reducingBalanceLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${reducingBalanceLoan.totalAmount.toFixed(2)}`);
    console.log(`\nSchedule:`);
    reducingBalanceLoan.repaymentSchedule.forEach(installment => {
      console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
    });

    // Calculate the difference
    const interestDifference = flatRateLoan.totalInterest - reducingBalanceLoan.totalInterest;
    const percentageHigher = ((interestDifference / reducingBalanceLoan.totalInterest) * 100).toFixed(2);

    console.log('\n=== COMPARISON ===');
    console.log(`Flat Rate Interest: ZMW ${flatRateLoan.totalInterest.toFixed(2)}`);
    console.log(`Reducing Balance Interest: ZMW ${reducingBalanceLoan.totalInterest.toFixed(2)}`);
    console.log(`Difference: ZMW ${interestDifference.toFixed(2)} (${percentageHigher}% higher)`);
    console.log('\n💡 Key Insight:');
    console.log('Flat rate charges interest on the full principal for the entire term,');
    console.log('while reducing balance charges interest only on the remaining balance.');
    console.log('This makes flat rate significantly more expensive for borrowers.');

    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFlatRateVsReducingBalance();
