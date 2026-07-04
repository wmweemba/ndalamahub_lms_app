> **Status: live doc, scheduled for obsolescence.** Describes the loan engine *as originally built* — including behavior that is broken until Phase 01 executes (prepayment/settlement) and semantics that change in Phase 05 (annualized flat rate → configurable rate basis, application-date → disbursement-date schedule anchor, early-settlement bookkeeping). **Archive to `docs/archive/` (or rewrite) when Phase 05 completes.** Where this doc and the code disagree post-Phase-05, the code and `docs/05-loan-engine-rebuild.md` win.

### Grace Period & Moratorium Support (2026-02-15)
- Repayment schedule generation supports:
  - Principal-only grace period (interest-only installments)
  - Full moratorium (no payment installments)
- Schedule objects include:
  - isGrace (boolean)
  - isMoratorium (boolean)
  - graceType (string: principal_only, full_moratorium, none)
- All scenarios are covered by automated backend tests
# Loan Engine Enhancement Documentation

## Overview
The NdalamaHub Loan Management System has been enhanced with advanced interest calculation capabilities, replacing the simplified MVP calculations with enterprise-grade financial algorithms.

## Phase 0, Week 1: Daily Interest Accrual & Flat Rate Amortization

### Implementation Summary
**Duration**: 7 days (2 hours/day)  
**Status**: ✅ Completed  
**Tests**: 44/44 passing  

### Key Features

#### 1. Daily Interest Accrual (Days 1-3)
Replaced fixed 30-day month assumption with accurate date-based calculations.

**Benefits**:
- Interest now reflects actual days in month (28-31)
- February payments have correctly lower interest
- Bi-weekly and weekly payment schedules supported
- More accurate repayment schedules

**Example**: 
For a ZMW 50,000 loan at 24% APR:
- January (31 days): Higher interest
- February (28 days): ZMW 21.02 less interest
- March (31 days): Back to higher interest

#### 2. Day Count Conventions (Day 2)
Support for three industry-standard conventions:

**actual/365** (Default - International standard):
```javascript
Daily Rate = Annual Rate / 365
Interest = Principal × Daily Rate × Actual Days
```

**actual/360** (US markets):
```javascript
Daily Rate = Annual Rate / 360
Interest = Principal × Daily Rate × Actual Days
```

**30/360** (Bond market):
```javascript
// Assumes 30 days per month, 360 days per year
Days = ((Y2-Y1)×360) + ((M2-M1)×30) + (D2-D1)
Interest = Principal × (Annual Rate / 360) × Days
```

#### 3. Flat Rate Amortization (Days 4-5)
Added support for flat rate method popular in Zambian microfinance.

**Flat Rate Calculation**:
```javascript
Total Interest = Principal × Rate × (Months / 12)
Monthly Payment = (Principal + Total Interest) / Months
```

**Comparison** (ZMW 10,000 @ 24% for 6 months):

| Method | Monthly Payment | Total Interest | Cost Difference |
|--------|----------------|----------------|-----------------|
| Flat Rate | ZMW 1,866.67 | ZMW 1,200.00 | Base (68.65% higher) |
| Reducing Balance | ZMW 1,785.26 | ZMW 711.55 | ZMW 488.45 less |

**Key Difference**: Flat rate charges interest on the full principal throughout the entire term, while reducing balance charges interest only on the remaining balance.

#### 4. Payment Frequencies
Support for multiple repayment schedules:

- **Monthly**: Standard 30-day intervals
- **Bi-weekly**: Every 14 days
- **Weekly**: Every 7 days
- **Quarterly**: Every 3 months

### Schema Changes

#### Loan Model
```javascript
interestCalculation: {
  method: {
    type: String,
    enum: ['reducing_balance', 'flat_rate', 'simple_interest', 'interest_only'],
    default: 'reducing_balance'
  },
  accrualBasis: {
    type: String,
    enum: ['actual/365', 'actual/360', '30/360'],
    default: 'actual/365'
  },
  accrualFrequency: {
    type: String,
    enum: ['daily', 'monthly'],
    default: 'daily'
  }
},
repaymentFrequency: {
  type: String,
  enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly'],
  default: 'monthly'
}
```

### API Usage

#### Creating a Reducing Balance Loan
```javascript
const loan = new Loan({
  applicant: userId,
  company: companyId,
  amount: 50000,
  interestRate: 24,
  term: 12,
  repaymentFrequency: 'monthly',
  interestCalculation: {
    method: 'reducing_balance',
    accrualBasis: 'actual/365',
    accrualFrequency: 'daily'
  }
});

loan.calculateLoanDetails();
loan.generateRepaymentSchedule();
await loan.save();
```

#### Creating a Flat Rate Loan
```javascript
const loan = new Loan({
  applicant: userId,
  company: companyId,
  amount: 10000,
  interestRate: 24,
  term: 6,
  repaymentFrequency: 'monthly',
  interestCalculation: {
    method: 'flat_rate',
    accrualBasis: 'actual/365',
    accrualFrequency: 'daily'
  }
});

loan.calculateLoanDetails();
loan.generateRepaymentSchedule();
await loan.save();
```

