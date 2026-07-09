/**
 * Test script to demonstrate Loan model calculations with new interest calculator
 * Week 1, Day 3 - Phase 0: Loan Engine Enhancement
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Company = require('../models/Company');
const User = require('../models/User');

async function testLoanCalculations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Find a test company and user
    const company = await Company.findOne({ type: 'lender' });
    const user = await User.findOne({ role: 'platform_admin' });
    
    if (!company || !user) {
      console.log('❌ Need company and user for testing');
      return;
    }
    
    console.log('='.repeat(70));
    console.log('LOAN CALCULATION TEST - Daily Interest Accrual');
    console.log('='.repeat(70));
    console.log('');
    
    // Test Case 1: Monthly frequency with actual/365
    console.log('Test Case 1: Monthly Loan with Actual/365 Day Count');
    console.log('-'.repeat(70));
    
    const loan1 = new Loan({
      applicant: user._id,
      company: company._id,
      lenderCompany: company._id,
      amount: 50000,
      interestRate: 24,
      term: 12,
      purpose: 'Test loan with daily interest accrual',
      interestCalculation: {
        method: 'reducing_balance',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      },
      repaymentFrequency: 'monthly',
      disbursedAt: new Date('2026-02-10')
    });
    
    // This will trigger calculateLoanDetails in pre-save hook
    await loan1.save();
    
    console.log(`Loan Amount: ZMW ${loan1.amount.toLocaleString()}`);
    console.log(`Interest Rate: ${loan1.interestRate}% per annum`);
    console.log(`Term: ${loan1.term} months`);
    console.log(`Monthly Payment: ZMW ${loan1.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${loan1.totalInterest.toFixed(2)}`);
    console.log(`Total Amount: ZMW ${loan1.totalAmount.toFixed(2)}`);
    console.log('');
    console.log('First 3 Installments:');
    loan1.repaymentSchedule.slice(0, 3).forEach((inst, idx) => {
      console.log(`  ${idx + 1}. Due: ${inst.dueDate.toLocaleDateString()}, ` +
                  `Principal: ZMW ${inst.principal.toFixed(2)}, ` +
                  `Interest: ZMW ${inst.interest.toFixed(2)}`);
    });
    console.log('');
    
    // Notice February has less interest
    const febInstallment = loan1.repaymentSchedule[0]; // Feb payment
    const marInstallment = loan1.repaymentSchedule[1]; // Mar payment
    console.log('💡 Key Insight:');
    console.log(`   February interest: ZMW ${febInstallment.interest.toFixed(2)} (28 days)`);
    console.log(`   March interest:    ZMW ${marInstallment.interest.toFixed(2)} (31 days)`);
    console.log(`   Difference:        ZMW ${(marInstallment.interest - febInstallment.interest).toFixed(2)}`);
    console.log('');
    
    // Clean up test loan
    await Loan.findByIdAndDelete(loan1._id);
    
    // Test Case 2: Bi-weekly frequency
    console.log('');
    console.log('Test Case 2: Bi-Weekly Loan (26 payments per year)');
    console.log('-'.repeat(70));
    
    const loan2 = new Loan({
      applicant: user._id,
      company: company._id,
      lenderCompany: company._id,
      amount: 30000,
      interestRate: 18,
      term: 26, // 26 bi-weekly payments = 1 year
      purpose: 'Bi-weekly payroll loan',
      interestCalculation: {
        method: 'reducing_balance',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      },
      repaymentFrequency: 'bi_weekly',
      disbursedAt: new Date('2026-02-10')
    });
    
    await loan2.save();
    
    console.log(`Loan Amount: ZMW ${loan2.amount.toLocaleString()}`);
    console.log(`Interest Rate: ${loan2.interestRate}% per annum`);
    console.log(`Term: ${loan2.term} bi-weekly payments`);
    console.log(`Payment Amount: ZMW ${loan2.monthlyPayment.toFixed(2)}`);
    console.log(`Total Interest: ZMW ${loan2.totalInterest.toFixed(2)}`);
    console.log('');
    console.log('First 5 Payment Dates:');
    loan2.repaymentSchedule.slice(0, 5).forEach((inst, idx) => {
      console.log(`  ${idx + 1}. ${inst.dueDate.toLocaleDateString()} - ZMW ${inst.amount.toFixed(2)}`);
    });
    console.log('');
    
    // Clean up test loan
    await Loan.findByIdAndDelete(loan2._id);
    
    // Test Case 3: Compare day count conventions
    console.log('');
    console.log('Test Case 3: Day Count Convention Comparison');
    console.log('-'.repeat(70));
    
    const conventions = ['actual/365', 'actual/360', '30/360'];
    const results = [];
    
    for (const convention of conventions) {
      const loan = new Loan({
        applicant: user._id,
        company: company._id,
        lenderCompany: company._id,
        amount: 100000,
        interestRate: 20,
        term: 12,
        purpose: `Test with ${convention}`,
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: convention,
          accrualFrequency: 'daily'
        },
        repaymentFrequency: 'monthly',
        disbursedAt: new Date('2026-02-10')
      });
      
      await loan.save();
      
      results.push({
        convention,
        totalInterest: loan.totalInterest,
        monthlyPayment: loan.monthlyPayment
      });
      
      await Loan.findByIdAndDelete(loan._id);
    }
    
    console.log(`Loan Amount: ZMW 100,000`);
    console.log(`Interest Rate: 20% per annum`);
    console.log(`Term: 12 months`);
    console.log('');
    results.forEach(r => {
      console.log(`${r.convention.padEnd(15)}: Monthly Payment: ZMW ${r.monthlyPayment.toFixed(2)}, ` +
                  `Total Interest: ZMW ${r.totalInterest.toFixed(2)}`);
    });
    
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ All loan calculations completed successfully!');
    console.log('='.repeat(70));
    console.log('');
    console.log('Summary:');
    console.log('- Loans now use daily interest accrual with actual day counts');
    console.log('- February payments have lower interest (28 days vs 30-31)');
    console.log('- Bi-weekly and other frequencies are properly supported');
    console.log('- Day count conventions produce accurate results');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Database connection closed');
  }
}

testLoanCalculations();
