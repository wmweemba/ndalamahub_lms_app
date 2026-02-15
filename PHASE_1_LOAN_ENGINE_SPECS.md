## [x] Grace Period & Moratorium Logic
- Repayment schedule supports principal-only grace and full moratorium
- Schedule fields: isGrace, isMoratorium, graceType
- All logic covered by backend tests
# Phase 1: Loan Engine Enhancement - Technical Specifications
## NdalamaHub LMS - Detailed Implementation Guide

**Timeline**: 12 weeks @ 2 hours/day (168 hours total)  
**Budget**: $0 (self-implemented, bootstrapped approach)  
**Goal**: Transform basic loan calculations into enterprise-grade loan engine

---

## Overview

Current loan engine uses simplified calculations with fixed 30-day months and monthly interest rates. This Phase 1 upgrade implements production-grade calculations used by enterprise LMS platforms (Mambu, nCino, Temenos) while maintaining zero-cost, self-hosted approach.

**Priority Order**:
1. Daily Interest Accrual (Weeks 1-3)
2. Flat Rate Amortization (Weeks 4-5)
3. Bi-Weekly Repayment Schedules (Weeks 6-7)
4. Loan Product Configuration (Weeks 8-10)
5. Prepayment Handling (Weeks 11-12)

---

## Current State Analysis

### Existing Code (server/models/Loan.js)

```javascript
// Current calculation (lines 337-358)
loanSchema.methods.calculateLoanDetails = function() {
  const principal = this.amount;
  const rate = this.interestRate / 100 / 12; // ❌ Monthly rate approximation
  const term = this.term;
  
  if (rate === 0) {
    this.monthlyPayment = principal / term;
    this.totalInterest = 0;
  } else {
    // Standard amortization formula
    this.monthlyPayment = (principal * rate * Math.pow(1 + rate, term)) / 
                          (Math.pow(1 + rate, term) - 1);
    this.totalInterest = (this.monthlyPayment * term) - principal;
  }
  
  this.totalAmount = principal + this.totalInterest;
  this.generateRepaymentSchedule();
};

// Current schedule generation (lines 363-384)
loanSchema.methods.generateRepaymentSchedule = function() {
  const schedule = [];
  const monthlyPayment = this.monthlyPayment;
  let remainingPrincipal = this.amount;
  const monthlyRate = this.interestRate / 100 / 12;
  
  for (let i = 1; i <= this.term; i++) {
    const interest = remainingPrincipal * monthlyRate;
    const principal = monthlyPayment - interest;
    remainingPrincipal -= principal;
    
    schedule.push({
      installmentNumber: i,
      dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)), // ❌ Fixed 30 days
      amount: monthlyPayment,
      principal: Math.min(principal, remainingPrincipal + principal),
      interest: interest,
      status: 'pending'
    });
  }
  
  this.repaymentSchedule = schedule;
};
```

**Problems**:
1. ❌ Uses monthly interest rate (`rate / 12`) - less accurate than daily accrual
2. ❌ Fixed 30-day months - February has 28/29 days, other months have 31
3. ❌ No support for different interest calculation methods
4. ❌ No support for bi-weekly or weekly frequencies
5. ❌ Hardcoded amortization logic - not flexible for different loan products

---

## Feature 1: Daily Interest Accrual
**Priority**: 🔴 CRITICAL  
**Effort**: 20 days @ 2hr/day (40 hours)  
**Timeline**: Weeks 1-3

### Technical Requirements

**Objective**: Calculate interest based on actual days, not fixed months, using daily rate for precision.

**Interest Calculation Methods**:
```javascript
// Current (Monthly)
Interest = Principal × (Annual_Rate / 100 / 12)

// Target (Daily)
Interest = Principal × (Annual_Rate / 100 / 365) × Actual_Days
```

**Day Count Conventions**:
- **Actual/365**: Actual days in period / 365 (most common, will use this)
- **Actual/360**: Actual days in period / 360 (commercial banking)
- **30/360**: Assumes all months have 30 days (corporate bonds, rare in loans)

### Implementation Specifications

#### Step 1: Update Loan Model Schema (Week 1, Day 1-2, 4 hours)

**File**: `server/models/Loan.js`

Add new fields to schema:
```javascript
// After line 57 (after description field)
  
  // Interest calculation configuration
  interestCalculation: {
    method: {
      type: String,
      enum: ['reducing_balance', 'flat_rate', 'simple_interest', 'interest_only'],
      default: 'reducing_balance',
      required: true
    },
    accrualBasis: {
      type: String,
      enum: ['actual/365', 'actual/360', '30/360'],
      default: 'actual/365',
      required: true
    },
    accrualFrequency: {
      type: String,
      enum: ['daily', 'monthly'],
      default: 'daily',
      required: true
    }
  },
  
  // Repayment frequency
  repaymentFrequency: {
    type: String,
    enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly'],
    default: 'monthly',
    required: true
  },
```

#### Step 2: Create Interest Calculator Utility (Week 1, Day 3-5, 6 hours)

**New File**: `server/utils/interestCalculator.js`

```javascript
/**
 * Interest Calculator Utility
 * Provides accurate interest calculations using various methods and day count conventions
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
  
  // Adjust days to 30 if needed
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  
  return (360 * (y2 - y1)) + (30 * (m2 - m1)) + (d2 - d1);
}

/**
 * Calculate days in period based on accrual basis
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {String} accrualBasis 
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
 * @returns {Number} Days in month
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Add months to a date (handles end-of-month correctly)
 * @param {Date} date 
 * @param {Number} months 
 * @returns {Date} New date
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Add days to a date
 * @param {Date} date 
 * @param {Number} days 
 * @returns {Date} New date
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
  addDays
};
```

**Testing** (Week 1, Day 6-7, 4 hours):

Create test file: `server/utils/__tests__/interestCalculator.test.js`

```javascript
const {
  getDailyRate,
  getActualDays,
  getDaysInPeriod,
  calculatePeriodInterest,
  getDaysInMonth,
  addMonths
} = require('../interestCalculator');

describe('Interest Calculator', () => {
  describe('getDailyRate', () => {
    test('calculates daily rate for actual/365', () => {
      const dailyRate = getDailyRate(24, 'actual/365'); // 24% per annum
      expect(dailyRate).toBeCloseTo(0.00065753, 8); // 24/100/365
    });
    
    test('calculates daily rate for actual/360', () => {
      const dailyRate = getDailyRate(24, 'actual/360');
      expect(dailyRate).toBeCloseTo(0.00066667, 8); // 24/100/360
    });
  });
  
  describe('getActualDays', () => {
    test('calculates days between dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      expect(getActualDays(start, end)).toBe(30);
    });
    
    test('handles February correctly', () => {
      const start = new Date('2026-02-01');
      const end = new Date('2026-02-28');
      expect(getActualDays(start, end)).toBe(27);
    });
    
    test('handles leap year February', () => {
      const start = new Date('2024-02-01');
      const end = new Date('2024-02-29');
      expect(getActualDays(start, end)).toBe(28);
    });
  });
  
  describe('calculatePeriodInterest', () => {
    test('calculates interest for 30 days at 24% p.a.', () => {
      const principal = 10000;
      const rate = 24;
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const interest = calculatePeriodInterest(principal, rate, start, end, 'actual/365');
      // Expected: 10000 × (24/100/365) × 30 = 197.26
      expect(interest).toBeCloseTo(197.26, 2);
    });
    
    test('calculates interest for February (28 days)', () => {
      const principal = 10000;
      const rate = 24;
      const start = new Date('2026-02-01');
      const end = new Date('2026-02-28');
      
      const interest = calculatePeriodInterest(principal, rate, start, end, 'actual/365');
      // Expected: 10000 × (24/100/365) × 27 = 177.53
      expect(interest).toBeCloseTo(177.53, 2);
    });
  });
  
  describe('getDaysInMonth', () => {
    test('returns 31 for January', () => {
      expect(getDaysInMonth(2026, 0)).toBe(31);
    });
    
    test('returns 28 for February (non-leap year)', () => {
      expect(getDaysInMonth(2026, 1)).toBe(28);
    });
    
    test('returns 29 for February (leap year)', () => {
      expect(getDaysInMonth(2024, 1)).toBe(29);
    });
  });
});
```

