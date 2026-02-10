/**
 * Interest Calculator Utility
 * Provides accurate interest calculations using various methods and day count conventions
 * 
 * Week 1, Day 2 - Phase 0: Loan Engine Enhancement
 */

/**
 * Calculate daily interest rate
 * @param {Number} annualRate - Annual interest rate percentage (e.g., 24 for 24%)
 * @param {String} accrualBasis - Day count convention ('actual/365', 'actual/360', '30/360')
 * @returns {Number} Daily interest rate as decimal
 */
function getDailyRate(annualRate, accrualBasis = 'actual/365') {
  const rate = annualRate / 100; // Convert percentage to decimal
  
  switch (accrualBasis) {
    case 'actual/365':
      return rate / 365;
    case 'actual/360':
      return rate / 360;
    case '30/360':
      return rate / 360; // 30/360 assumes 360-day year
    default:
      return rate / 365;
  }
}

/**
 * Calculate actual days between two dates
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Number} Number of days
 */
function getActualDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days in period using 30/360 convention
 * 30/360 assumes each month has 30 days and a year has 360 days
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Number} Number of days (30/360 basis)
 */
function get30_360Days(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let d1 = start.getDate();
  let m1 = start.getMonth() + 1;
  let y1 = start.getFullYear();
  
  let d2 = end.getDate();
  let m2 = end.getMonth() + 1;
  let y2 = end.getFullYear();
  
  // Adjust days to 30 if needed (30/360 convention)
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  
  return (360 * (y2 - y1)) + (30 * (m2 - m1)) + (d2 - d1);
}

/**
 * Calculate days in period based on accrual basis
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {String} accrualBasis - 'actual/365', 'actual/360', or '30/360'
 * @returns {Number} Number of days
 */
function getDaysInPeriod(startDate, endDate, accrualBasis = 'actual/365') {
  if (accrualBasis === '30/360') {
    return get30_360Days(startDate, endDate);
  } else {
    return getActualDays(startDate, endDate);
  }
}

/**
 * Calculate interest for a period
 * @param {Number} principal - Outstanding principal amount
 * @param {Number} annualRate - Annual interest rate percentage
 * @param {Date} startDate - Period start date
 * @param {Date} endDate - Period end date
 * @param {String} accrualBasis - Day count convention
 * @returns {Number} Interest amount for the period
 */
function calculatePeriodInterest(principal, annualRate, startDate, endDate, accrualBasis = 'actual/365') {
  const dailyRate = getDailyRate(annualRate, accrualBasis);
  const days = getDaysInPeriod(startDate, endDate, accrualBasis);
  
  return principal * dailyRate * days;
}

/**
 * Calculate monthly payment for reducing balance loan
 * Uses standard amortization formula
 * @param {Number} principal - Loan amount
 * @param {Number} annualRate - Annual interest rate percentage
 * @param {Number} term - Loan term in months
 * @returns {Number} Monthly payment amount
 */
function calculateMonthlyPayment(principal, annualRate, term) {
  if (annualRate === 0) {
    return principal / term;
  }
  
  const monthlyRate = annualRate / 100 / 12;
  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                  (Math.pow(1 + monthlyRate, term) - 1);
  
  return payment;
}

/**
 * Get actual days in a specific month
 * @param {Number} year 
 * @param {Number} month - 0-indexed (0 = January, 11 = December)
 * @returns {Number} Days in month (28-31)
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Add months to a date (handles end-of-month correctly)
 * @param {Date} date - Starting date
 * @param {Number} months - Number of months to add
 * @returns {Date} New date
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Add days to a date
 * @param {Date} date - Starting date
 * @param {Number} days - Number of days to add
 * @returns {Date} New date
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add weeks to a date
 * @param {Date} date - Starting date
 * @param {Number} weeks - Number of weeks to add
 * @returns {Date} New date
 */
function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

/**
 * Get the number of periods per year for a given frequency
 * @param {String} frequency - 'weekly', 'bi_weekly', 'monthly', 'quarterly'
 * @returns {Number} Number of periods per year
 */
function getPeriodsPerYear(frequency) {
  const periods = {
    'weekly': 52,
    'bi_weekly': 26,
    'monthly': 12,
    'quarterly': 4
  };
  return periods[frequency] || 12;
}

/**
 * Calculate the next payment date based on frequency
 * @param {Date} currentDate - Current payment date
 * @param {String} frequency - Payment frequency
 * @returns {Date} Next payment date
 */
