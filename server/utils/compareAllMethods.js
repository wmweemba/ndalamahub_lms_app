/**
 * Comprehensive comparison of all four amortization methods
 * Demonstrates differences and use cases for each method
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Loan = require('../models/Loan');

async function compareAllMethods() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const loanParams = {
      amount: 20000,
      interestRate: 20,
      term: 12,
      repaymentFrequency: 'monthly'
    };

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     LOAN AMORTIZATION METHODS COMPARISON                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`Principal: ZMW ${loanParams.amount.toLocaleString()}`);
    console.log(`Annual Rate: ${loanParams.interestRate}%`);
    console.log(`Term: ${loanParams.term} months`);
    console.log(`Frequency: ${loanParams.repaymentFrequency}\n`);

    // Create all four loan types
    const methods = ['reducing_balance', 'simple_interest', 'flat_rate', 'interest_only'];
    const loans = {};

    for (const method of methods) {
      loans[method] = new Loan({
        ...loanParams,
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        interestCalculation: {
          method,
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });
      loans[method].calculateLoanDetails();
      loans[method].generateRepaymentSchedule();
    }

    // Display comparison table
    console.log('┌─────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Method              │ Payment (Avg)│ Total Int    │ Total Repay  │ Last Payment │');
    console.log('├─────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');
    
    const displayMethod = (name, loan) => {
      const lastPmt = loan.repaymentSchedule[loan.repaymentSchedule.length - 1];
      console.log(`│ ${name.padEnd(19)} │ ${String(loan.monthlyPayment.toFixed(2)).padStart(12)} │ ${String(loan.totalInterest.toFixed(2)).padStart(12)} │ ${String(loan.totalAmount.toFixed(2)).padStart(12)} │ ${String(lastPmt.amount.toFixed(2)).padStart(12)} │`);
    };

    displayMethod('Reducing Balance', loans.reducing_balance);
    displayMethod('Simple Interest', loans.simple_interest);
    displayMethod('Flat Rate', loans.flat_rate);
    displayMethod('Interest Only', loans.interest_only);
    
    console.log('└─────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘\n');

    // Cost ranking
    console.log('📊 COST RANKING (Total Interest):');
    const ranked = Object.entries(loans)
      .map(([method, loan]) => ({ method, interest: loan.totalInterest }))
      .sort((a, b) => a.interest - b.interest);

    ranked.forEach((item, index) => {
      const savings = index > 0 ? (item.interest - ranked[0].interest).toFixed(2) : '0.00';
      console.log(`${index + 1}. ${item.method.replace('_', ' ').toUpperCase().padEnd(20)} - ZMW ${item.interest.toFixed(2).padStart(8)} ${savings > 0 ? `(+ZMW ${savings} vs cheapest)` : '(CHEAPEST)'}`);
    });

    console.log('\n');

    // Method details
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('METHOD DETAILS & USE CASES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('1️⃣  REDUCING BALANCE (Standard Amortizing Loan)');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('How it works:');
    console.log('  • Interest calculated on REMAINING principal each period');
    console.log('  • Principal portion increases, interest decreases over time');
    console.log('  • Equal monthly payments throughout');
    console.log('Use cases:');
    console.log('  ✓ Mortgages and home loans');
    console.log('  ✓ Auto loans');
    console.log('  ✓ Personal loans');
    console.log('  ✓ Business term loans');
    console.log('Advantages:');
    console.log('  ✓ Lowest total interest cost');
    console.log('  ✓ Builds equity faster');
    console.log('  ✓ Early payoff saves significant interest\n');

    console.log('2️⃣  SIMPLE INTEREST');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('How it works:');
    console.log('  • Interest calculated on ORIGINAL principal each period');
    console.log('  • Interest varies by actual days in month');
    console.log('  • Principal paid equally each period');
    console.log('Use cases:');
    console.log('  ✓ Short-term loans (< 1 year)');
    console.log('  ✓ Payday loans');
    console.log('  ✓ Trade credit');
    console.log('Advantages:');
    console.log('  ✓ Simpler calculation than reducing balance');
    console.log('  ✓ Mid-range cost');
    console.log('  ✓ Payment amounts vary slightly month-to-month\n');

    console.log('3️⃣  FLAT RATE');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('How it works:');
    console.log('  • Total interest calculated upfront on full principal');
    console.log('  • Interest + principal divided equally across all payments');
    console.log('  • Identical payment amounts (no variation)');
    console.log('Use cases:');
    console.log('  ✓ Microfinance loans');
    console.log('  ✓ Hire purchase agreements');
    console.log('  ✓ Some consumer credit');
    console.log('  ✓ Islamic finance alternatives');
    console.log('Advantages:');
    console.log('  ✓ Simplest to calculate and understand');
    console.log('  ✓ Predictable equal payments');
    console.log('  ✓ No benefit from early repayment\n');

    console.log('4️⃣  INTEREST-ONLY (Balloon Payment)');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('How it works:');
    console.log('  • Only interest paid during loan term');
    console.log('  • Full principal due as lump sum at maturity');
    console.log('  • Lower monthly payments, higher total cost');
    console.log('Use cases:');
    console.log('  ✓ Bridge loans');
    console.log('  ✓ Investment properties (rental income covers interest)');
    console.log('  ✓ Business development (expecting revenue growth)');
    console.log('  ✓ Refinancing scenarios');
    console.log('Advantages:');
    console.log('  ✓ Lowest monthly payment');
    console.log('  ✓ Preserves capital for other investments');
    console.log('  ✓ Cash flow management');
    console.log('Risks:');
    console.log('  ✗ Highest total interest cost');
    console.log('  ✗ Balloon payment risk (refinancing/sale required)');
    console.log('  ✗ No equity buildup\n');

    console.log('═══════════════════════════════════════════════════════════════\n');

    // Payment schedule samples
    console.log('📅 SAMPLE PAYMENT SCHEDULES (First 3 Months)\n');

    methods.forEach(method => {
      const loan = loans[method];
      console.log(`${method.replace('_', ' ').toUpperCase()}:`);
      loan.repaymentSchedule.slice(0, 3).forEach(installment => {
        console.log(`  Month ${installment.installmentNumber}: Principal: ZMW ${installment.principal.toFixed(2)} | Interest: ZMW ${installment.interest.toFixed(2)} | Total: ZMW ${installment.amount.toFixed(2)}`);
      });
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ Comparison completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

compareAllMethods();
