# Phase 05 — Loan Rate Engine Rebuild

**Prerequisite:** Phases 01–04 merged; suite green. Branch: `phase/05-loan-engine` off `main`.

## Objective

Make the rate engine a configurable platform capability (locked decision): support **rate basis** — per annum, per term, per period — and an **explicit term unit** (days/weeks/months) as product-level configuration instead of the current hardcoded annualized, months-only interpretation. Fix the schedule lifecycle defects the audit found: schedules anchored to application date instead of disbursement, the approximated `endDate`, and the early-settlement bookkeeping that corrupts summary math. Clean up the loan model's committed debug artifacts. **Manifi's confirmed product terms (via Clement, locked in `docs/DECISIONS.md`): flat rate, 25%, fixed 30-day term** — configured as data at the end of this phase, no Manifi-specific code.

## Confirmed decisions this phase implements (locked 2026-07-04 — see `docs/DECISIONS.md`)

1. **Schedule anchor date → disbursement date.** ✅ Confirmed by William. The schedule is *regenerated at disbursement*. Existing active loans keep their current schedules (no retroactive regeneration — flag any that look wrong for manual review instead).
2. **Early-settlement bookkeeping → new installment status `waived`.** ✅ Confirmed by William. Remaining installments are marked `waived` (not `paid` with `paidAmount: 0`, which corrupts totals). The settlement amount itself is recorded once, in `loan.earlySettlement.settlementAmount`, and summary math treats it as paid.
3. **Rate-basis semantics:**
   - `per_annum` — rate is annual (current behavior; the default, so existing products/loans are unaffected).
   - `per_term` — rate applies once to the whole loan term: total interest = principal × rate/100 regardless of term length.
   - `per_period` — rate applies to each repayment period: annualized = rate × periods-per-year.
4. **Term unit modeling (new requirement from the confirmed Manifi terms):** the schema's months-only `term` (with day schedules approximated as `term × 30 days`) cannot represent a true 30-day product without due-date/accrual drift — a calendar month is not 30 days. Term is therefore modeled as a value **plus an explicit unit** (`days` | `weeks` | `months`). *Manifi's product = `flat_rate` method + `per_term` basis + rate 25 + term 30 `days` → interest exactly principal × 0.25, single installment due exactly 30 days after disbursement.* Existing data/products default to `months` and are unaffected.

## Scope

- `server/models/LoanProduct.js` — `interestCalculation.rateBasis` field; `term.unit` field
- `server/models/Loan.js` — `interestCalculation.rateBasis` + `termUnit` fields, rate normalization at calculation entry, term-unit-aware schedule generation, schedule regeneration on disbursement, settlement bookkeeping, `getSummary`, `canBeApproved`, debug-artifact cleanup, loan-number generation
- `server/utils/interestCalculator.js` — `annualizeRate` + `termToDays` helpers
- `server/routes/loans.js` — disburse route regenerates schedule; early-settlement route uses `waived`; create-route passes product `rateBasis`/term unit through
- `server/routes/products.js` — accept/validate `rateBasis` and `term.unit` on create/update
- Client (functional minimum only): `components/products/CreateProductDialog.jsx`, `EditProductDialog.jsx` — a rate-basis select and a term-unit select; `ProductBasedLoanForm.jsx` — display only if it already displays method
- Tests: extend `interestCalculator.test.js`, `loanCalculations.test.js`, `prepayment.test.js`; new cases listed below

**Out of scope:** arrears/overdue transitions (Phase 07), orphan-safety (Phase 06), dashboards/reports (already scoped in 04; they read whatever the model computes), any UI beyond the named form fields.

## Step-by-step instructions

### Step 1 — `annualizeRate` and `termToDays` in the calculator

Add to `server/utils/interestCalculator.js` (and export both):