Run tests:
```bash
cd server
npm install --save-dev jest
npx jest utils/__tests__/interestCalculator.test.js
```

#### Step 3: Update Loan Model to Use Daily Accrual (Week 2, Day 1-7, 14 hours)

**File**: `server/models/Loan.js`

Replace `calculateLoanDetails` method (around line 337):

```javascript
const { 
  calculateMonthlyPayment, 
  addMonths, 
  getDaysInMonth 
} = require('../utils/interestCalculator');

// Replace existing calculateLoanDetails method
loanSchema.methods.calculateLoanDetails = function() {
  const principal = this.amount;
  const annualRate = this.interestRate;
  const term = this.term;
  const method = this.interestCalculation?.method || 'reducing_balance';
  
  console.log(`Calculating loan details: method=${method}, amount=${principal}, rate=${annualRate}, term=${term}`);
  
  switch (method) {
    case 'reducing_balance':
      this.calculateReducingBalance();
      break;
    case 'flat_rate':
      this.calculateFlatRate();
      break;
    case 'simple_interest':
      this.calculateSimpleInterest();
      break;
    case 'interest_only':
      this.calculateInterestOnly();
      break;
    default:
      this.calculateReducingBalance();
  }
  
  this.totalAmount = principal + this.totalInterest;
  this.generateRepaymentSchedule();
};

// New method: Reducing Balance with daily accrual
loanSchema.methods.calculateReducingBalance = function() {
  const principal = this.amount;
  const annualRate = this.interestRate;
  const term = this.term;
  
  if (annualRate === 0) {
    this.monthlyPayment = principal / term;
    this.totalInterest = 0;
    return;
  }
  
  // Calculate monthly payment using standard amortization formula
  this.monthlyPayment = calculateMonthlyPayment(principal, annualRate, term);
  
  // Calculate total interest by summing actual period interest
  // (will be precise when generating schedule)
  this.totalInterest = (this.monthlyPayment * term) - principal;
};

// Keep existing flatRate and other methods (will implement in Feature 2)
loanSchema.methods.calculateFlatRate = function() {
  // To be implemented in Feature 2
  throw new Error('Flat rate method not yet implemented');
};

loanSchema.methods.calculateSimpleInterest = function() {
  // To be implemented later
  throw new Error('Simple interest method not yet implemented');
};

loanSchema.methods.calculateInterestOnly = function() {
  // To be implemented later
  throw new Error('Interest-only method not yet implemented');
};
```

Replace `generateRepaymentSchedule` method (around line 363):

```javascript
const { 
  calculatePeriodInterest, 
  addMonths, 
  getDaysInMonth,
  addDays
} = require('../utils/interestCalculator');

loanSchema.methods.generateRepaymentSchedule = function() {
  const schedule = [];
  const payment = this.monthlyPayment;
  let remainingPrincipal = this.amount;
  const annualRate = this.interestRate;
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  const frequency = this.repaymentFrequency || 'monthly';
  
  // Determine start date (disbursement date or application date)
  const startDate = this.disbursedAt || this.startDate || new Date();
  
  console.log(`Generating repayment schedule: frequency=${frequency}, startDate=${startDate}, term=${this.term}`);
  
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= this.term; i++) {
    let nextDate;
    
    // Calculate next due date based on frequency
    switch (frequency) {
      case 'weekly':
        nextDate = addDays(currentDate, 7);
        break;
      case 'bi_weekly':
        nextDate = addDays(currentDate, 14);
        break;
      case 'monthly':
        nextDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        nextDate = addMonths(currentDate, 3);
        break;
      default:
        nextDate = addMonths(currentDate, 1);
    }
    
    // Calculate interest for the actual period
    const periodInterest = calculatePeriodInterest(
      remainingPrincipal,
      annualRate,
      currentDate,
      nextDate,
      accrualBasis
    );
    
    // Principal = Payment - Interest
    let principalPayment = payment - periodInterest;
    
    // Handle final installment rounding
    if (i === this.term) {
      principalPayment = remainingPrincipal;
      // Recalculate final payment to ensure loan is fully paid
      const finalPayment = principalPayment + periodInterest;
      
      schedule.push({
        installmentNumber: i,
        dueDate: nextDate,
        amount: finalPayment,
        principal: principalPayment,
        interest: periodInterest,
        outstandingBalance: 0,
        status: 'pending',
        paidAmount: 0
      });
    } else {
      remainingPrincipal -= principalPayment;
      
      schedule.push({
        installmentNumber: i,
        dueDate: nextDate,
        amount: payment,
        principal: principalPayment,
        interest: periodInterest,
        outstandingBalance: remainingPrincipal,
        status: 'pending',
        paidAmount: 0
      });
    }
    
    currentDate = nextDate;
  }
  
  this.repaymentSchedule = schedule;
  
  // Recalculate total interest from schedule (more accurate)
  this.totalInterest = schedule.reduce((sum, installment) => sum + installment.interest, 0);
  
  console.log(`Schedule generated: ${schedule.length} installments, total interest: ${this.totalInterest}`);
};
```

#### Step 4: Update Loan Routes (Week 3, Day 1-3, 6 hours)

**File**: `server/routes/loans.js`

Update loan creation endpoint to accept new fields:

```javascript
// Around line 250 (POST /api/loans endpoint)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      amount,
      term,
      interestRate,
      purpose,
      description,
      monthlyIncome,
      collateral,
      interestCalculationMethod, // NEW
      accrualBasis,              // NEW
      repaymentFrequency         // NEW
    } = req.body;

    // ... existing validation ...

    const loanData = {
      applicant: req.user.id,
      company: req.user.company,
      lenderCompany: req.user.lenderCompany || req.user.company,
      amount: parseFloat(amount),
      term: parseInt(term),
      interestRate: parseFloat(interestRate),
      purpose,
      description,
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      collateral: collateral || undefined,
      
      // New fields
      interestCalculation: {
        method: interestCalculationMethod || 'reducing_balance',
        accrualBasis: accrualBasis || 'actual/365',
        accrualFrequency: 'daily'
      },
      repaymentFrequency: repaymentFrequency || 'monthly',
      
      status: 'pending_approval',
      applicationDate: new Date()
    };

    const loan = new Loan(loanData);
    await loan.save();

    // ... rest of endpoint ...
  } catch (error) {
    // ... error handling ...
  }
});
```

#### Step 5: Update Frontend Application Form (Week 3, Day 4-7, 8 hours)

**File**: `client/src/components/loans/LoanApplicationForm.jsx`

Add new form fields:

```jsx
// Around line 20, add to formData state
const [formData, setFormData] = useState({
  amount: '',
  term: '',
  interestRate: '',
  purpose: '',
  description: '',
  monthlyIncome: '',
  hasCollateral: false,
  collateralValue: '',
  collateralDescription: '',
  // NEW FIELDS
  interestCalculationMethod: 'reducing_balance',
  accrualBasis: 'actual/365',
  repaymentFrequency: 'monthly'
});

// Add after line 200 (in form JSX, after term field)
<div className="space-y-2">
  <Label htmlFor="repaymentFrequency">Repayment Frequency</Label>
  <select
    id="repaymentFrequency"
    name="repaymentFrequency"
    value={formData.repaymentFrequency}
    onChange={handleChange}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="monthly">Monthly</option>
    <option value="bi_weekly">Bi-Weekly (Every 2 weeks)</option>
    <option value="weekly">Weekly</option>
    <option value="quarterly">Quarterly</option>
  </select>
  <p className="text-sm text-gray-500">
    {formData.repaymentFrequency === 'monthly' && 'Standard monthly payments'}
    {formData.repaymentFrequency === 'bi_weekly' && '26 payments per year, aligned with paydays'}
    {formData.repaymentFrequency === 'weekly' && '52 payments per year'}
    {formData.repaymentFrequency === 'quarterly' && 'Payments every 3 months'}
  </p>
</div>

<div className="space-y-2">
  <Label htmlFor="interestCalculationMethod">Interest Calculation Method</Label>
  <select
    id="interestCalculationMethod"
    name="interestCalculationMethod"
    value={formData.interestCalculationMethod}
    onChange={handleChange}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="reducing_balance">Reducing Balance (Standard)</option>
    <option value="flat_rate">Flat Rate (Microfinance)</option>
  </select>
  <p className="text-sm text-gray-500">
    {formData.interestCalculationMethod === 'reducing_balance' && 
      'Interest calculated on outstanding balance (lower total interest)'}
    {formData.interestCalculationMethod === 'flat_rate' && 
      'Interest calculated on original amount (common in Zambia)'}
  </p>
</div>

{/* Advanced options - collapsible */}
<details className="border border-gray-200 rounded-md p-4">
  <summary className="cursor-pointer font-medium">Advanced Options</summary>
  <div className="mt-4 space-y-2">
    <Label htmlFor="accrualBasis">Interest Accrual Basis</Label>
    <select
      id="accrualBasis"
      name="accrualBasis"
      value={formData.accrualBasis}
      onChange={handleChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="actual/365">Actual/365 (Standard)</option>
      <option value="actual/360">Actual/360 (Commercial)</option>
      <option value="30/360">30/360 (Fixed months)</option>
    </select>
    <p className="text-sm text-gray-500">
      Determines how days are counted for interest calculation. Leave as default unless instructed otherwise.
    </p>
  </div>
</details>
```

