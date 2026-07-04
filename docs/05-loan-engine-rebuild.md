# Phase 05 — Loan Rate Engine Rebuild

**Prerequisite:** Phases 01–04 merged; suite green. Branch: `phase/05-loan-engine` off `main`.

## Objective

Make the rate engine a configurable platform capability (locked decision): support **rate basis** — per annum, per term, per period — as product-level configuration instead of the current hardcoded annualized interpretation. Fix the schedule lifecycle defects the audit found: schedules anchored to application date instead of disbursement, the approximated `endDate`, and the early-settlement bookkeeping that corrupts summary math. Clean up the loan model's committed debug artifacts. Manifi's actual terms are then entered as *data* (a product configuration) once Clement confirms them — no Manifi-specific code.

## Resolved open questions (industry best practice — confirm with William before executing)

1. **Schedule anchor date → disbursement date.** Interest accrues from when money moves; due dates count from disbursement. This is the lending-industry norm. The schedule is therefore *regenerated at disbursement*. Existing active loans keep their current schedules (no retroactive regeneration — flag any that look wrong for manual review instead).
2. **Early-settlement bookkeeping → new installment status `waived`.** Remaining installments are marked `waived` (not `paid` with `paidAmount: 0`, which corrupts totals). The settlement amount itself is recorded once, in `loan.earlySettlement.settlementAmount`, and summary math treats it as paid. Nothing pretends individual future installments were paid.
3. **Rate-basis semantics** (this is the audit's "flat rate" question, generalized):
   - `per_annum` — rate is annual (current behavior; the default, so existing products/loans are unaffected).
   - `per_term` — rate applies once to the whole loan term: total interest = principal × rate/100 regardless of term length. *Manifi's "25% per 30-day loan" = `flat_rate` method + `per_term` basis + rate 25 + term 1 month.*
   - `per_period` — rate applies to each repayment period: annualized = rate × periods-per-year.

## Scope

- `server/models/LoanProduct.js` — `interestCalculation.rateBasis` field
- `server/models/Loan.js` — `interestCalculation.rateBasis` field, rate normalization at calculation entry, schedule regeneration on disbursement, settlement bookkeeping, `getSummary`, `canBeApproved`, debug-artifact cleanup, loan-number generation
- `server/utils/interestCalculator.js` — `annualizeRate` helper
- `server/routes/loans.js` — disburse route regenerates schedule; early-settlement route uses `waived`; create-route passes product rateBasis through
- `server/routes/products.js` — accept/validate `rateBasis` on create/update
- Client (functional minimum only): `components/products/CreateProductDialog.jsx`, `EditProductDialog.jsx` — a rate-basis select; `ProductBasedLoanForm.jsx` — display only if it already displays method
- Tests: extend `interestCalculator.test.js`, `loanCalculations.test.js`, `prepayment.test.js`; new cases listed below

**Out of scope:** arrears/overdue transitions (Phase 07), orphan-safety (Phase 06), dashboards/reports (already scoped in 04; they read whatever the model computes), any UI beyond the named form fields.

## Step-by-step instructions

### Step 1 — `annualizeRate` in the calculator

Add to `server/utils/interestCalculator.js` (and export):

```js
/**
 * Normalize a configured rate to an effective annual rate.
 * @param {Number} rate - Rate as entered (percent)
 * @param {String} rateBasis - 'per_annum' | 'per_term' | 'per_period'
 * @param {Number} termMonths - Loan term in months
 * @param {String} frequency - Repayment frequency
 * @returns {Number} Effective annual rate (percent)
 */
function annualizeRate(rate, rateBasis = 'per_annum', termMonths = 12, frequency = 'monthly') {
  if (rateBasis === 'per_term') {
    return rate * (12 / termMonths);
  }
  if (rateBasis === 'per_period') {
    return rate * getPeriodsPerYear(frequency);
  }
  return rate; // per_annum
}
```

Every existing calculator keeps taking an **annual** rate — normalization happens once, at the model entry points (Step 3). This keeps the math functions single-purpose and the tests simple. Sanity anchor: `flat_rate` + `per_term` 25% + term 1 → `annualizeRate` = 300 → `calculateFlatRateInterest(P, 300, 1)` = P × 3.00 × (1/12) = 0.25 P. Exactly the "25% per 30 days" product.

### Step 2 — Schema fields

2a. `server/models/LoanProduct.js`, inside `interestCalculation` (after `method`, line ~104):

```js
    rateBasis: {
      type: String,
      enum: {
        values: ['per_annum', 'per_term', 'per_period'],
        message: '{VALUE} is not a valid rate basis'
      },
      default: 'per_annum'
    },
```

Also relax `interestRate.min/max/default` validators' `max: [100, ...]` to `max: [1000, ...]` — a per-term or per-period rate under 100 can legitimately annualize past 100, and a platform admin may want to store annual-equivalent documentation values. Keep `min: 0`.

2b. `server/models/Loan.js`, inside its `interestCalculation` subdocument: add the identical `rateBasis` field. In `server/routes/loans.js` product-based create path, copy `product.interestCalculation.rateBasis` onto the loan alongside `method` (find where `method`/`accrualBasis` are copied and mirror it).

### Step 3 — Use the basis in the model

In `server/models/Loan.js` `calculateLoanDetails()` (line ~569): at the top, replace `const annualRate = this.interestRate;` with:

```js
  const { annualizeRate } = require('../utils/interestCalculator'); // add to the existing top-of-file require instead
  const rateBasis = this.interestCalculation?.rateBasis || 'per_annum';
  const annualRate = annualizeRate(this.interestRate, rateBasis, this.term, this.repaymentFrequency || 'monthly');
```

(Import `annualizeRate` in the existing destructured `require` at the top of the file, not inline.) Then audit every other place `Loan.js` reads `this.interestRate` for math — the four `generate*Schedule` methods and `recalculateSchedule` (line ~1324) — and route each through the same normalized value. Mechanically: each method that starts `const annualRate = this.interestRate` gets the same three-line replacement. `getSummary`, display code, and validators keep the raw configured rate.

Products routes (`server/routes/products.js` create/update): accept `interestCalculation.rateBasis`, validate against the enum (Mongoose does it, but return the 400 nicely as the routes do for `method`).

### Step 4 — Anchor schedules to disbursement

4a. `server/routes/loans.js` disburse route (~787–794): after setting `loan.disbursedAt = new Date()` and `loan.startDate = new Date()`, force regeneration:

```js
    loan.calculateLoanDetails(); // regenerate schedule anchored to disbursedAt
    loan.endDate = loan.repaymentSchedule.length > 0
      ? loan.repaymentSchedule[loan.repaymentSchedule.length - 1].dueDate
      : loan.endDate;
```

Delete the `loan.endDate = new Date(Date.now() + (loan.term * 30 * ...))` approximation (line 791).

4b. Guard against double-generation weirdness: `generateRepaymentSchedule` runs in the pre-save hook whenever amount/rate/term is modified (`Loan.js:534`). That hook may also fire on the disbursement save — verify that the regeneration in 4a is not then overwritten or duplicated. If the pre-save hook would regenerate again, that's fine (idempotent — same inputs, same `disbursedAt`), but confirm by inspecting the saved schedule's first due date in the manual test.

4c. Application-time schedules remain (they serve as a preview before disbursement) — they're simply replaced at disbursement. No change needed at creation.

### Step 5 — Early-settlement bookkeeping

5a. `server/models/Loan.js` installment status enum (line ~245): `['pending', 'paid', 'overdue', 'partial']` → add `'waived'`.

5b. `server/routes/loans.js` early-settlement route (~1233–1240): change the forEach to set `installment.status = 'waived'` (keep `paidAt = proposedDate` as the waived-at timestamp; keep `paidAmount = 0`). Also update the repayment route's `allPaid` completion check (~929): `every(inst => inst.status === 'paid')` → `every(inst => inst.status === 'paid' || inst.status === 'waived')`.

5c. `getSummary()` (`Loan.js:1040–1064`) — make it settlement- and prepayment-aware:

```js
loanSchema.methods.getSummary = function() {
  const paidInstallments = this.repaymentSchedule.filter(i => i.status === 'paid');
  const installmentsPaid = paidInstallments.reduce((sum, i) => sum + i.paidAmount, 0);
  const prepaid = (this.prepayments || []).reduce((sum, p) => sum + p.amount, 0);
  const settlementPaid = this.earlySettlement?.settled ? this.earlySettlement.settlementAmount : 0;
  const totalPaid = installmentsPaid + prepaid + settlementPaid;

  const overdueInstallments = this.repaymentSchedule.filter(i =>
    i.status === 'overdue' && new Date() > i.dueDate
  );

  return {
    totalAmount: this.totalAmount,
    totalPaid,
    remainingBalance: this.earlySettlement?.settled ? 0 : Math.max(0, this.totalAmount - totalPaid),
    overdueAmount: overdueInstallments.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0),
    nextPayment: this.repaymentSchedule.find(i => i.status === 'pending')
  };
};
```

Check callers of `getSummary()` (`loans.js` summary route, `updatePaymentTracking`) still behave; `updatePaymentTracking` reads `summary.totalPaid` — fine.

5d. Anywhere else that filters `status === 'paid'` to compute balances — `calculateRemainingBalance` (`Loan.js:1137`) and `calculateAccruedInterest` (~1164) — leave as-is: waived installments carry no principal credit, and `calculateRemainingBalance` on a settled loan is short-circuited by settlement checks in the routes. Verify `canAcceptPrepayment` already blocks settled loans (it does, via `earlySettlement?.settled`).

### Step 6 — Model cleanups

6a. Delete the module-scope `const debugSchedule = [];` (`Loan.js:1`) and every `debugSchedule.push(...)` reference in the file (memory leak).
6b. Delete the `// ...existing code...` editor artifacts (`Loan.js:2`, `loans.js:14`).
6c. Delete the `NODE_ENV === 'test'` console.log blocks inside `generateReducingBalanceSchedule` (lines ~646–653, 664–671, 721+) and any siblings in the other generators.
6d. `canBeApproved()` (`Loan.js:1067`): the loan status enum has no `'pending'` — reduce to `return this.status === 'pending_approval';`. Same cleanup in the reject route's status check (`loans.js:682`): drop the `'pending'` comparison.
6e. Loan-number race (`Loan.js:520–531`): replace `countDocuments`-based numbering with an atomic counter:

```js
    const year = new Date().getFullYear();
    const counters = this.constructor.db.collection('counters');
    const { value } = await counters.findOneAndUpdate(
      { _id: `loanNumber-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    this.loanNumber = `LN${year}${value.seq.toString().padStart(4, '0')}`;
```

Seed the counter for the current year before deploy: set `seq` to the current max existing sequence (one-off script or manual Mongo command — document the exact command in the changelog entry). Note: driver versions differ on `findOneAndUpdate` return shape (`value` wrapper vs. direct doc) — check the installed mongoose/mongodb driver behavior in a quick REPL test and adjust.

### Step 7 — Tests

Extend the suite (same file style as existing tests):

- `interestCalculator.test.js`: `annualizeRate` — per_annum passthrough; per_term (25, 1 month → 300; 20, 6 months → 40); per_period (2, monthly → 24; 1, weekly → 52).
- `loanCalculations.test.js`: a `flat_rate` + `per_term` 25% + term 1 loan of 10,000 → `totalInterest` 2,500, `totalAmount` 12,500 (the Manifi shape); a `per_annum` control case asserting unchanged numbers vs. current expectations.
- New settlement test (in `prepayment.test.js` or a new file): after early settlement, remaining installments are `waived`, `getSummary().remainingBalance === 0`, and `totalPaid` includes the settlement amount exactly once.
- Disbursement-anchor test: create loan (application date D0), disburse at D0+14d, assert first `dueDate` is one frequency-period after disbursement, and `endDate` equals the last installment's `dueDate`.

### Step 8 — Client functional minimum

`CreateProductDialog.jsx` / `EditProductDialog.jsx`: add a "Rate basis" `<Select>` (options: Per annum / Per term / Per period, default Per annum) wired into the existing form state and submit payload — visually consistent with the existing method select, no new styling. Nothing else client-side.

### Step 9 — Verify & close out

1. Full suite green (previous count + new tests).
2. Manual: create a product with `flat_rate`/`per_term`/25%, apply + approve + disburse a 1-month 10,000 loan → schedule shows one installment of 12,500 due one month after **disbursement**; settle a seeded active loan early → summary shows balance 0, no corrupted totals.
3. Update `CLAUDE.md` Sections 3/6 as applicable; changelog entry (include: the two resolved-question assumptions and the counter-seeding deploy step). Commit; merge green.

## Acceptance criteria

1. Suite green with all new tests from Step 7.
2. The Manifi-shaped product computes interest = principal × 0.25 for a 1-month term, entered as rate 25 — **not** 300.
3. Existing `per_annum` loans/tests produce byte-identical numbers to pre-phase (control case proves it).
4. Post-disbursement schedules anchor to `disbursedAt`; `endDate` = last due date.
5. Early-settled loans report `remainingBalance` 0 and honest `totalPaid`; no installment claims `paid` with amount 0.
6. `grep -n "debugSchedule\|\.\.\.existing code" server` → 0 hits.

## Session sizing

**Two sessions.** Session A: Steps 1–3 + 7's rate tests (rate basis end-to-end), commit green. Session B: Steps 4–6, 8, remaining tests, verification. Both halves leave the app working.

## Rollback

Revert the merge commit. Schema additions are additive (`rateBasis` has a default; `waived` extends an enum) so old code reading new data is safe *except*: loans settled post-phase will have `waived` installments that pre-phase code's enum rejects **on next save**. If a rollback happens after real settlements occurred, run a one-off `updateMany({'repaymentSchedule.status':'waived'}, ...)` mapping `waived`→`paid` first (accepting the old corruption), or preferably roll forward instead. The counters collection is inert to old code.

## Flagged concerns / assumptions for William

- **Assumption 1 (confirm before executing):** schedules anchor to disbursement date; existing active loans are *not* retroactively re-anchored.
- **Assumption 2 (confirm before executing):** early settlement uses `waived` status; settlement amount lives only on `earlySettlement`.
- **Pending Manifi terms:** once Clement confirms the actual product (rate, basis, term, method), it's entered through the product UI — verify it matches Acceptance 2's math before first real loan.
- `simple_interest`'s recalculation path builds flat-rate-style totals (`Loan.js:1547`) that don't perfectly mirror its generation path; pre-existing, out of scope, noted for a future engine pass.