```js
/**
 * Length of a term in days. Month terms are calendar-based, so they have no
 * fixed day count — callers doing calendar scheduling must use addMonths;
 * this helper is for rate math, where the 365/12 average is the convention.
 * @param {Number} term - Term value
 * @param {String} termUnit - 'days' | 'weeks' | 'months'
 * @returns {Number} Term length in days
 */
function termToDays(term, termUnit = 'months') {
  if (termUnit === 'days') return term;
  if (termUnit === 'weeks') return term * 7;
  return term * (365 / 12); // months (average, rate math only)
}

/**
 * Normalize a configured rate to an effective annual rate.
 * @param {Number} rate - Rate as entered (percent)
 * @param {String} rateBasis - 'per_annum' | 'per_term' | 'per_period'
 * @param {Number} term - Loan term value
 * @param {String} termUnit - 'days' | 'weeks' | 'months'
 * @param {String} frequency - Repayment frequency
 * @returns {Number} Effective annual rate (percent)
 */
function annualizeRate(rate, rateBasis = 'per_annum', term = 12, termUnit = 'months', frequency = 'monthly') {
  if (rateBasis === 'per_term') {
    if (termUnit === 'months') return rate * (12 / term); // exact for month terms
    return rate * (365 / termToDays(term, termUnit));
  }
  if (rateBasis === 'per_period') {
    return rate * getPeriodsPerYear(frequency);
  }
  return rate; // per_annum
}
```

Every existing calculator keeps taking an **annual** rate — normalization happens once, at the model entry points (Step 3).

**Exactness rule for `flat_rate` + `per_term`:** do *not* round-trip through annualization for this combination — in `calculateLoanDetails` (Step 3), when `method === 'flat_rate' && rateBasis === 'per_term'`, compute `totalInterest = principal * (rate / 100)` directly. Annualizing and de-annualizing a day-based term reintroduces day-count error; the per-term contract is "this rate, once, on the principal" and must hold to the cent. Sanity anchor (the Manifi product): 10,000 at `flat_rate`/`per_term`/25%/term 30 `days` → `totalInterest` exactly 2,500. The annualized path remains for `per_term` combined with the other methods (where interest inherently accrues over time).

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

2b. **Term unit.** `server/models/LoanProduct.js`, inside the `term` configuration object (alongside `min`/`max`/`default`, line ~57):

```js
    unit: {
      type: String,
      enum: {
        values: ['days', 'weeks', 'months'],
        message: '{VALUE} is not a valid term unit'
      },
      default: 'months'
    },
```