#### Testing & Validation (Week 3, Day 7, 2 hours)

**Test Cases**:

1. **30-day month vs 31-day month**:
   - Create loan with start date Jan 1, 2026 (31 days)
   - Create identical loan with start date Feb 1, 2026 (28 days)
   - Compare interest amounts - should differ by ~3 days of interest

2. **Monthly vs Bi-Weekly comparison**:
   - ZMW 10,000 loan at 24% p.a., 12 months
   - Monthly: 12 payments
   - Bi-Weekly: 26 payments (should complete loan faster, save interest)

3. **Zero interest loan**:
   - Should work without errors
   - Payment = Principal / Term exactly

**Expected Results** (Manual calculation check):
```
Loan: ZMW 10,000
Rate: 24% p.a.
Term: 12 months
Method: Reducing Balance
Frequency: Monthly

Month 1 (Jan 1 - Jan 31, 30 days):
  Outstanding: 10,000
  Interest: 10,000 × (24/100/365) × 30 = 197.26
  Payment: 942.49 (from amortization formula)
  Principal: 942.49 - 197.26 = 745.23
  New Balance: 10,000 - 745.23 = 9,254.77

Month 2 (Feb 1 - Feb 28, 27 days):
  Outstanding: 9,254.77
  Interest: 9,254.77 × (24/100/365) × 27 = 164.36
  Payment: 942.49
  Principal: 942.49 - 164.36 = 778.13
  New Balance: 9,254.77 - 778.13 = 8,476.64

... and so on
```

---

## Feature 2: Flat Rate Amortization
**Priority**: 🔴 CRITICAL  
**Effort**: 12 days @ 2hr/day (24 hours)  
**Timeline**: Weeks 4-5

### Technical Requirements

**Objective**: Support flat rate interest calculation, common in Zambian microfinance and payroll loans.

**Flat Rate Formula**:
```javascript
Total Interest = Principal × Interest Rate × Term (in years)
Monthly Payment = (Principal + Total Interest) / Term (in months)

Example:
Principal: ZMW 10,000
Rate: 3% per month (36% p.a.)
Term: 12 months

Total Interest = 10,000 × 0.36 × 1 = 3,600
Monthly Payment = (10,000 + 3,600) / 12 = 1,133.33
```

**Key Difference from Reducing Balance**:
- Flat rate: Interest calculated on original principal, **not** on outstanding balance
- Results in higher effective interest rate (~2x)
- Simpler for customers to understand ("3% per month")
- Common in Zambia: payroll loans, microfinance, short-term loans

### Implementation Specifications

#### Step 1: Implement Flat Rate Calculation (Week 4, Day 1-4, 8 hours)

**File**: `server/models/Loan.js`

Update the `calculateFlatRate` method:

```javascript
loanSchema.methods.calculateFlatRate = function() {
  const principal = this.amount;
  const annualRate = this.interestRate;
  const termMonths = this.term;
  const termYears = termMonths / 12;
  
  console.log(`Calculating flat rate: principal=${principal}, rate=${annualRate}%, term=${termMonths} months`);
  
  if (annualRate === 0) {
    this.monthlyPayment = principal / termMonths;
    this.totalInterest = 0;
    return;
  }
  
  // Total interest = Principal × Rate × Time (in years)
  this.totalInterest = principal * (annualRate / 100) * termYears;
  
  // Monthly payment = (Principal + Total Interest) / Number of months
  this.monthlyPayment = (principal + this.totalInterest) / termMonths;
  
  console.log(`Flat rate calculation: totalInterest=${this.totalInterest}, monthlyPayment=${this.monthlyPayment}`);
};
```

Update `generateRepaymentSchedule` to handle flat rate:

```javascript
loanSchema.methods.generateRepaymentSchedule = function() {
  const method = this.interestCalculation?.method || 'reducing_balance';
  
  if (method === 'flat_rate') {
    return this.generateFlatRateSchedule();
  } else {
    return this.generateReducingBalanceSchedule();
  }
};

// Rename existing generateRepaymentSchedule to generateReducingBalanceSchedule
loanSchema.methods.generateReducingBalanceSchedule = function() {
  // ... existing code from Feature 1 ...
};

// New method for flat rate schedule
loanSchema.methods.generateFlatRateSchedule = function() {
  const schedule = [];
  const payment = this.monthlyPayment;
  const principal = this.amount;
  const totalInterest = this.totalInterest;
  const termMonths = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  
  // In flat rate, principal and interest are divided equally across installments
  const principalPerInstallment = principal / termMonths;
  const interestPerInstallment = totalInterest / termMonths;
  
  const startDate = this.disbursedAt || this.startDate || new Date();
  let currentDate = new Date(startDate);
  let remainingPrincipal = principal;
  
  console.log(`Generating flat rate schedule: ${termMonths} installments, payment=${payment}`);
  
  for (let i = 1; i <= termMonths; i++) {
    let nextDate;
    
    switch (frequency) {
      case 'weekly':
        nextDate = addDays(currentDate, 7);
        break;
      case 'bi_weekly':
        nextDate = addDays(currentDate, 14);
        break;
      case 'monthly':
        nextDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        nextDate = addMonths(currentDate, 3);
        break;
      default:
        nextDate = addMonths(currentDate, 1);
    }
    
    remainingPrincipal -= principalPerInstallment;
    
    schedule.push({
      installmentNumber: i,
      dueDate: nextDate,
      amount: payment,
      principal: principalPerInstallment,
      interest: interestPerInstallment,
      outstandingBalance: Math.max(0, remainingPrincipal),
      status: 'pending',
      paidAmount: 0
    });
    
    currentDate = nextDate;
  }
  
  this.repaymentSchedule = schedule;
  console.log(`Flat rate schedule generated: ${schedule.length} installments`);
};
```

#### Step 2: Create Comparison Calculator (Week 4, Day 5-7, 6 hours)

**New File**: `server/utils/loanComparison.js`