function getNextPaymentDate(currentDate, frequency) {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      return addWeeks(date, 1);
    case 'bi_weekly':
      return addWeeks(date, 2);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addMonths(date, 3);
    default:
      return addMonths(date, 1);
  }
}

/**
 * Calculate total interest for flat rate method
 * Flat rate: Interest = Principal × Rate × Time (years)
 * @param {Number} principal - Loan amount
 * @param {Number} annualRate - Annual interest rate percentage
 * @param {Number} termMonths - Loan term in months
 * @returns {Number} Total interest amount
 */
function calculateFlatRateInterest(principal, annualRate, termMonths) {
  const termYears = termMonths / 12;
  return principal * (annualRate / 100) * termYears;
}

/**
 * Calculate flat rate monthly payment
 * @param {Number} principal - Loan amount
 * @param {Number} annualRate - Annual interest rate percentage
 * @param {Number} termMonths - Loan term in months
 * @returns {Object} { monthlyPayment, totalInterest }
 */
function calculateFlatRatePayment(principal, annualRate, termMonths) {
  const totalInterest = calculateFlatRateInterest(principal, annualRate, termMonths);
  const monthlyPayment = (principal + totalInterest) / termMonths;
  
  return {
    monthlyPayment,
    totalInterest
  };
}

/**
 * Calculate simple interest for a period
 * Simple interest calculates interest on the original principal per period
 * Unlike flat rate which calculates total interest upfront, simple interest
 * calculates interest per period on the original principal
 * 
 * @param {Number} principal - Loan principal amount
 * @param {Number} annualRate - Annual interest rate as percentage
 * @param {Date} startDate - Period start date
 * @param {Date} endDate - Period end date
 * @param {String} accrualBasis - Day count convention (actual/365, actual/360, 30/360)
 * @returns {Number} Interest for the period
 */
function calculateSimpleInterest(principal, annualRate, startDate, endDate, accrualBasis = 'actual/365') {
  // Simple interest per period on original principal
  const days = accrualBasis === '30/360' 
    ? get30_360Days(startDate, endDate)
    : getActualDays(startDate, endDate);
  
  const daysInYear = accrualBasis === 'actual/360' ? 360 : 365;
  const dailyRate = annualRate / 100 / daysInYear;
  
  return principal * dailyRate * days;
}

/**
 * Calculate simple interest payment details
 * For simple interest loans, each payment consists of:
 * - Interest on original principal for the period
 * - Equal principal portion
 * 
 * @param {Number} principal - Loan principal amount
 * @param {Number} annualRate - Annual interest rate as percentage
 * @param {Number} term - Number of payment periods
 * @param {String} frequency - Payment frequency (weekly, bi_weekly, monthly, quarterly)
 * @param {String} accrualBasis - Day count convention
 * @returns {Object} Payment details { averagePayment, totalInterest, interestPerPeriod, principalPerPeriod }
 */
function calculateSimpleInterestPayment(principal, annualRate, term, frequency = 'monthly', accrualBasis = 'actual/365') {
  // Calculate average interest per period
  const daysInYear = accrualBasis === 'actual/360' ? 360 : 365;
  const dailyRate = annualRate / 100 / daysInYear;
  
  // For simplicity, assume average days per period
  let avgDaysPerPeriod;
  if (frequency === 'weekly') {
    avgDaysPerPeriod = 7;
  } else if (frequency === 'bi_weekly') {
    avgDaysPerPeriod = 14;
  } else if (frequency === 'monthly') {
    avgDaysPerPeriod = accrualBasis === '30/360' ? 30 : 365 / 12; // ~30.42 days
  } else if (frequency === 'quarterly') {
    avgDaysPerPeriod = accrualBasis === '30/360' ? 90 : 365 / 4; // ~91.25 days
  }
  
  const interestPerPeriod = principal * dailyRate * avgDaysPerPeriod;
  const principalPerPeriod = principal / term;
  const averagePayment = principalPerPeriod + interestPerPeriod;
  const totalInterest = interestPerPeriod * term;
  
  return {
    averagePayment,
    totalInterest,
    interestPerPeriod,
    principalPerPeriod
  };
}

module.exports = {
  getDailyRate,
  getActualDays,
  get30_360Days,
  getDaysInPeriod,
  calculatePeriodInterest,
  calculateMonthlyPayment,
  getDaysInMonth,
  addMonths,
  addDays,
  addWeeks,
  getPeriodsPerYear,
  getNextPaymentDate,
  calculateFlatRateInterest,
  calculateFlatRatePayment,
  calculateSimpleInterest,
  calculateSimpleInterestPayment
};
