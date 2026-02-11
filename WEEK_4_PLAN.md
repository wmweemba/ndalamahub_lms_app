# Week 4: Prepayment & Early Settlement Engine

**Status**: 🚀 Starting  
**Duration**: Days 1-5 (10 hours)  
**Branch**: feature/phase-0-loan-engine  
**Progress**: Phase 0: 25% complete (3/12 weeks)

---

## Overview

Week 4 focuses on implementing prepayment handling and early settlement capabilities - critical features for enterprise loan management systems. This allows borrowers to make extra payments, pay off loans early, and gives lenders flexibility in managing loan lifecycles.

### What We're Building

1. **Prepayment Recording System**
   - Record extra payments beyond scheduled installments
   - Allocate payments to principal/interest
   - Track prepayment history

2. **Schedule Recalculation**
   - Dynamically adjust remaining installments after prepayment
   - Support two strategies: reduce term OR reduce payment
   - Maintain accurate interest calculations

3. **Early Settlement**
   - Full loan payoff calculation
   - Early settlement fees/penalties
   - Loan closure workflow

4. **Partial Prepayment**
   - Extra principal payments
   - Maintain same term, reduce monthly payment
   - OR maintain same payment, reduce term

---

## Success Criteria

By end of Week 4, the system must:
- ✅ Accept extra payments beyond scheduled amounts
- ✅ Recalculate loan schedules after prepayment
- ✅ Calculate early settlement amounts with fees
- ✅ Support both "reduce term" and "reduce payment" strategies
- ✅ Work with all 4 calculation methods (reducing balance, flat rate, simple interest, interest-only)
- ✅ Maintain multi-tenant data isolation
- ✅ Have 10+ new tests passing (total 62/62)
- ✅ Zero regression in existing functionality

---

## Week 4 Daily Breakdown (2 hours/day)

### Day 1 (Today - Feb 11): Prepayment Data Model
**Goal**: Add prepayment tracking to Loan model

**Tasks** (2 hours):
1. Add prepayment fields to Loan schema (30 min)
   ```javascript
   prepayments: [{
     amount: Number,
     date: Date,
     allocationStrategy: String, // 'reduce_term' or 'reduce_payment'
     principalPortion: Number,
     interestPortion: Number,
     feePortion: Number,
     recordedBy: ObjectId
   }],
   earlySettlement: {
     settled: Boolean,
     settlementDate: Date,
     settlementAmount: Number,
     earlySettlementFee: Number,
     principalBalance: Number,
     interestBalance: Number
   }
   ```

2. Add prepayment validation methods (45 min)
   - `canAcceptPrepayment()` - check if loan is active
   - `calculateRemainingBalance()` - get current principal
   - `calculateEarlySettlementAmount()` - total payoff amount

3. Update Loan model tests (45 min)
   - Test prepayment field validation
   - Test early settlement calculation
   - Verify multi-tenant isolation

**Deliverable**: Enhanced Loan model with prepayment support

---

### Day 2 (Feb 12): Prepayment API Endpoints
**Goal**: Create API for recording prepayments

**Tasks** (2 hours):
1. Create prepayment endpoints in `server/routes/loans.js` (60 min)
   ```javascript
   // POST /api/loans/:id/prepayment
   // Body: { amount, allocationStrategy, notes }
   
   // POST /api/loans/:id/early-settlement
   // Body: { settlementDate }
   
   // GET /api/loans/:id/settlement-quote
   // Returns: { amount, breakdown, fees }
   ```

2. Implement prepayment logic (45 min)
   - Validate prepayment amount
   - Allocate to principal/interest
   - Trigger schedule recalculation
   - Record payment history

3. Add authorization checks (15 min)
   - Only lender_admin can record prepayments
   - Verify loan belongs to user's company

**Deliverable**: Working prepayment API with proper validation

---

### Day 3 (Feb 13): Schedule Recalculation Engine
**Goal**: Rebuild schedules after prepayment

**Tasks** (2 hours):
1. Add `recalculateSchedule()` method to Loan model (75 min)
   ```javascript
   loanSchema.methods.recalculateSchedule = function(strategy) {
     const remainingBalance = this.calculateRemainingBalance();
     const remainingTerm = /* calculate based on strategy */;
     
     if (strategy === 'reduce_term') {
       // Keep same payment, reduce number of installments
     } else if (strategy === 'reduce_payment') {
       // Keep same term, reduce payment amount
     }
     
     // Regenerate schedule for remaining balance
     this.repaymentSchedule = /* new schedule */;
   }
   ```

2. Handle different calculation methods (30 min)
   - Reducing balance: standard recalculation
   - Flat rate: prorate remaining interest
   - Simple interest: adjust per-period interest
   - Interest-only: adjust balloon payment

3. Write recalculation tests (15 min)
   - Test reduce term strategy
   - Test reduce payment strategy
   - Test with different methods