```javascript
/**
 * Loan Comparison Utility
 * Compare different loan calculation methods
 */

const Loan = require('../models/Loan');

/**
 * Calculate effective interest rate for flat rate loans
 * Converts flat rate to reducing balance equivalent
 * 
 * @param {Number} flatRate - Annual flat rate percentage
 * @returns {Number} Effective annual rate (reducing balance equivalent)
 */
function calculateEffectiveRate(flatRate) {
  // Approximation: Effective rate ≈ 2 × Flat rate (for 12-month loans)
  // More accurate calculation uses IRR
  return flatRate * 1.85; // Average multiplier
}

/**
 * Compare two loan calculation methods
 * @param {Object} loanParams - {amount, interestRate, term}
 * @returns {Object} Comparison results
 */
async function compareLoanMethods(loanParams) {
  const { amount, interestRate, term } = loanParams;
  
  // Create temporary loan objects (not saved to DB)
  const reducingBalanceLoan = new Loan({
    amount,
    interestRate,
    term,
    interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
    repaymentFrequency: 'monthly',
    company: null, // Temporary
    lenderCompany: null,
    applicant: null
  });
  
  const flatRateLoan = new Loan({
    amount,
    interestRate,
    term,
    interestCalculation: { method: 'flat_rate', accrualBasis: 'actual/365' },
    repaymentFrequency: 'monthly',
    company: null,
    lenderCompany: null,
    applicant: null
  });
  
  // Calculate both
  reducingBalanceLoan.calculateLoanDetails();
  flatRateLoan.calculateLoanDetails();
  
  return {
    reducingBalance: {
      monthlyPayment: reducingBalanceLoan.monthlyPayment,
      totalInterest: reducingBalanceLoan.totalInterest,
      totalAmount: reducingBalanceLoan.totalAmount
    },
    flatRate: {
      monthlyPayment: flatRateLoan.monthlyPayment,
      totalInterest: flatRateLoan.totalInterest,
      totalAmount: flatRateLoan.totalAmount,
      effectiveRate: calculateEffectiveRate(interestRate)
    },
    difference: {
      monthlyPayment: flatRateLoan.monthlyPayment - reducingBalanceLoan.monthlyPayment,
      totalInterest: flatRateLoan.totalInterest - reducingBalanceLoan.totalInterest,
      percentageHigher: ((flatRateLoan.totalInterest / reducingBalanceLoan.totalInterest - 1) * 100).toFixed(2)
    }
  };
}

module.exports = {
  calculateEffectiveRate,
  compareLoanMethods
};
```

#### Step 3: Add Comparison API Endpoint (Week 5, Day 1-3, 6 hours)

**File**: `server/routes/loans.js`

Add new endpoint:

```javascript
// @route   POST /api/loans/compare
// @desc    Compare loan calculation methods
// @access  Private
router.post('/compare', authenticateToken, async (req, res) => {
  try {
    const { amount, interestRate, term } = req.body;
    
    if (!amount || !interestRate || !term) {
      return res.status(400).json({
        success: false,
        message: 'Amount, interest rate, and term are required'
      });
    }
    
    const { compareLoanMethods } = require('../utils/loanComparison');
    
    const comparison = await compareLoanMethods({
      amount: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      term: parseInt(term)
    });
    
    res.json({
      success: true,
      data: comparison
    });
    
  } catch (error) {
    console.error('Loan comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare loan methods',
      error: error.message
    });
  }
});
```

#### Step 4: Update Frontend with Comparison Tool (Week 5, Day 4-7, 8 hours)

**File**: `client/src/components/loans/LoanApplicationForm.jsx`

Add comparison preview:

```jsx
// Add state for comparison
const [loanComparison, setLoanComparison] = useState(null);
const [showComparison, setShowComparison] = useState(false);

// Add function to fetch comparison
const fetchComparison = async () => {
  if (!formData.amount || !formData.interestRate || !formData.term) {
    return;
  }
  
  try {
    const response = await api.post('/loans/compare', {
      amount: formData.amount,
      interestRate: formData.interestRate,
      term: formData.term
    });
    
    if (response.data.success) {
      setLoanComparison(response.data.data);
      setShowComparison(true);
    }
  } catch (err) {
    console.error('Comparison fetch error:', err);
  }
};

// Add comparison display after interest calculation method dropdown
{showComparison && loanComparison && (
  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
    <h4 className="font-medium mb-3">Loan Method Comparison</h4>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="p-3 bg-white rounded border">
        <h5 className="font-medium text-sm mb-2">Reducing Balance</h5>
        <p className="text-sm">Monthly Payment: <span className="font-bold">ZMW {loanComparison.reducingBalance.monthlyPayment.toFixed(2)}</span></p>
        <p className="text-sm">Total Interest: <span className="font-bold">ZMW {loanComparison.reducingBalance.totalInterest.toFixed(2)}</span></p>
        <p className="text-sm">Total Repayment: <span className="font-bold">ZMW {loanComparison.reducingBalance.totalAmount.toFixed(2)}</span></p>
      </div>
      
      <div className="p-3 bg-white rounded border">
        <h5 className="font-medium text-sm mb-2">Flat Rate</h5>
        <p className="text-sm">Monthly Payment: <span className="font-bold">ZMW {loanComparison.flatRate.monthlyPayment.toFixed(2)}</span></p>
        <p className="text-sm">Total Interest: <span className="font-bold">ZMW {loanComparison.flatRate.totalInterest.toFixed(2)}</span></p>
        <p className="text-sm">Total Repayment: <span className="font-bold">ZMW {loanComparison.flatRate.totalAmount.toFixed(2)}</span></p>
        <p className="text-xs text-red-600 mt-1">
          Effective Rate: ~{loanComparison.flatRate.effectiveRate.toFixed(1)}% p.a.
        </p>
      </div>
    </div>
    
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
      <p className="text-sm">
        <strong>Difference:</strong> Flat rate costs 
        <span className="font-bold text-red-600"> ZMW {loanComparison.difference.totalInterest.toFixed(2)} more</span> in interest
        ({loanComparison.difference.percentageHigher}% higher)
      </p>
    </div>
    
    <button
      type="button"
      onClick={() => setShowComparison(false)}
      className="mt-2 text-sm text-blue-600 hover:underline"
    >
      Hide Comparison
    </button>
  </div>
)}

{!showComparison && formData.amount && formData.interestRate && formData.term && (
  <button
    type="button"
    onClick={fetchComparison}
    className="mt-2 text-sm text-blue-600 hover:underline"
  >
    Compare Loan Methods
  </button>
)}
```

#### Testing (Week 5, Day 7, 2 hours)

**Test Case**:
```
Amount: ZMW 10,000
Rate: 36% p.a. (3% per month - common flat rate)
Term: 12 months

Expected Flat Rate:
Total Interest = 10,000 × 0.36 × 1 = 3,600
Monthly Payment = 13,600 / 12 = 1,133.33

Expected Reducing Balance:
Monthly Payment ≈ 942.49
Total Interest ≈ 1,309.88

Difference: 3,600 - 1,309.88 = 2,290.12 (175% more expensive)
```

---

## Feature 3: Bi-Weekly Repayment Schedules
**Priority**: 🔴 CRITICAL  
**Effort**: 12 days @ 2hr/day (24 hours)  
**Timeline**: Weeks 6-7

### Technical Requirements

**Objective**: Support bi-weekly (every 14 days) payment schedules for payroll loans.

**Key Considerations**:
- Bi-weekly = 26 payments per year (not 24)
- Payment every 14 days = faster loan payoff
- Aligned with bi-weekly pay periods
- Requires exact date calculation (not month-based)

**Benefit**:
```
Monthly (12 months): 12 payments
Bi-Weekly (12 months): 26 payments = pays off loan in ~11 months
```

### Implementation Specifications

#### Step 1: Update Schedule Generation (Week 6, Day 1-5, 10 hours)

Already mostly implemented in Feature 1! Just need to enhance and test.

**File**: `server/models/Loan.js`

The `generateReducingBalanceSchedule` method already supports bi-weekly:

```javascript
// In generateReducingBalanceSchedule method
switch (frequency) {
  case 'weekly':
    nextDate = addDays(currentDate, 7);
    break;
  case 'bi_weekly':
    nextDate = addDays(currentDate, 14); // ✅ Already implemented
    break;
  case 'monthly':
    nextDate = addMonths(currentDate, 1);
    break;
  case 'quarterly':
    nextDate = addMonths(currentDate, 3);
    break;
}
```

**Enhancement needed**: Adjust term calculation for bi-weekly loans

Add helper method:

```javascript
/**
 * Calculate number of installments based on frequency
 * @returns {Number} Number of installments
 */
loanSchema.methods.getInstallmentCount = function() {
  const termMonths = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  
  switch (frequency) {
    case 'weekly':
      // 52 weeks per year
      return Math.ceil(termMonths * 52 / 12);
    case 'bi_weekly':
      // 26 bi-weekly periods per year
      return Math.ceil(termMonths * 26 / 12);
    case 'monthly':
      return termMonths;
    case 'quarterly':
      // 4 quarters per year
      return Math.ceil(termMonths / 3);
    default:
      return termMonths;
  }
};

/**
 * Calculate payment amount for different frequencies
 * Adjusts payment based on how often payments are made
 */
loanSchema.methods.calculatePaymentAmount = function() {
  const termMonths = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  const monthlyPayment = this.monthlyPayment;
  
  switch (frequency) {
    case 'weekly':
      // 4.33 weeks per month on average
      return monthlyPayment / 4.33;
    case 'bi_weekly':
      // 2.16 bi-weekly periods per month on average
      return monthlyPayment / 2.16;
    case 'monthly':
      return monthlyPayment;
    case 'quarterly':
      return monthlyPayment * 3;
    default:
      return monthlyPayment;
  }
};
```

