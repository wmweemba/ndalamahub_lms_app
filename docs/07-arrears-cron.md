# Phase 07 — Arrears & Cron Infrastructure

**Prerequisite:** Phases 01–06 merged; suite green. Branch: `phase/07-arrears-cron` off `main`.

## Objective

Give the platform its first scheduled job. Today **nothing ever marks an installment overdue** (only test fixtures write that status), so `in_arrears`/`defaulted` loan statuses, `checkArrearsStatus()`, and the overdue-loans report are permanently-dead paths. This phase adds a daily job that transitions overdue installments and loan arrears statuses, plus the scheduler plumbing that Phase 09's email reminders will reuse.

> **Amended 2026-07-11 during execution:** the original Objective (and Step 6.2 / acceptance criterion 2) also referred to "overdue dashboard metrics" as dead paths this phase would light up. That was a planning-doc error: `server/routes/dashboard.js` has **no** arrears/overdue/defaulted fields at all — a loan this job moves to `in_arrears` drops out of `activeLoans` and appears in no dashboard count. The execution agent correctly flagged this instead of inventing dashboard fields (dashboard.js is not in this phase's Scope). The gap is recorded under Flagged concerns below as a follow-up.

## Scope

- New: `server/jobs/scheduler.js`, `server/jobs/markOverdueInstallments.js`, `server/utils/__tests__/markOverdue.test.js`
- `server/server.js` — start scheduler
- `server/models/Loan.js` — arrears de-escalation (one method edit)
- `server/package.json` — add `node-cron`
- `server/.env.example` — `ENABLE_CRON`

**Out of scope:** email/notifications (Phase 09 — the job only changes statuses), penalty/late-fee calculation (not decided; do not invent one), backfilling historical arrears beyond what the job's first run naturally produces.

## Step-by-step instructions

### Step 1 — Dependency and job module

`cd server && pnpm add node-cron`.

`server/jobs/markOverdueInstallments.js`:

```js
const Loan = require('../models/Loan');

/**
 * Mark past-due pending/partial installments overdue and update each
 * affected loan's arrears status. Idempotent — safe to run repeatedly.
 * @returns {{loansChecked: number, loansUpdated: number, installmentsMarked: number}}
 */
async function markOverdueInstallments(asOf = new Date()) {
  const startOfDay = new Date(asOf);
  startOfDay.setHours(0, 0, 0, 0);

  const loans = await Loan.find({
    status: { $in: ['active', 'in_arrears'] },
    repaymentSchedule: {
      $elemMatch: { status: { $in: ['pending', 'partial'] }, dueDate: { $lt: startOfDay } }
    }
  });

  let loansUpdated = 0;
  let installmentsMarked = 0;

  for (const loan of loans) {
    let changed = false;
    for (const installment of loan.repaymentSchedule) {
      if (['pending', 'partial'].includes(installment.status) && installment.dueDate < startOfDay) {
        installment.status = 'overdue';
        installmentsMarked += 1;
        changed = true;
      }
    }
    if (changed) {
      // pre-save hook runs updatePaymentTracking() + checkArrearsStatus()
      await loan.save();
      loansUpdated += 1;
    }
  }

  return { loansChecked: loans.length, loansUpdated, installmentsMarked };
}

module.exports = markOverdueInstallments;
```

Notes: sequential saves are fine at Manifi's scale and keep the model hooks (`updatePaymentTracking`, `checkArrearsStatus`) in the loop — do not "optimize" to `updateMany`, which would skip them. A due date is overdue once the day *after* it has begun (`< startOfDay`), so a payment due today is not overdue today.

### Step 2 — Scheduler

`server/jobs/scheduler.js`:

```js
const cron = require('node-cron');
const markOverdueInstallments = require('./markOverdueInstallments');

function startScheduler() {
  // Daily at 01:00 Zambia time
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await markOverdueInstallments();
      console.log('[cron] markOverdueInstallments:', result);
    } catch (error) {
      console.error('[cron] markOverdueInstallments failed:', error);
    }
  }, { timezone: 'Africa/Lusaka' });

  console.log('[cron] scheduler started (markOverdueInstallments daily @ 01:00 Africa/Lusaka)');
}

module.exports = startScheduler;
```

`server/server.js`: after the DB connect call, add:

```js
if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_CRON !== 'false') {
  require('./jobs/scheduler')();
}
```

Add `ENABLE_CRON=true` to `server/.env.example` with a comment ("set false to disable scheduled jobs, e.g. in one-off scripts"). Single-process assumption is fine now; when the Coolify migration happens, confirm only one server instance runs, or the job needs a lock — note this in the changelog.

### Step 3 — Arrears de-escalation

`Loan.js` `checkArrearsStatus()` (line ~1104) only escalates. Add the recovery path so a caught-up loan returns to `active`:

```js
loanSchema.methods.checkArrearsStatus = function() {
  const daysInArrears = this.calculateDaysInArrears();
  if (daysInArrears > 90) {
    this.status = 'defaulted';
  } else if (daysInArrears > 0) {
    this.status = 'in_arrears';
  } else if (this.status === 'in_arrears') {
    // all overdue installments cleared — recover
    this.status = 'active';
  }
  // 'defaulted' does NOT auto-recover; reversing a default is a human decision
};
```

Also fix the latent bug in `calculateDaysInArrears()` (line ~1091): it uses `.find(...)` (first overdue in array order) — change to the **earliest-due** overdue installment: filter overdue, take `Math.min` of due dates, then compute days. With sequential schedules `.find` happens to be earliest, but recalculated/merged schedules don't guarantee order.

Check the repayment route (`loans.js` repayment handler): when an overdue installment is fully paid it sets `status = 'paid'` and the save triggers `checkArrearsStatus` → recovery now works end-to-end.

### Step 4 — Manual trigger for operators

Add a tiny runner `server/jobs/runMarkOverdue.js` (connect via `config/db` or a direct `mongoose.connect(process.env.MONGODB_URI)`, run the job, log the result, disconnect) and a package script: `"job:overdue": "node jobs/runMarkOverdue.js"`. This is also how the first production run/backfill happens at deploy.

### Step 5 — Tests

`server/utils/__tests__/markOverdue.test.js`:

1. Loan with an installment due yesterday (`pending`) → after job: installment `overdue`, loan `in_arrears`, counters `{loansUpdated: 1, installmentsMarked: 1}`.
2. Installment due today → untouched.
3. Installment due 100 days ago → loan `defaulted`.
4. Idempotency: second run returns `{loansUpdated: 0, installmentsMarked: 0}`.
5. Recovery: mark the overdue installment paid, save → loan back to `active`.
6. `waived`/`paid` installments never transition.

### Step 6 — Verify & close out

1. Suite green (+6 tests).
2. Manual: seed a loan with a past due date, run `pnpm job:overdue`, then `GET /api/reports/overdue-loans` returns it, tenant-scoped, with correct `daysInArrears`/`missedPayments` — the first time that path has ever had data. (Dashboard overdue metrics do not exist — see the amendment note in the Objective.)
3. Boot server, confirm the `[cron] scheduler started` log; boot with `ENABLE_CRON=false`, confirm absent.
4. `CLAUDE.md` Section 6 (arrears item resolved) + note the new job in Section 3 or a new "Scheduled jobs" line; changelog (include the deploy step: run `pnpm job:overdue` once after deploy). Commit; merge green.

## Acceptance criteria

1. Suite green including all Step 5 cases.
2. Overdue-loans report shows real, tenant-scoped data after the manual run.
3. Job idempotent; today-due installments unaffected; defaulted loans don't auto-recover.
4. Scheduler startup is env-gated and absent under test.

## Session sizing

One ~1.5–2 h session. Natural stopping point if needed: Steps 1+4+5 (job + runner + tests, runnable manually) commit cleanly before Steps 2–3 (scheduler wiring + de-escalation).

## Rollback

Revert the merge commit and set `ENABLE_CRON=false` on the deployment. Data written by the job (overdue/in_arrears/defaulted statuses) is *correct data* and is not reverted; if a bad run must be undone, statuses can be reset per-loan via the repayment flow — there is no bulk revert on purpose.

## Flagged concerns

- No penalty interest / late fees are computed anywhere; if Manifi's product includes them, that's a Phase 05-style engine addition needing a product-config decision — raise with Clement alongside the rate-basis confirmation.
- `defaulted` currently has no manual un-default admin action. If operations need one, it's a small follow-on route — flag when it comes up.
- **Dashboards are blind to arrears (found during this phase's verification, 2026-07-11):** `/lender-stats` and `/hr-stats` have no `in_arrears`/`defaulted`/overdue counts, and a loan entering `in_arrears` vanishes from `activeLoans` without appearing anywhere else — so portfolio totals silently shrink as loans go overdue. Follow-up: add `inArrearsLoans` and `defaultedLoans` counts (server-side, additive response fields via the existing `tenantScope` filters; no client change until UI_SPEC). Small enough to ride along with Phase 08 or 09 as a called-out extra, or a standalone mini-pass — planner to slot it before dashboards are trusted for portfolio health.