**Deliverable**: Dynamic schedule recalculation working

---

### Day 4 (Feb 14): Early Settlement & Fees
**Goal**: Full loan payoff with fee calculations

**Tasks** (2 hours):
1. Implement early settlement calculation (60 min)
   ```javascript
   loanSchema.methods.calculateEarlySettlement = function() {
     const remainingPrincipal = this.calculateRemainingBalance();
     const accruedInterest = this.calculateAccruedInterest();
     
     // Get early settlement fee from product (if exists)
     const settlementFee = this.product 
       ? this.product.fees.earlySettlement.calculate(remainingPrincipal)
       : 0;
     
     return {
       principalBalance: remainingPrincipal,
       interestBalance: accruedInterest,
       earlySettlementFee: settlementFee,
       totalPayoff: remainingPrincipal + accruedInterest + settlementFee,
       savingsVsSchedule: /* calculate interest saved */
     };
   }
   ```

2. Add early settlement endpoint logic (30 min)
   - Process settlement payment
   - Mark loan as completed
   - Record settlement details
   - Update loan status

3. Product model enhancement (30 min)
   - Add earlySettlement fee to product config
   - Support percentage or fixed amount
   - Default to 0 if not configured

**Deliverable**: Complete early settlement workflow

---

### Day 5 (Feb 15): Testing & Integration
**Goal**: Comprehensive testing and frontend integration

**Tasks** (2 hours):
1. Write comprehensive tests (60 min)
   ```javascript
   // Test suite for prepayment
   describe('Loan Prepayment', () => {
     test('records prepayment correctly', ...);
     test('recalculates schedule - reduce term', ...);
     test('recalculates schedule - reduce payment', ...);
     test('calculates early settlement with fees', ...);
     test('handles multiple prepayments', ...);
     test('validates against inactive loans', ...);
     test('multi-tenant isolation', ...);
   });
   ```

2. Frontend components (45 min)
   - Add "Make Prepayment" button to LoanDetailsDialog
   - Create PrepaymentDialog component
   - Add early settlement option
   - Display remaining balance and settlement quote

3. Documentation (15 min)
   - Update LOAN_ENGINE_DOCUMENTATION.md
   - Add prepayment API examples
   - Document calculation strategies

**Deliverable**: 62/62 tests passing, frontend integration complete

---

## Technical Architecture

### Database Schema Changes

**Loan Model Additions**:
```javascript
{
  // ... existing fields ...
  
  prepayments: [{
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    allocationStrategy: { 
      type: String, 
      enum: ['reduce_term', 'reduce_payment'],
      required: true 
    },
    principalPortion: Number,
    interestPortion: Number,
    feePortion: Number,
    notes: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  earlySettlement: {
    settled: { type: Boolean, default: false },
    settlementDate: Date,
    settlementAmount: Number,
    earlySettlementFee: Number,
    principalBalance: Number,
    interestBalance: Number,
    savingsRealized: Number
  }
}
```

### API Endpoints

```javascript
// Prepayment Operations
POST   /api/loans/:id/prepayment           // Record extra payment
POST   /api/loans/:id/early-settlement     // Settle loan completely
GET    /api/loans/:id/settlement-quote     // Get payoff amount
GET    /api/loans/:id/prepayment-history   // List all prepayments
DELETE /api/loans/:id/prepayment/:prepaymentId  // Reverse prepayment (admin only)

// Response format
{
  success: true,
  data: {
    prepayment: { amount, date, strategy },
    newSchedule: [ /* updated repayment schedule */ ],
    summary: {
      remainingBalance: 45000,
      nextPayment: { date, amount },
      termReduction: 6  // months saved
    }
  }
}
```

### Calculation Logic

**Prepayment Allocation**:
1. Calculate accrued interest to date
2. Apply payment: Interest first, then principal
3. Record allocation breakdown
4. Trigger schedule recalculation

**Reduce Term Strategy**:
```javascript
// Keep same monthly payment, reduce number of months
const newTerm = calculateTerm(remainingBalance, monthlyPayment, interestRate);
// newTerm < originalTerm
```

**Reduce Payment Strategy**:
```javascript
// Keep same term, reduce monthly payment
const newPayment = calculatePayment(remainingBalance, remainingTerm, interestRate);
// newPayment < originalPayment
```

---

## Real-World Examples

### Example 1: Partial Prepayment (Reduce Term)
```
Original Loan:
- Principal: ZMW 50,000
- Rate: 24% APR
- Term: 12 months
- Monthly Payment: ZMW 4,707
- Total Interest: ZMW 6,488

After 6 months, borrower pays extra ZMW 10,000:
- Remaining balance: ZMW 28,345
- New term: 6 months → 5 months (1 month saved)
- Payment remains: ZMW 4,707
- Interest saved: ZMW 540
```