Update `generateReducingBalanceSchedule` to use these helpers:

```javascript
loanSchema.methods.generateReducingBalanceSchedule = function() {
  const schedule = [];
  const installmentCount = this.getInstallmentCount();
  const paymentAmount = this.calculatePaymentAmount();
  let remainingPrincipal = this.amount;
  const annualRate = this.interestRate;
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  const frequency = this.repaymentFrequency || 'monthly';
  
  const startDate = this.disbursedAt || this.startDate || new Date();
  let currentDate = new Date(startDate);
  
  console.log(`Generating ${frequency} schedule: ${installmentCount} installments, payment=${paymentAmount}`);
  
  for (let i = 1; i <= installmentCount; i++) {
    let nextDate;
    
    switch (frequency) {
      case 'weekly':
        nextDate = addDays(currentDate, 7);
        break;
      case 'bi_weekly':
        nextDate = addDays(currentDate, 14);
        break;
      case 'monthly':
        nextDate = addMonths(currentDate, 1);
        break;
      case 'quarterly':
        nextDate = addMonths(currentDate, 3);
        break;
      default:
        nextDate = addMonths(currentDate, 1);
    }
    
    const periodInterest = calculatePeriodInterest(
      remainingPrincipal,
      annualRate,
      currentDate,
      nextDate,
      accrualBasis
    );
    
    let principalPayment = paymentAmount - periodInterest;
    
    // Handle final installment
    if (i === installmentCount || principalPayment > remainingPrincipal) {
      principalPayment = remainingPrincipal;
      const finalPayment = principalPayment + periodInterest;
      
      schedule.push({
        installmentNumber: i,
        dueDate: nextDate,
        amount: finalPayment,
        principal: principalPayment,
        interest: periodInterest,
        outstandingBalance: 0,
        status: 'pending',
        paidAmount: 0
      });
      
      break; // Loan fully paid
    } else {
      remainingPrincipal -= principalPayment;
      
      schedule.push({
        installmentNumber: i,
        dueDate: nextDate,
        amount: paymentAmount,
        principal: principalPayment,
        interest: periodInterest,
        outstandingBalance: remainingPrincipal,
        status: 'pending',
        paidAmount: 0
      });
    }
    
    currentDate = nextDate;
  }
  
  this.repaymentSchedule = schedule;
  this.totalInterest = schedule.reduce((sum, inst) => sum + inst.interest, 0);
  
  console.log(`Schedule generated: ${schedule.length} installments, total interest: ${this.totalInterest}`);
};
```

#### Step 2: Frontend Enhancement (Week 6, Day 6-7, Week 7, Day 1-2, 8 hours)

**File**: `client/src/components/loans/LoanApplicationForm.jsx`

Add payment amount calculation preview:

```jsx
// Add state
const [paymentPreview, setPaymentPreview] = useState(null);

// Add calculation function
const calculatePaymentPreview = () => {
  const amount = parseFloat(formData.amount);
  const rate = parseFloat(formData.interestRate) / 100 / 12;
  const term = parseInt(formData.term);
  const frequency = formData.repaymentFrequency;
  
  if (!amount || !rate || !term) return;
  
  // Calculate monthly payment (reducing balance)
  const monthlyPayment = (amount * rate * Math.pow(1 + rate, term)) / 
                        (Math.pow(1 + rate, term) - 1);
  
  let actualPayment = monthlyPayment;
  let numPayments = term;
  
  switch (frequency) {
    case 'weekly':
      actualPayment = monthlyPayment / 4.33;
      numPayments = Math.ceil(term * 52 / 12);
      break;
    case 'bi_weekly':
      actualPayment = monthlyPayment / 2.16;
      numPayments = Math.ceil(term * 26 / 12);
      break;
    case 'monthly':
      actualPayment = monthlyPayment;
      numPayments = term;
      break;
    case 'quarterly':
      actualPayment = monthlyPayment * 3;
      numPayments = Math.ceil(term / 3);
      break;
  }
  
  setPaymentPreview({
    paymentAmount: actualPayment.toFixed(2),
    numPayments: numPayments,
    frequency: frequency
  });
};

// Call on form change
useEffect(() => {
  calculatePaymentPreview();
}, [formData.amount, formData.interestRate, formData.term, formData.repaymentFrequency]);

// Display in form (after repayment frequency dropdown)
{paymentPreview && (
  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded">
    <p className="text-sm font-medium">Payment Preview</p>
    <p className="text-lg font-bold text-green-700">
      ZMW {paymentPreview.paymentAmount}
    </p>
    <p className="text-xs text-gray-600">
      {paymentPreview.numPayments} {paymentPreview.frequency} payments
    </p>
  </div>
)}
```

#### Step 3: Testing (Week 7, Day 3-7, 10 hours)

Create comprehensive test file:

**File**: `server/models/__tests__/loan.schedule.test.js`

```javascript
const mongoose = require('mongoose');
const Loan = require('../Loan');
const { addDays, addMonths } = require('../../utils/interestCalculator');

describe('Loan Repayment Schedules', () => {
  describe('Monthly Schedule', () => {
    test('generates 12 monthly installments', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'monthly',
        startDate: new Date('2026-01-01')
      });
      
      loan.calculateLoanDetails();
      
      expect(loan.repaymentSchedule.length).toBe(12);
      expect(loan.repaymentSchedule[0].dueDate.getMonth()).toBe(1); // February
      expect(loan.repaymentSchedule[11].dueDate.getMonth()).toBe(0); // January next year
    });
  });
  
  describe('Bi-Weekly Schedule', () => {
    test('generates 26 bi-weekly installments for 12-month loan', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'bi_weekly',
        startDate: new Date('2026-01-01')
      });
      
      loan.calculateLoanDetails();
      
      expect(loan.repaymentSchedule.length).toBeGreaterThanOrEqual(24);
      expect(loan.repaymentSchedule.length).toBeLessThanOrEqual(27);
    });
    
    test('payments are 14 days apart', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'bi_weekly',
        startDate: new Date('2026-01-01')
      });
      
      loan.calculateLoanDetails();
      
      const firstDue = loan.repaymentSchedule[0].dueDate;
      const secondDue = loan.repaymentSchedule[1].dueDate;
      
      const daysBetween = (secondDue - firstDue) / (1000 * 60 * 60 * 24);
      expect(daysBetween).toBe(14);
    });
    
    test('bi-weekly payment is lower than monthly', () => {
      const monthlyLoan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'monthly',
        startDate: new Date('2026-01-01')
      });
      
      const biWeeklyLoan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'bi_weekly',
        startDate: new Date('2026-01-01')
      });
      
      monthlyLoan.calculateLoanDetails();
      biWeeklyLoan.calculateLoanDetails();
      
      const monthlyPayment = monthlyLoan.repaymentSchedule[0].amount;
      const biWeeklyPayment = biWeeklyLoan.repaymentSchedule[0].amount;
      
      expect(biWeeklyPayment).toBeLessThan(monthlyPayment);
      expect(biWeeklyPayment).toBeCloseTo(monthlyPayment / 2.16, 0);
    });
  });
  
  describe('Weekly Schedule', () => {
    test('generates 52 weekly installments for 12-month loan', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 12,
        interestCalculation: { method: 'reducing_balance', accrualBasis: 'actual/365' },
        repaymentFrequency: 'weekly',
        startDate: new Date('2026-01-01')
      });
      
      loan.calculateLoanDetails();
      
      expect(loan.repaymentSchedule.length).toBeGreaterThanOrEqual(50);
      expect(loan.repaymentSchedule.length).toBeLessThanOrEqual(54);
    });
  });
});
```