`term.min/max/default` are interpreted **in that unit** (so Manifi's product is `term: {min: 30, max: 30, default: 30, unit: 'days'}`). Check `LoanProduct.isTermValid` (line ~364) — it compares raw numbers, so it needs no change *provided* loan and product use the same unit; add a comment stating that invariant.

2c. `server/models/Loan.js`: add both fields — `rateBasis` inside its `interestCalculation` subdocument (identical to 2a), and a top-level `termUnit` (same enum, default `'months'`) next to the existing `term` field. `term` keeps its `min: 1` validator (a 1-day term is now legal and fine). In `server/routes/loans.js` product-based create path, copy `product.interestCalculation.rateBasis` and `product.term.unit` onto the loan alongside `method`/`accrualBasis` (find where those are copied and mirror it). Legacy/non-product applications get the defaults (`per_annum`, `months`) — byte-identical behavior to today.

### Step 3 — Use the basis in the model

In `server/models/Loan.js` `calculateLoanDetails()` (line ~569): at the top, replace `const annualRate = this.interestRate;` with:

```js
  const rateBasis = this.interestCalculation?.rateBasis || 'per_annum';
  const termUnit = this.termUnit || 'months';
  const annualRate = annualizeRate(this.interestRate, rateBasis, this.term, termUnit, this.repaymentFrequency || 'monthly');
```

(Import `annualizeRate` and `termToDays` in the existing destructured `require` at the top of the file, not inline.) In the same method, implement the Step 1 exactness rule — the `flat_rate` branch becomes:

```js
  if (method === 'flat_rate') {
    const totalInterest = rateBasis === 'per_term'
      ? principal * (this.interestRate / 100)                       // exact per-term contract
      : calculateFlatRateInterest(principal, annualRate, this.term); // month-terms only; see Step 3b for day/week terms
    ...
  }
```

Then audit every other place `Loan.js` reads `this.interestRate` for math — the four `generate*Schedule` methods and `recalculateSchedule` (line ~1324) — and route each through the same normalized value. Mechanically: each method that starts `const annualRate = this.interestRate` gets the same replacement. `getSummary`, display code, and validators keep the raw configured rate.

Products routes (`server/routes/products.js` create/update): accept `interestCalculation.rateBasis` and `term.unit`, validate against the enums (Mongoose does it, but return the 400 nicely as the routes do for `method`).

### Step 3b — Term-unit-aware schedule generation

Schedule shape rules (all four `generate*Schedule` methods, plus `calculateLoanDetails`'s payment math):

- **`termUnit === 'months'` (default):** exactly today's behavior — `term` installments stepped by `repaymentFrequency`, calendar-month arithmetic via `addMonths`. Zero change for existing data. This is the backward-compatibility contract; the control tests in Step 7 prove it.
- **`termUnit === 'days'` or `'weeks'`:** the loan's total length is exact — `termToDays(term, termUnit)` days from the anchor date. Installments step by `repaymentFrequency` from the anchor; the **final installment's due date is exactly anchor + term** (not a frequency step past it), and no installment is generated beyond the term end. Degenerate-but-primary case: when the term is shorter than or equal to one frequency period (Manifi: 30-day term, monthly frequency), the schedule is a **single installment** of full principal + interest due exactly `termToDays` days after the anchor, computed with `addDays` (already exists in `interestCalculator.js`).
- Number-of-installments bookkeeping: wherever the generators or `calculateLoanDetails` use `this.term` as the installment count (e.g. `for (let i = 1; i <= this.term; i++)`, `principal / term`), that count is only correct for month terms — introduce a locally computed `installmentCount` (months: `this.term`; days/weeks: `Math.max(1, Math.floor(termDays / frequencyPeriodDays))` with `frequencyPeriodDays` = 7 / 14 / 30.42 / 91.25 by frequency, final installment clamped to term end as above) and use it consistently in the loop, the per-installment principal split, and `monthlyPayment`.
- `endDate` = the final installment's due date in all cases (this replaces the `term × 30 days` approximation — see Step 4).
- `recalculateSchedule` and the three `_recalculate*` methods get the same `installmentCount`/term-end treatment for day/week terms; for the Manifi single-installment shape, prepayment recalculation degenerates to recomputing the one remaining installment — verify the reduce_term/reduce_payment strategies don't divide by zero when `remainingTerm` is 1 (add a test, Step 7).

Keep this surgical: do not rewrite the generators — thread `installmentCount` and the clamped final due date through the existing loop structure.

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

5c-bis. **Settlement/accrued-interest quote math review** (carried over from Phase 01 Addendum A and the Phase 01 Step 8 verification): `calculateEarlySettlementAmount`'s `accruedInterest` (via `calculateAccruedInterest`) includes interest from already-**paid** installments, which inflates `totalPayoff` — a borrower settling early is quoted interest they have already paid. Additionally, during Phase 01's live verification (2026-07-04, demo DB), `POST /api/loans/:id/prepayment`'s response summary returned an implausible **~ZMW 21 million** `beforeInterest`/`afterInterest` on a normal seeded loan — those fields come from the same `calculateAccruedInterest()` (`loans.js` prepayment route), so treat this as one defect cluster: root-cause `calculateAccruedInterest` first (suspect: date handling — e.g. summing interest across installments with invalid/unset `paidAt`/`dueDate`, or double-counting after schedule recalculation), then fix the quote composition. Restrict the accrued-interest component of quotes to interest accrued on *unpaid* obligations as of the settlement date, and add two tests: `totalPayoff` for a half-paid loan excludes already-paid interest, and the prepayment summary's before/after interest for a seeded-scale loan is within an order of magnitude of the loan's `totalInterest`. (The savings formula itself was fixed in Phase 01 Addendum A — don't regress it; its test will catch you if you do.)

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

- `interestCalculator.test.js`: `termToDays` (30 days → 30; 4 weeks → 28; months → 365/12 average); `annualizeRate` — per_annum passthrough; per_term month-terms (25, 1 month → 300; 20, 6 months → 40); per_term day-terms (25, 30 days → 25 × 365/30); per_period (2, monthly → 24; 1, weekly → 52).
- `loanCalculations.test.js` — **the Manifi shape, exact:** a `flat_rate` + `per_term` 25% + term 30 `days` loan of 10,000 → `totalInterest` exactly 2,500, `totalAmount` 12,500, schedule is a **single installment** of 12,500 due exactly 30 days after the anchor date (assert the date with `addDays`, not a month offset); a `per_annum` + month-term control case asserting numbers byte-identical to current expectations (backward-compatibility proof); a week-term case (e.g. 12 weeks, weekly frequency → 12 installments, last due exactly 84 days after anchor).
- Prepayment on a single-installment day-term loan: `recalculateSchedule` with `remainingTerm` 1 does not divide by zero and produces a sane single installment for both strategies.
- New settlement test (in `prepayment.test.js` or a new file): after early settlement, remaining installments are `waived`, `getSummary().remainingBalance === 0`, and `totalPaid` includes the settlement amount exactly once.
- Disbursement-anchor test: create loan (application date D0), disburse at D0+14d, assert first `dueDate` is one frequency-period after disbursement (or term-end for the single-installment shape), and `endDate` equals the last installment's `dueDate`.

### Step 8 — Client functional minimum

`CreateProductDialog.jsx` / `EditProductDialog.jsx`: add a "Rate basis" `<Select>` (options: Per annum / Per term / Per period, default Per annum) and a "Term unit" `<Select>` (Days / Weeks / Months, default Months) wired into the existing form state and submit payloads — visually consistent with the existing method select, no new styling. The term min/max/default inputs keep working unchanged (they're interpreted in the selected unit — update their labels from "(months)" to reflect the selected unit if the label is a plain string). Nothing else client-side.

### Step 9 — Verify & close out

1. Full suite green (previous count + new tests).
2. Manual: **configure the real Manifi product** — `flat_rate`, `per_term`, rate 25, term `{min: 30, max: 30, default: 30, unit: 'days'}` — then apply + approve + disburse a 10,000 loan against it → schedule shows a single installment of exactly 12,500 due exactly 30 calendar days after **disbursement**; settle a seeded active loan early → summary shows balance 0, no corrupted totals.
3. Update `CLAUDE.md` Sections 3/6 as applicable; changelog entry (include the counter-seeding deploy step and note the Manifi product configuration values). Commit; merge green.

## Acceptance criteria

1. Suite green with all new tests from Step 7.
2. The Manifi product computes interest = principal × 0.25 exactly, entered as rate 25 with a 30-**day** term — **not** 300, **not** term "1 month" — with a single installment due exactly 30 calendar days after disbursement, regardless of which month the loan lands in.
3. Existing `per_annum` month-term loans/tests produce byte-identical numbers to pre-phase (control case proves it); `termUnit`/`rateBasis` defaults mean untouched data behaves identically.
4. Post-disbursement schedules anchor to `disbursedAt`; `endDate` = last due date.
5. Early-settled loans report `remainingBalance` 0 and honest `totalPaid`; no installment claims `paid` with amount 0.
6. `grep -n "debugSchedule\|\.\.\.existing code" server` → 0 hits.

## Session sizing

**Two sessions**, possibly three now that term units are in scope. Session A: Steps 1–3 + 3b + the rate/schedule tests from Step 7 (rate basis + term units end-to-end), commit green — if Step 3b's `_recalculate*` threading runs long, it is the safe deferral: commit generation-side term units green and open session A2 for the recalculators. Session B: Steps 4–6, 8, remaining tests, verification. Every stopping point leaves the app working.

## Rollback

Revert the merge commit. Schema additions are additive (`rateBasis` has a default; `waived` extends an enum) so old code reading new data is safe *except*: loans settled post-phase will have `waived` installments that pre-phase code's enum rejects **on next save**. If a rollback happens after real settlements occurred, run a one-off `updateMany({'repaymentSchedule.status':'waived'}, ...)` mapping `waived`→`paid` first (accepting the old corruption), or preferably roll forward instead. The counters collection is inert to old code.

## Flagged concerns

- ~~Assumptions 1 & 2 (anchor date, `waived` settlement)~~ **Confirmed by William 2026-07-04** — locked in `docs/DECISIONS.md`, no longer assumptions.
- ~~Pending Manifi terms~~ **Confirmed via Clement 2026-07-04**: flat rate, 25%, fixed 30-day term. Configured as data in Step 9.2; verify it matches Acceptance 2's math before the first real loan.
- Day/week terms interact with `authorizeMinRole`-style drift risk in one spot: `isTermValid` compares raw numbers assuming loan and product share a unit — the Step 2b comment records that invariant; if products ever allow borrower-selected units, revisit.
- `simple_interest`'s recalculation path builds flat-rate-style totals (`Loan.js:1547`) that don't perfectly mirror its generation path; pre-existing, out of scope, noted for a future engine pass.
