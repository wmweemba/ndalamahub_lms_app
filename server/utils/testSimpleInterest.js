/**
 * Test comparing all three amortization methods
 * Demonstrates simple interest vs flat rate vs reducing balance
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Loan = require('../models/Loan');

async function testAllMethods() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test parameters - same for all methods
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

    // Create simple interest loan
    const simpleInterestLoan = new Loan({
      ...loanParams,
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      interestCalculation: {
        method: 'simple_interest',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });

    simpleInterestLoan.calculateLoanDetails();
    simpleInterestLoan.generateRepaymentSchedule();

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

    // Display results
    console.log('=== REDUCING BALANCE METHOD (Standard) ===');
    console.log(`Monthly Payment: ZMW ${reducingBalanceLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${reducingBalanceLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${reducingBalanceLoan.totalAmount.toFixed(2)}`);
    console.log(`\nSchedule:`);
    reducingBalanceLoan.repaymentSchedule.forEach(installment => {
      console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
    });

    console.log('\n=== SIMPLE INTEREST METHOD ===');
    console.log(`Average Payment: ZMW ${simpleInterestLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${simpleInterestLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${simpleInterestLoan.totalAmount.toFixed(2)}`);
    console.log(`\nSchedule:`);
    simpleInterestLoan.repaymentSchedule.forEach(installment => {
      console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
    });

    console.log('\n=== FLAT RATE METHOD ===');
    console.log(`Monthly Payment: ZMW ${flatRateLoan.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${flatRateLoan.totalInterest.toFixed(2)}`);
    console.log(`Total Repayment: ZMW ${flatRateLoan.totalAmount.toFixed(2)}`);
    console.log(`\nSchedule:`);
    flatRateLoan.repaymentSchedule.forEach(installment => {
      console.log(`  ${installment.installmentNumber}. Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
    });

    // Calculate comparison
    console.log('\n=== COST COMPARISON (Sorted by Total Interest) ===');
    const methods = [
      { name: 'Reducing Balance', interest: reducingBalanceLoan.totalInterest, total: reducingBalanceLoan.totalAmount },
      { name: 'Simple Interest', interest: simpleInterestLoan.totalInterest, total: simpleInterestLoan.totalAmount },
      { name: 'Flat Rate', interest: flatRateLoan.totalInterest, total: flatRateLoan.totalAmount }
    ].sort((a, b) => a.interest - b.interest);

    methods.forEach((method, index) => {
      const savingsVsNext = index < methods.length - 1 
        ? (methods[index + 1].interest - method.interest).toFixed(2)
        : 0;
      
      console.log(`${index + 1}. ${method.name}`);
      console.log(`   Total Interest: ZMW ${method.interest.toFixed(2)}`);
      console.log(`   Total Repayment: ZMW ${method.total.toFixed(2)}`);
      if (savingsVsNext > 0) {
        console.log(`   💰 Saves ZMW ${savingsVsNext} vs ${methods[index + 1].name}`);
      }
      console.log('');
    });

    console.log('💡 Key Insights:');
    console.log('- Reducing Balance: Interest on remaining balance (lowest cost)');
    console.log('- Simple Interest: Interest on original principal per period');
    console.log('- Flat Rate: Total interest upfront, divided equally (highest cost)');
    console.log('\nNote: Simple interest varies by actual days in month,');
    console.log('while flat rate divides total interest equally.');

    await mongoose.disconnect();
    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAllMethods();