Run tests:
```bash
cd server
npx jest models/__tests__/loan.schedule.test.js --verbose
```

---

## Feature 4: Loan Product Configuration
**Priority**: 🔴 CRITICAL  
**Effort**: 32 days @ 2hr/day (64 hours)  
**Timeline**: Weeks 8-10

### Technical Requirements

**Objective**: Create loan product catalog system where lenders can define product templates with:
- Product-specific terms (min/max amount, min/max term)
- Interest rates and calculation methods
- Fees
- Required documents
- Eligibility criteria
- Auto-approval rules

**Benefits**:
- Consistency across loans of same type
- Easy product configuration without code changes
- Support multiple loan products (payroll, SME, microfinance)
- Faster application processing

### Implementation Specifications

#### Step 1: Create LoanProduct Model (Week 8, Day 1-3, 6 hours)

**New File**: `server/models/LoanProduct.js`

```javascript
const mongoose = require('mongoose');

const loanProductSchema = new mongoose.Schema({
  // Multi-tenancy
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  
  // Basic product information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Product code is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Product code cannot exceed 20 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['payroll', 'personal', 'sme', 'microfinance', 'asset_finance', 'working_capital'],
    required: [true, 'Product category is required']
  },
  
  // Loan terms
  terms: {
    minAmount: {
      type: Number,
      required: [true, 'Minimum loan amount is required'],
      min: [0, 'Minimum amount cannot be negative']
    },
    maxAmount: {
      type: Number,
      required: [true, 'Maximum loan amount is required'],
      min: [0, 'Maximum amount cannot be negative']
    },
    minTerm: {
      type: Number,
      required: [true, 'Minimum term is required'],
      min: [1, 'Minimum term must be at least 1 month']
    },
    maxTerm: {
      type: Number,
      required: [true, 'Maximum term is required'],
      min: [1, 'Maximum term must be at least 1 month']
    },
    repaymentFrequency: {
      type: String,
      enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    }
  },
  
  // Interest configuration
  interest: {
    baseRate: {
      type: Number,
      required: [true, 'Base interest rate is required'],
      min: [0, 'Interest rate cannot be negative'],
      max: [100, 'Interest rate cannot exceed 100%']
    },
    calculationMethod: {
      type: String,
      enum: ['reducing_balance', 'flat_rate', 'simple_interest', 'interest_only'],
      default: 'reducing_balance'
    },
    accrualBasis: {
      type: String,
      enum: ['actual/365', 'actual/360', '30/360'],
      default: 'actual/365'
    },
    // Risk-based rate adjustments
    rateAdjustments: [{
      condition: {
        type: String, // 'credit_score', 'dti_ratio', 'loan_amount', 'term'
        operator: String, // '>=', '<=', '>', '<', '==', 'between'
        value: mongoose.Schema.Types.Mixed // Number or [min, max] for 'between'
      },
      adjustment: {
        type: Number, // Percentage points to add/subtract
        min: -10,
        max: 10
      }
    }]
  },
  
  // Fees
  fees: {
    processingFeePercent: {
      type: Number,
      default: 0,
      min: [0, 'Processing fee cannot be negative'],
      max: [10, 'Processing fee cannot exceed 10%']
    },
    processingFeeFixed: {
      type: Number,
      default: 0,
      min: [0, 'Processing fee cannot be negative']
    },
    disbursementFee: {
      type: Number,
      default: 0,
      min: [0, 'Disbursement fee cannot be negative']
    },
    latePaymentFeePercent: {
      type: Number,
      default: 0,
      min: [0, 'Late payment fee cannot be negative']
    },
    latePaymentFeeFixed: {
      type: Number,
      default: 0,
      min: [0, 'Late payment fee cannot be negative']
    },
    earlySettlementPenaltyPercent: {
      type: Number,
      default: 0,
      min: [0, 'Early settlement penalty cannot be negative'],
      max: [5, 'Early settlement penalty cannot exceed 5%']
    }
  },
  
  // Required documents
  requiredDocuments: [{
    type: {
      type: String,
      enum: [
        'national_id', 'passport', 'drivers_license',
        'payslip', 'employment_letter', 'bank_statement',
        'business_registration', 'tpin_certificate', 'financial_statements',
        'proof_of_residence', 'other'
      ],
      required: true
    },
    mandatory: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Eligibility criteria
  eligibility: {
    minMonthlyIncome: {
      type: Number,
      min: 0
    },
    maxDebtToIncome: {
      type: Number,
      min: 0,
      max: 1 // As ratio (0.4 = 40%)
    },
    minCreditScore: {
      type: Number,
      min: 0,
      max: 1000
    },
    minEmploymentMonths: {
      type: Number,
      min: 0
    },
    maxAge: {
      type: Number,
      min: 18,
      max: 100
    },
    minAge: {
      type: Number,
      min: 18,
      default: 18
    },
    requiresCollateral: {
      type: Boolean,
      default: false
    },
    requiresGuarantor: {
      type: Boolean,
      default: false
    }
  },
  
  // Auto-approval rules
  autoApproval: {
    enabled: {
      type: Boolean,
      default: false
    },
    maxAmount: {
      type: Number,
      min: 0
    },
    minCreditScore: {
      type: Number,
      min: 0
    },
    maxDtiRatio: {
      type: Number,
      min: 0,
      max: 1
    },
    additionalConditions: [{
      field: String, // 'employment_type', 'customer_type', etc.
      operator: String,
      value: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Display order
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
loanProductSchema.index({ company: 1, code: 1 }, { unique: true });
loanProductSchema.index({ company: 1, isActive: 1, displayOrder: 1 });
loanProductSchema.index({ category: 1, isActive: 1 });

// Validation: maxAmount must be greater than minAmount
loanProductSchema.pre('save', function(next) {
  if (this.terms.maxAmount <= this.terms.minAmount) {
    return next(new Error('Maximum amount must be greater than minimum amount'));
  }
  if (this.terms.maxTerm <= this.terms.minTerm) {
    return next(new Error('Maximum term must be greater than minimum term'));
  }
  next();
});

// Method to check if loan application meets product criteria
loanProductSchema.methods.validateLoanApplication = function(loanData) {
  const errors = [];
  
  // Amount validation
  if (loanData.amount < this.terms.minAmount) {
    errors.push(`Loan amount must be at least ZMW ${this.terms.minAmount.toLocaleString()}`);
  }
  if (loanData.amount > this.terms.maxAmount) {
    errors.push(`Loan amount cannot exceed ZMW ${this.terms.maxAmount.toLocaleString()}`);
  }
  
  // Term validation
  if (loanData.term < this.terms.minTerm) {
    errors.push(`Loan term must be at least ${this.terms.minTerm} months`);
  }
  if (loanData.term > this.terms.maxTerm) {
    errors.push(`Loan term cannot exceed ${this.terms.maxTerm} months`);
  }
  
  // Eligibility validation
  if (this.eligibility.minMonthlyIncome && loanData.monthlyIncome < this.eligibility.minMonthlyIncome) {
    errors.push(`Minimum monthly income of ZMW ${this.eligibility.minMonthlyIncome.toLocaleString()} required`);
  }
  
  if (this.eligibility.minCreditScore && loanData.creditScore < this.eligibility.minCreditScore) {
    errors.push(`Minimum credit score of ${this.eligibility.minCreditScore} required`);
  }
  
  if (this.eligibility.maxDebtToIncome && loanData.dtiRatio > this.eligibility.maxDebtToIncome) {
    errors.push(`Debt-to-income ratio cannot exceed ${(this.eligibility.maxDebtToIncome * 100).toFixed(0)}%`);
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Method to calculate interest rate with adjustments
loanProductSchema.methods.calculateAdjustedRate = function(loanData) {
  let rate = this.interest.baseRate;
  
  if (!this.interest.rateAdjustments || this.interest.rateAdjustments.length === 0) {
    return rate;
  }
  
  for (const adjustment of this.interest.rateAdjustments) {
    const { condition, adjustment: rateChange } = adjustment;
    let applies = false;
    
    const value = loanData[condition.type];
    if (value === undefined) continue;
    
    switch (condition.operator) {
      case '>=':
        applies = value >= condition.value;
        break;
      case '<=':
        applies = value <= condition.value;
        break;
      case '>':
        applies = value > condition.value;
        break;
      case '<':
        applies = value < condition.value;
        break;
      case '==':
        applies = value === condition.value;
        break;
      case 'between':
        applies = value >= condition.value[0] && value <= condition.value[1];
        break;
    }
    
    if (applies) {
      rate += rateChange;
    }
  }
  
  return Math.max(0, rate); // Ensure rate doesn't go negative
};

// Method to check if loan qualifies for auto-approval
loanProductSchema.methods.canAutoApprove = function(loanData) {
  if (!this.autoApproval.enabled) {
    return false;
  }
  
  if (this.autoApproval.maxAmount && loanData.amount > this.autoApproval.maxAmount) {
    return false;
  }
  
  if (this.autoApproval.minCreditScore && loanData.creditScore < this.autoApproval.minCreditScore) {
    return false;
  }
  
  if (this.autoApproval.maxDtiRatio && loanData.dtiRatio > this.autoApproval.maxDtiRatio) {
    return false;
  }
  
  // Check additional conditions
  if (this.autoApproval.additionalConditions) {
    for (const condition of this.autoApproval.additionalConditions) {
      const value = loanData[condition.field];
      // Simplified condition check
      if (value !== condition.value) {
        return false;
      }
    }
  }
  
  return true;
};

module.exports = mongoose.model('LoanProduct', loanProductSchema);
```