### Example 2: Partial Prepayment (Reduce Payment)
```
Same original loan, same ZMW 10,000 prepayment:

Alternative strategy:
- Remaining balance: ZMW 28,345
- Term stays: 6 months
- New payment: ZMW 3,920 (reduced from ZMW 4,707)
- Interest saved: ZMW 327
```

### Example 3: Early Settlement
```
Original Loan:
- Principal: ZMW 100,000
- Rate: 18% APR
- Term: 24 months
- Monthly Payment: ZMW 4,992

After 10 months, borrower wants to settle:
- Remaining principal: ZMW 63,421
- Accrued interest: ZMW 952
- Early settlement fee: 5% = ZMW 3,171
- Total payoff: ZMW 67,544

Savings vs continuing:
- Would have paid: ZMW 69,888 (14 × ZMW 4,992)
- Actual payoff: ZMW 67,544
- Savings: ZMW 2,344
```

---

## Testing Strategy

### Unit Tests (5 tests)
1. Prepayment amount validation
2. Remaining balance calculation
3. Early settlement calculation
4. Schedule recalculation (reduce term)
5. Schedule recalculation (reduce payment)

### Integration Tests (5 tests)
1. Prepayment API with reducing balance loan
2. Prepayment API with flat rate loan
3. Early settlement with fees
4. Multiple prepayments on same loan
5. Multi-tenant isolation (cannot prepay other company's loans)

### Edge Cases
- Prepayment exceeds remaining balance
- Early settlement on fully paid loan
- Prepayment on different calculation methods
- Zero-interest loans
- Prepayment on first vs last installment

---

## Dependencies

**Backend**:
- No new packages required
- Uses existing interestCalculator utility
- Leverages current Loan model

**Frontend**:
- Reuse existing Dialog components
- Reuse Form components (React Hook Form + Zod)
- Add icons for prepayment actions

---

## Performance Considerations

**Schedule Recalculation**:
- Only recalculate remaining installments, not past
- Cache calculations to avoid redundant compute
- Use lazy loading for prepayment history

**Database Queries**:
- Index on `prepayments.date` for fast lookups
- Use aggregation pipeline for prepayment summaries
- Limit prepayment history to last 50 records in API responses

---

## Risk Mitigation

**Calculation Accuracy**:
- All calculations tested against manual Excel verification
- Round to 2 decimal places for ZMW amounts
- Store all intermediate values for audit trail

**Data Integrity**:
- Prepayments are immutable (no updates, only reversals)
- Reversals require admin approval
- All changes logged with user ID and timestamp

**User Experience**:
- Show settlement quote before processing
- Require confirmation for early settlement
- Display savings clearly to encourage prepayments

---

## Success Metrics

**By End of Week 4**:
- ✅ 10+ new tests passing (total 62/62)
- ✅ API supports prepayment and early settlement
- ✅ Schedule recalculation working for all 4 methods
- ✅ Frontend components integrated
- ✅ Documentation updated
- ✅ Zero regression in existing tests (52/52 still passing)

**Code Quality**:
- Test coverage > 80% for new code
- All endpoints validated and authorized
- Error handling comprehensive
- Multi-tenant isolation enforced

---

## Next Week Preview

**Week 5**: Grace Periods & Payment Moratorium
- Interest-only grace periods at loan start
- Payment holidays/moratoriums
- Restructuring workflows
- Deferred payment handling

**Weeks 6-7**: Advanced Payment Tracking
- Automated payment collection
- Payment allocation rules
- Overdue management
- Payment receipts and confirmations

---

## Getting Started (Day 1 Tasks)

**Right Now** (30 minutes):
1. Open `server/models/Loan.js`
2. Add prepayment fields to schema (see Day 1 tasks above)
3. Run tests: `cd server && npm test`
4. Commit: `git commit -m "feat: add prepayment schema fields"`

**Then** (45 minutes):
5. Add validation methods to Loan model
6. Test in MongoDB
7. Verify no errors

**Finally** (45 minutes):
8. Write initial tests for prepayment validation
9. Run full test suite
10. Mark Day 1 complete

---

## Resources

**Documentation**:
- LOAN_ENGINE_DOCUMENTATION.md (current calculations)
- WEEK_1_SUMMARY.md (daily accrual methods)
- WEEK_2_SUMMARY.md (interest calculation methods)
- WEEK_3_PRODUCT_CATALOG.md (product fee configuration)

**Code References**:
- `server/utils/interestCalculator.js` (calculation utilities)
- `server/models/Loan.js` (current loan model)
- `server/models/LoanProduct.js` (product fee structure)
- `server/routes/loans.js` (existing loan API)

**External References**:
- Mambu API: Prepayment handling
- nCino: Early settlement workflows
- CFPB regulations: Prepayment penalty disclosures

---

**Ready to start?** Let's begin with Day 1! 🚀
