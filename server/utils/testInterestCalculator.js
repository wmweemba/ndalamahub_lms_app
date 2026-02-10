/**
 * Manual Test Script for Interest Calculator
 * Demonstrates real-world calculations
 * Week 1, Day 2 - Phase 0: Loan Engine Enhancement
 */

const {
  getDailyRate,
  getActualDays,
  calculatePeriodInterest,
  getDaysInMonth,
  getNextPaymentDate
} = require('./interestCalculator');

console.log('='.repeat(60));
console.log('Interest Calculator - Manual Test');
console.log('='.repeat(60));
console.log('');

// Scenario 1: Compare interest calculations for different months
console.log('Scenario 1: Monthly Interest Comparison');
console.log('-'.repeat(60));
const principal = 50000; // ZMW 50,000 loan
const annualRate = 24; // 24% per annum

const months = [
  { name: 'January 2026', start: new Date('2026-01-01'), end: new Date('2026-01-31') },
  { name: 'February 2026', start: new Date('2026-02-01'), end: new Date('2026-02-28') },
  { name: 'March 2026', start: new Date('2026-03-01'), end: new Date('2026-03-31') }
];

console.log(`Loan Amount: ZMW ${principal.toLocaleString()}`);
console.log(`Interest Rate: ${annualRate}% per annum`);
console.log('');

months.forEach(month => {
  const days = getActualDays(month.start, month.end);
  const interest = calculatePeriodInterest(principal, annualRate, month.start, month.end, 'actual/365');
  const dailyRate = getDailyRate(annualRate, 'actual/365');
  
  console.log(`${month.name}:`);
  console.log(`  Days in period: ${days}`);
  console.log(`  Interest: ZMW ${interest.toFixed(2)}`);
  console.log(`  Daily rate: ${(dailyRate * 100).toFixed(6)}%`);
  console.log('');
});

// Scenario 2: Compare day count conventions
console.log('');
console.log('Scenario 2: Day Count Convention Comparison');
console.log('-'.repeat(60));

const loanAmount = 100000;
const rate = 18;
const start = new Date('2026-01-01');
const end = new Date('2026-12-31');

const conventions = ['actual/365', 'actual/360', '30/360'];

console.log(`Loan Amount: ZMW ${loanAmount.toLocaleString()}`);
console.log(`Interest Rate: ${rate}% per annum`);
console.log(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`);
console.log('');

conventions.forEach(convention => {
  const interest = calculatePeriodInterest(loanAmount, rate, start, end, convention);
  console.log(`${convention.padEnd(15)}: ZMW ${interest.toFixed(2)}`);
});

// Scenario 3: Payment frequency demonstration
console.log('');
console.log('');
console.log('Scenario 3: Payment Frequency Schedule');
console.log('-'.repeat(60));

const loanStart = new Date('2026-02-10');
const frequencies = ['monthly', 'bi_weekly', 'weekly'];

console.log(`Loan Start Date: ${loanStart.toLocaleDateString()}`);
console.log('');

frequencies.forEach(freq => {
  console.log(`${freq.toUpperCase().replace('_', '-')} payments:`);
  let currentDate = new Date(loanStart);
  
  for (let i = 1; i <= 5; i++) {
    currentDate = getNextPaymentDate(currentDate, freq);
    console.log(`  Payment ${i}: ${currentDate.toLocaleDateString()}`);
  }
  console.log('');
});

// Scenario 4: February vs Other Months Impact
console.log('');
console.log('Scenario 4: Interest Savings in February');
console.log('-'.repeat(60));

const testLoan = 75000;
const testRate = 30;

const jan = calculatePeriodInterest(testLoan, testRate, new Date('2026-01-01'), new Date('2026-01-31'), 'actual/365');
const feb = calculatePeriodInterest(testLoan, testRate, new Date('2026-02-01'), new Date('2026-02-28'), 'actual/365');
const mar = calculatePeriodInterest(testLoan, testRate, new Date('2026-03-01'), new Date('2026-03-31'), 'actual/365');

console.log(`Loan Amount: ZMW ${testLoan.toLocaleString()}`);
console.log(`Interest Rate: ${testRate}% per annum`);
console.log('');
console.log(`January (31 days):   ZMW ${jan.toFixed(2)}`);
console.log(`February (28 days):  ZMW ${feb.toFixed(2)}`);
console.log(`March (31 days):     ZMW ${mar.toFixed(2)}`);
console.log('');
console.log(`Savings in February vs January: ZMW ${(jan - feb).toFixed(2)}`);
console.log(`Savings in February vs March:   ZMW ${(mar - feb).toFixed(2)}`);

console.log('');
console.log('='.repeat(60));
console.log('✅ All calculations completed successfully!');
console.log('='.repeat(60));