### Utility Functions

#### Interest Calculator (`server/utils/interestCalculator.js`)

**getDailyRate(annualRate, accrualBasis)**
```javascript
// Convert annual rate to daily rate
const dailyRate = getDailyRate(24, 'actual/365');
// Returns: 0.06575342465753425
```

**calculatePeriodInterest(principal, annualRate, startDate, endDate, accrualBasis)**
```javascript
// Calculate interest for specific date range
const interest = calculatePeriodInterest(
  50000,
  24,
  new Date('2025-02-01'),
  new Date('2025-02-28'),
  'actual/365'
);
// Returns: 920.55 (for 27 actual days in February)
```

**getNextPaymentDate(currentDate, frequency)**
```javascript
// Get next payment date based on frequency
const nextDate = getNextPaymentDate(
  new Date('2025-01-15'),
  'bi_weekly'
);
// Returns: Date('2025-01-29')
```

**calculateFlatRatePayment(principal, annualRate, term)**
```javascript
// Calculate flat rate payment details
const result = calculateFlatRatePayment(10000, 24, 6);
// Returns: { totalInterest: 1200, monthlyPayment: 1866.67 }
```

### Testing

#### Test Coverage
- **Interest Calculator**: 30 tests
- **Loan Calculations**: 14 tests
- **Total**: 44 tests, all passing ✅

#### Running Tests
```bash
cd server
pnpm test                      # Run all tests
pnpm test interestCalculator  # Run interest calculator tests only
pnpm test loanCalculations    # Run loan calculation tests only
```

#### Manual Testing
```bash
cd server
node utils/testInterestCalculator.js  # Interest calculator demo
node utils/testLoanModel.js          # Loan model integration
node utils/testFlatRate.js           # Flat rate comparison
```

### Migration Guide

#### Existing Loans
Existing loans without `interestCalculation` field will default to:
```javascript
{
  method: 'reducing_balance',
  accrualBasis: 'actual/365',
  accrualFrequency: 'daily'
}
```

No database migration required - defaults handle backward compatibility.

#### Frontend Integration
Update loan application forms to include method selection:

```jsx
<select name="method">
  <option value="reducing_balance">Reducing Balance (Standard)</option>
  <option value="flat_rate">Flat Rate (Microfinance)</option>
</select>

<select name="repaymentFrequency">
  <option value="monthly">Monthly</option>
  <option value="bi_weekly">Bi-weekly</option>
  <option value="weekly">Weekly</option>
  <option value="quarterly">Quarterly</option>
</select>
```

### Performance Considerations

#### Calculation Speed
- Reducing balance schedule: < 5ms for 60 months
- Flat rate schedule: < 2ms for any term
- Day count calculations: O(1) complexity

#### Memory Usage
- Schedule generation: Minimal overhead
- Date calculations: Native Date object handling

### Next Steps (Weeks 2-12)

#### Week 2: Simple Interest & Interest-Only
- Implement simple interest calculations
- Add interest-only payment option
- Support principal balloon payments

#### Week 3: Variable Interest Rates
- Support rate changes during loan term
- Handle rate adjustment dates
- Recalculate schedules on rate change

#### Week 4-5: Early Repayment & Penalties
- Calculate early repayment penalties
- Support partial prepayments
- Update schedules after prepayments

#### Week 6-7: Grace Periods & Moratorium
- Implement grace period support
- Add payment moratorium handling
- Calculate deferred interest

#### Week 8-9: Fee Integration
- Add origination fees
- Support processing fees
- Handle insurance premiums

#### Week 10: Late Payment Handling
- Calculate late payment penalties
- Update overdue interest calculation
- Support penalty compounding

#### Week 11: Advanced Testing
- Load testing for calculations
- Edge case validation
- Performance benchmarks

#### Week 12: Documentation & Deployment
- Complete API documentation
- Create user guides
- Deploy to production

### Known Limitations

1. **Day Count in Initial Calculation**: The reducing balance formula currently uses standard monthly periods for the initial payment calculation, while the schedule generation uses actual day counts. This may cause minor rounding differences.

2. **Leap Years**: Currently handled by `actual/365` and `actual/360` conventions. No separate leap year handling needed.

3. **Time Zones**: All dates use server timezone. Consider standardizing to UTC for multi-region deployments.

### References

- [Day Count Convention Standards](https://en.wikipedia.org/wiki/Day_count_convention)
- [Amortization Calculation Methods](https://www.investopedia.com/terms/a/amortization.asp)
- [Flat Rate vs Reducing Balance](https://www.thebalance.com/flat-rate-vs-reducing-balance-loans-4845276)

### Support

For questions or issues:
- GitHub Issues: [ndalamahub_lms_app/issues](https://github.com/wmweemba/ndalamahub_lms_app/issues)
- Email: support@ndalamahub.com
- Documentation: [README.md](../README.md)