#### Step 2: Update Loan Model (Week 8, Day 4-7, 8 hours)

**File**: `server/models/Loan.js`

Add loanProduct reference:

```javascript
// After line 27 (after lenderCompany field)
  loanProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanProduct'
  },
```

Update pre-save hook to use product settings:

```javascript
// In pre-save hook (after line 320)
loanSchema.pre('save', async function(next) {
  console.log('Loan pre-save hook triggered for:', this._id, this.amount, this.term);
  
  // If loan product is specified, validate against product rules
  if (this.loanProduct && this.isNew) {
    try {
      const LoanProduct = mongoose.model('LoanProduct');
      const product = await LoanProduct.findById(this.loanProduct);
      
      if (!product) {
        return next(new Error('Invalid loan product'));
      }
      
      if (!product.isActive) {
        return next(new Error('Loan product is not active'));
      }
      
      // Validate loan application against product rules
      const validation = product.validateLoanApplication({
        amount: this.amount,
        term: this.term,
        monthlyIncome: this.monthlyIncome,
        creditScore: this.riskAssessment?.score,
        dtiRatio: this.affordabilityAnalysis?.dtiRatio
      });
      
      if (!validation.isValid) {
        return next(new Error(`Loan validation failed: ${validation.errors.join(', ')}`));
      }
      
      // Apply product settings if not already set
      if (!this.interestRate) {
        this.interestRate = product.calculateAdjustedRate({
          creditScore: this.riskAssessment?.score,
          dtiRatio: this.affordabilityAnalysis?.dtiRatio,
          amount: this.amount,
          term: this.term
        });
      }
      
      if (!this.interestCalculation) {
        this.interestCalculation = {
          method: product.interest.calculationMethod,
          accrualBasis: product.interest.accrualBasis,
          accrualFrequency: 'daily'
        };
      }
      
      if (!this.repaymentFrequency) {
        this.repaymentFrequency = product.terms.repaymentFrequency;
      }
      
    } catch (error) {
      console.error('Loan product validation error:', error);
      return next(error);
    }
  }
  
  // ... rest of pre-save hook ...
  next();
});
```

#### Step 3: Create Loan Product Routes (Week 9, Day 1-7, 14 hours)

**New File**: `server/routes/loanProducts.js`

```javascript
const express = require('express');
const router = express.Router();
const LoanProduct = require('../models/LoanProduct');
const { authenticateToken, authorize } = require('../middleware/auth');

// @route   GET /api/loan-products
// @desc    Get all loan products for company
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { activeOnly = 'true', category } = req.query;
    
    const filter = { company: req.user.company };
    
    if (activeOnly === 'true') {
      filter.isActive = true;
    }
    
    if (category) {
      filter.category = category;
    }
    
    const products = await LoanProduct.find(filter).sort({ displayOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: { products }
    });
    
  } catch (error) {
    console.error('Get loan products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loan products',
      error: error.message
    });
  }
});

// @route   GET /api/loan-products/:id
// @desc    Get loan product by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await LoanProduct.findOne({
      _id: req.params.id,
      company: req.user.company
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Loan product not found'
      });
    }
    
    res.json({
      success: true,
      data: { product }
    });
    
  } catch (error) {
    console.error('Get loan product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get loan product',
      error: error.message
    });
  }
});

// @route   POST /api/loan-products
// @desc    Create new loan product
// @access  Private (Admin only)
router.post('/', authenticateToken, authorize(['super_user', 'lender_admin', 'corporate_admin']), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      company: req.user.company
    };
    
    const product = new LoanProduct(productData);
    await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Loan product created successfully',
      data: { product }
    });
    
  } catch (error) {
    console.error('Create loan product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan product',
      error: error.message
    });
  }
});

// @route   PUT /api/loan-products/:id
// @desc    Update loan product
// @access  Private (Admin only)
router.put('/:id', authenticateToken, authorize(['super_user', 'lender_admin', 'corporate_admin']), async (req, res) => {
  try {
    const product = await LoanProduct.findOne({
      _id: req.params.id,
      company: req.user.company
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Loan product not found'
      });
    }
    
    // Update fields
    Object.assign(product, req.body);
    await product.save();
    
    res.json({
      success: true,
      message: 'Loan product updated successfully',
      data: { product }
    });
    
  } catch (error) {
    console.error('Update loan product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update loan product',
      error: error.message
    });
  }
});

// @route   DELETE /api/loan-products/:id
// @desc    Delete (deactivate) loan product
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, authorize(['super_user', 'lender_admin', 'corporate_admin']), async (req, res) => {
  try {
    const product = await LoanProduct.findOne({
      _id: req.params.id,
      company: req.user.company
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Loan product not found'
      });
    }
    
    // Soft delete - deactivate instead of removing
    product.isActive = false;
    await product.save();
    
    res.json({
      success: true,
      message: 'Loan product deactivated successfully'
    });
    
  } catch (error) {
    console.error('Delete loan product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete loan product',
      error: error.message
    });
  }
});

module.exports = router;
```

Register routes in `server/server.js`:

```javascript
// Add after other route imports
const loanProductRoutes = require('./routes/loanProducts');

// Add after other route registrations
app.use('/api/loan-products', loanProductRoutes);
```

#### Step 4: Update Loan Application to Use Products (Week 10, Day 1-7, 14 hours)

**File**: `client/src/components/loans/LoanApplicationForm.jsx`

Add product selection:

