# Phase 20 — Rollover engine (server)

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/20-rollover-engine`, branched from `main` (Phase 19 merged).
**Session size:** one ~2h session — **the riskiest phase of the launch runway**; if the bookkeeping (Step 2) isn't fully test-green by end of session, stop at the documented point rather than rushing the job wiring.
**Read first:** `docs/DECISIONS.md` "Manifi launch decisions (2026-07-22)" — the rollover terms are locked there with a worked example; this doc restates them but the decisions log wins on conflict. Then read **all of** `server/models/Loan.js`'s methods (`getSummary`, `updatePaymentTracking`, `checkArrearsStatus`, `canAcceptPrepayment`, `calculateEarlySettlementAmount`, `calculateAccruedInterest`) and `server/models/LoanProduct.js` around the existing `latePayment`/penalty enums (`['none','accrued','capitalized']`, `penalty`, `penaltyRate` — dormant fields that anticipated this feature; reuse or explicitly supersede them, don't create a confusing parallel set), plus `server/jobs/markOverdueInstallments.js` and `server/jobs/scheduler.js`.

## Objective

Implement Manifi's confirmed default mechanic: an unpaid loan **rolls over** — after a 14-day grace window past the due date, the outstanding balance is capitalized as a new principal, fresh flat interest applies, and a new term begins **anchored to the previous due date**. Automatic, repeating, per-product-configurable, and stoppable only by full payment or a human marking the loan defaulted.

## The locked mechanics (encode exactly this)

- Loan K1,000 disbursed 1 Aug, 25% flat, 30-day term → K1,250 due 31 Aug.
- 31 Aug passes unpaid → loan shows overdue/in-arrears (existing machinery — visibility only; **no charge during grace**).
- Still outstanding on 14 Sep (due + 14 days) → **rollover**: new principal = outstanding balance at that moment (partial payments reduce it — Clement's formula is `new interest = outstanding × 25%`), new interest 25% of that, **new due date = previous due date + 30 days** (31 Aug → 30 Sep, *not* 14 Sep + 30). Loan returns to `active`; rollover count increments.
- Repeats each cycle indefinitely. A loan with status `defaulted` (human decision) **never** rolls; rollover never fires on `completed`/settled loans.
- Example chain: K1,250 unpaid → K1,562.50 due 30 Sep; partial K250 paid during grace → K1,000 rolls → K1,250.

## Steps

### Step 1 — Product configuration

`LoanProduct`: add an explicit `rollover` subdocument — `{ enabled: Boolean (default false), graceDays: Number (default 14), rate: inherit from the product's interestRate/rateBasis (do not add a second rate field unless the existing shape genuinely can't express "same 25% flat per term" — flag if so) }`. Reconcile with the dormant `latePayment`/`penalty` fields: if they're unused everywhere (grep), mark them deprecated in a comment and leave data intact; if referenced, stop and flag. `CreateProductDialog`/`EditProductDialog` get the enabled/graceDays fields (minimal client touch; payload shape additive only).

### Step 2 — Loan bookkeeping (the hard part — test-first)

`Loan` model:

- `rollovers: [{ date, outstandingBefore, capitalizedPrincipal, newInterest, newTotalDue, previousDueDate, newDueDate }]` and a `rolloverCount` (virtual or stored — pick one, be consistent).
- A `rollover()` instance method performing the capitalization: compute outstanding (unpaid amounts across installments, consistent with `getSummary`), mark the superseded unpaid installment(s) with a **new installment status `rolled`** (add to the enum; excluded from paid/outstanding math exactly like `waived` — audit every place `waived` is special-cased and mirror it), push a fresh single installment for the new total due at the new due date, append the history entry, and reset arrears state (loan → `active`; `checkArrearsStatus` must not immediately re-flag it — the new due date is in the future).
- Original `amount` (disbursed principal) is never mutated — reporting must always show what was actually disbursed; current exposure comes from the schedule/summary.
- Verify the interaction surfaces: `calculateEarlySettlementAmount`/prepayment on a rolled loan operate on the post-rollover schedule; `getSummary` totals are correct with `rolled` installments present.
- **Unit tests before wiring the job** (in `server/utils/__tests__/`): the worked example verbatim (1,000 → 1,250 → 1,562.50 with the exact dates), partial-payment rollover, double rollover, settlement-after-rollover, `rolled` excluded from totals, defaulted loan refuses to roll.

**⏸ Stop point** — if Step 2's tests aren't all green with time left, commit the model work and stop; Steps 3–5 are a clean resume.

### Step 3 — The job

`server/jobs/rolloverLoans.js`: find loans whose product has `rollover.enabled`, status `active`/`in_arrears`, outstanding > 0, and current due date + graceDays strictly past → call `loan.rollover()`. Sequential saves (model hooks stay in the loop, per the Phase 07 precedent). **Idempotent**: a second same-day run must do nothing (guard on the last rollover's `newDueDate` being in the future). Schedule daily in `scheduler.js` (01:30 Africa/Lusaka — after markOverdue at 01:00, which provides the in-grace visibility); `pnpm job:rollover` manual trigger (`server/jobs/runRollover.js`). Same `NODE_ENV=test`/`ENABLE_CRON` gates.

### Step 4 — Notifications & manual default

- `emailTemplates.loanRolledOver()` — sent to the borrower **if they have an email** (many won't — that's accepted; no SMS this phase), via the existing never-throws `sendEmail`.
- New route `PUT /api/loans/:id/default` — `lender_admin` only, own-tenant only (tenancy-checked), requires a reason, sets `defaulted` (which per Phase 07 rules never auto-recovers and now also stops rollover). This is the kill-switch that hands the loan to the collateral-recovery path. API tests: authority, tenancy, rollover-stops-after-default.

### Step 5 — API-level tests + dev verification

`server/tests/api/rollover.test.js`: job endpoint-level behavior via the manual runner against in-memory Mongo (grace boundary day-before/day-after, idempotency, defaulted exclusion, tenancy of the default route). Manual verification on dev Atlas: back-date the Phase 19 test lender's direct loan and run `pnpm job:rollover`; confirm the numbers match the worked example and record them in the changelog.

## Acceptance criteria

1. The worked example reproduces exactly, dates included, in both unit and manual verification.
2. Partial payments roll only the outstanding; original disbursed amount preserved; summaries/settlement math correct post-rollover.
3. Job idempotent; defaulted stops everything; employer-model products (rollover disabled) completely unaffected — full pre-existing suite green.
4. Dashboards need no change this phase (a rolled loan is `active` with a future due date — correct KPI behavior falls out naturally); the rollover-count "needs attention" surfacing lands with the client phases.

## Close-out

Update CLAUDE.md (§3 jobs list + test counts, §6 if appropriate) and `changelog.md`; merge → `main`, push, delete branch.