```jsx
// Add state for products
const [loanProducts, setLoanProducts] = useState([]);
const [selectedProduct, setSelectedProduct] = useState(null);

// Fetch loan products on mount
useEffect(() => {
  if (open) {
    fetchLoanProducts();
    fetchCurrentUser();
    resetForm();
  }
}, [open]);

const fetchLoanProducts = async () => {
  try {
    const response = await api.get('/loan-products?activeOnly=true');
    if (response.data.success) {
      setLoanProducts(response.data.data.products);
    }
  } catch (err) {
    console.error('Failed to fetch loan products:', err);
  }
};

const handleProductSelect = (productId) => {
  const product = loanProducts.find(p => p._id === productId);
  setSelectedProduct(product);
  
  if (product) {
    // Auto-populate fields from product
    setFormData(prev => ({
      ...prev,
      loanProduct: productId,
      interestRate: product.interest.baseRate,
      interestCalculationMethod: product.interest.calculationMethod,
      accrualBasis: product.interest.accrualBasis,
      repaymentFrequency: product.terms.repaymentFrequency
    }));
  }
};

// Add to form JSX (at the top, before amount field)
<div className="space-y-2">
  <Label htmlFor="loanProduct">Loan Product *</Label>
  <select
    id="loanProduct"
    name="loanProduct"
    value={formData.loanProduct || ''}
    onChange={(e) => handleProductSelect(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    required
  >
    <option value="">Select a loan product</option>
    {loanProducts.map(product => (
      <option key={product._id} value={product._id}>
        {product.name} ({product.category})
      </option>
    ))}
  </select>
  {selectedProduct && (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
      <p className="font-medium">{selectedProduct.name}</p>
      <p className="text-gray-600">{selectedProduct.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <span className="font-medium">Amount:</span> ZMW {selectedProduct.terms.minAmount.toLocaleString()} - {selectedProduct.terms.maxAmount.toLocaleString()}
        </div>
        <div>
          <span className="font-medium">Term:</span> {selectedProduct.terms.minTerm} - {selectedProduct.terms.maxTerm} months
        </div>
        <div>
          <span className="font-medium">Rate:</span> {selectedProduct.interest.baseRate}% p.a.
        </div>
        <div>
          <span className="font-medium">Method:</span> {selectedProduct.interest.calculationMethod.replace('_', ' ')}
        </div>
      </div>
    </div>
  )}
</div>

// Update amount field validation
<div className="space-y-2">
  <Label htmlFor="amount">
    Loan Amount (ZMW) *
    {selectedProduct && (
      <span className="text-sm text-gray-500 ml-2">
        ({selectedProduct.terms.minAmount.toLocaleString()} - {selectedProduct.terms.maxAmount.toLocaleString()})
      </span>
    )}
  </Label>
  <Input
    id="amount"
    name="amount"
    type="number"
    value={formData.amount}
    onChange={handleChange}
    min={selectedProduct?.terms.minAmount || 0}
    max={selectedProduct?.terms.maxAmount || 1000000}
    required
  />
</div>

// Similar for term field
<div className="space-y-2">
  <Label htmlFor="term">
    Loan Term (months) *
    {selectedProduct && (
      <span className="text-sm text-gray-500 ml-2">
        ({selectedProduct.terms.minTerm} - {selectedProduct.terms.maxTerm})
      </span>
    )}
  </Label>
  <Input
    id="term"
    name="term"
    type="number"
    value={formData.term}
    onChange={handleChange}
    min={selectedProduct?.terms.minTerm || 1}
    max={selectedProduct?.terms.maxTerm || 60}
    required
  />
</div>
```

---

## Feature 5: Prepayment Handling
**Priority**: 🟡 HIGH  
**Effort**: 12 days @ 2hr/day (24 hours)  
**Timeline**: Weeks 11-12

### Technical Requirements

**Objective**: Allow customers to make extra payments (prepayments) to reduce loan principal and save on interest.

**Prepayment Options**:
1. **Reduce Term**: Keep monthly payment same, shorten loan duration
2. **Reduce Payment**: Keep loan duration, lower monthly payment
3. **Lump Sum**: Extra payment applied to principal

### Implementation (Simplified for Bootstrap)

#### Week 11-12: Basic Prepayment Recording (24 hours)

Add prepayment endpoint to `server/routes/loans.js`:

```javascript
// @route   POST /api/loans/:id/prepayment
// @desc    Record prepayment (extra payment towards principal)
// @access  Private (Lender Admin)
router.post('/:id/prepayment', authenticateToken, authorize('lender_admin'), async (req, res) => {
  try {
    const { amount, recalculateOption } = req.body; // 'reduce_term' or 'reduce_payment'
    
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    
    if (loan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Can only prepay active loans' });
    }
    
    // Apply prepayment to outstanding principal
    const paidSoFar = loan.paymentTracking?.totalPaid || 0;
    const outstandingPrincipal = loan.amount - paidSoFar;
    
    if (amount > outstandingPrincipal) {
      return res.status(400).json({ 
        success: false, 
        message: `Prepayment amount (ZMW ${amount}) exceeds outstanding principal (ZMW ${outstandingPrincipal})` 
      });
    }
    
    // Record prepayment
    loan.prepayments = loan.prepayments || [];
    loan.prepayments.push({
      amount: amount,
      paidAt: new Date(),
      paidBy: req.user.id,
      recalculateOption: recalculateOption || 'reduce_term'
    });
    
    // Recalculate schedule
    loan.amount -= amount; // Reduce principal
    loan.calculateLoanDetails(); // Regenerate schedule
    
    await loan.save();
    
    res.json({
      success: true,
      message: 'Prepayment recorded successfully',
      data: { loan }
    });
    
  } catch (error) {
    console.error('Prepayment error:', error);
    res.status(500).json({ success: false, message: 'Failed to record prepayment', error: error.message });
  }
});
```

Add prepayments field to Loan schema:

```javascript
// In Loan.js schema
prepayments: [{
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recalculateOption: { type: String, enum: ['reduce_term', 'reduce_payment'] }
}]
```

---

## Timeline Summary (12 Weeks @ 2 Hours/Day)

| Week | Feature | Deliverable | Hours |
|------|---------|-------------|-------|
| 1 | Daily Interest Accrual - Setup | Interest calculator utility + tests | 10 |
| 2 | Daily Interest Accrual - Integration | Updated Loan model, schedule generation | 14 |
| 3 | Daily Interest Accrual - Frontend | Updated forms, testing | 14 |
| 4 | Flat Rate Method - Backend | Flat rate calculation + schedule | 14 |
| 5 | Flat Rate Method - Frontend | Comparison tool, UI | 14 |
| 6 | Bi-Weekly Schedules - Backend | Schedule generation for all frequencies | 14 |
| 7 | Bi-Weekly Schedules - Testing | Comprehensive tests, frontend preview | 14 |
| 8 | Loan Products - Model | LoanProduct model + validation | 14 |
| 9 | Loan Products - API | Routes for CRUD operations | 14 |
| 10 | Loan Products - Frontend | Product selection in application form | 14 |
| 11-12 | Prepayment Handling | Prepayment recording + recalculation | 24 |
| **TOTAL** | | **All Features** | **168 hrs** |

---

## Testing Strategy

### Unit Tests (Throughout Development)
- Interest calculator functions
- Loan calculation methods
- Schedule generation logic
- Product validation rules

### Integration Tests (Weeks 3, 5, 7, 10, 12)
- Complete loan application flow
- API endpoints
- Database operations

### Manual Testing (End of Each Feature)
- UI/UX testing
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness

### Test Coverage Target: 70%+

---

## Success Criteria

**Phase 1 Complete When**:
1. ✅ Daily interest accrual working correctly (tested with various months)
2. ✅ Flat rate loans calculate properly (compared to manual calculations)
3. ✅ Bi-weekly schedules generate 26 payments for 12-month loans
4. ✅ Loan products can be created and used in applications
5. ✅ Prepayments reduce outstanding balance correctly
6. ✅ All tests passing (70%+ coverage)
7. ✅ Documentation updated (copilot instructions, API docs)
8. ✅ No regressions in existing functionality

---

## Budget Constraints Adherence

**Zero External Costs**:
- ✅ No paid APIs or services required
- ✅ All calculations done in-house
- ✅ Tests run locally
- ✅ No cloud storage needed yet
- ✅ Development tools: free (VS Code, Node.js, MongoDB)

**Time Optimization**:
- 2 hours/day = sustainable pace
- 168 hours total = achievable in 12 weeks
- Focus on core functionality, defer nice-to-haves

---

## After Phase 1: Next Priorities

**Phase 2 Features** (If continuing):
1. SMS notifications (Week 13-14)
2. Document verification workflow (Week 15-16)
3. Portfolio aging reports (Week 17-18)
4. Flutterwave payment integration (Week 19-20)
5. Credit bureau integration (Week 21-24)

**Estimated Timeline**: Additional 12 weeks (24 weeks total from start)

---

## Support & Resources

**Learning Resources**:
- Loan amortization: https://en.wikipedia.org/wiki/Amortization_calculator
- Day count conventions: https://en.wikipedia.org/wiki/Day_count_convention
- Interest calculations: https://www.investopedia.com/mortgage/mortgage-rates/payment-structure/

**Documentation to Update**:
- `.github/copilot-instructions.md` - Add loan engine patterns
- API documentation - Document new endpoints
- User guide - Explain new features to customers

**Questions/Blockers?**
- Create GitHub issues for tracking
- Document decisions in changelog.md
- Ask for clarification when needed

---

**Ready to start Week 1? Let's build an enterprise-grade loan engine! 🚀**
