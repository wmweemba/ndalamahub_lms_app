# Phase 06 — User Deletion Policy & Orphan Safety

**Prerequisite:** Phases 01–05 merged; suite green. Branch: `phase/06-user-deletion-orphan-safety` off `main`.

## Objective

Enforce the locked user-deletion decision — soft-delete (`isActive: false`) is permanent for any user with loan history; hard-delete only for users with zero loan history ever — at the route level, and make every code path that dereferences a populated `applicant` safe against the orphaned loans that past hard-deletes have already created. Today, one deleted user's loan 500s the HR dashboard and the CSV export.

## Scope

- `server/routes/users.js` — DELETE route policy
- `server/routes/auth.js` — login must reject inactive users (soft-delete is meaningless without this; verified missing today)
- `server/routes/dashboard.js` — `/hr-stats` orphan crash + wrong dedupe; `/user-stats` next-payment fix
- `server/routes/reports.js` — CSV export orphan crash + a sweep of every `loan.applicant.<field>` access in the file
- `server/routes/loans.js` — same sweep (Excel schedule export and list/detail serializers)
- Tests: new `server/utils/__tests__/userDeletionPolicy.test.js`

**Out of scope:** un-deleting or repairing existing orphaned loans (list them, don't fix data); UI changes (the existing delete button keeps working — the server decides soft vs. hard).

## Step-by-step instructions

### Step 1 — Deletion policy in `DELETE /api/users/:id` (`users.js:640`)

After the existing self-deletion and company-access checks, replace the unconditional `User.findByIdAndDelete(id)` with:

```js
    const Loan = require('../models/Loan'); // move to top-of-file requires
    const hasLoanHistory = await Loan.exists({ applicant: id });

    if (hasLoanHistory) {
      // Locked policy: users with any loan history are never hard-deleted
      user.isActive = false;
      await user.save();
      return res.json({
        success: true,
        message: 'User has loan history and was deactivated instead of deleted',
        data: { deleted: false, deactivated: true }
      });
    }

    await User.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'User deleted successfully',
      data: { deleted: true, deactivated: false }
    });
```

(`Loan.exists` covers *any* loan in any status — active, completed, defaulted — per the decision's "ever had loan history".)

### Step 2 — Make soft-delete effective at login

`server/routes/auth.js` login route: after the user lookup succeeds and before password comparison, add:

```js
        if (!user.isActive) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
```

(Same generic message as other failures — don't reveal account state.) The refresh route already checks `!user.isActive` (verified); the `authenticateToken` middleware does not hit the DB, so a deactivated user's outstanding token stays valid until expiry — acceptable for now, flag in changelog as a known limit of the JWT design (the planned auth migration addresses it).

### Step 3 — Orphan-safe populate access

Find every dereference of a populated applicant: `grep -n "applicant\." server/routes/*.js server/routes/dashboard.js`. Fix pattern — never assume the populate resolved:

3a. `dashboard.js` `/hr-stats` `recentApplications` (~line 334): `applicantName: loan.applicant ? \`${loan.applicant.firstName} ${loan.applicant.lastName}\` : 'Deleted user'`.

3b. `dashboard.js` `/hr-stats` `employeesWithLoans` (~line 350) — currently `loan.applicant.toString()` on **populated** docs, which stringifies the whole document (dedupe is wrong even without orphans). Replace with:

```js
        const employeesWithLoans = [...new Set(
          companyLoans
            .map(loan => loan.applicant && (loan.applicant._id || loan.applicant).toString())
            .filter(Boolean)
        )].length;
```

3c. `reports.js` CSV export (~line 1185) and the `/active-loans`/`/overdue-loans`/`/upcoming-payments`/export builders: every `loan.applicant.firstName`-style access gets the same `loan.applicant ? ... : 'Deleted user'` guard (the `/overview` variant at ~174 already guards — use it as the pattern).

3d. `loans.js` Excel schedule export and any list/detail mapping that dereferences `applicant`, `approvedBy`, `disbursedBy`: same guard (`'Deleted user'` / `'—'` for names).

### Step 4 — `/user-stats` next payment (audit minor)

`dashboard.js` `/user-stats`: `nextPaymentDue` currently reads the first active loan found. Compute instead the earliest pending-installment `dueDate` across **all** the caller's active loans (collect `repaymentSchedule.filter(status === 'pending')` due dates over the loan set, take the min). Keep the response field names unchanged.

### Step 5 — Tests

New `server/utils/__tests__/userDeletionPolicy.test.js` (mongodb-memory-server pattern):

1. Deleting a user with a loan (any status, include a `completed` one) → user document still exists with `isActive: false`.
2. Deleting a user with zero loans → user document gone.
3. `getSummary`/dashboard-style mapping over a loan whose applicant was removed → no throw (exercise the guard helper path by simulating an orphan: create loan, hard-delete user via the collection, run the mapping code).

### Step 6 — Verify & close out

1. Suite green (previous count + 3+).
2. Manual: seed an orphaned loan (delete its user directly in Mongo) → `GET /api/dashboard/hr-stats` 200 (previously 500); CSV export 200 with "Deleted user" row.
3. Manual: DELETE a borrower with loans → 200 `deactivated: true`, login as them → 401.
4. List (don't fix) existing orphaned loans in the session report: `db.loans.aggregate` lookup against users, or a quick script — William decides what to do with them.
5. `CLAUDE.md` Section 6 update; changelog. Commit; merge green.

## Acceptance criteria

1. Suite green including the new policy tests.
2. A user with loan history cannot be hard-deleted through the API by any role (platform_admin included — the policy is absolute per the decision).
3. Orphan probes in Step 6.2 return 200s.
4. Deactivated users cannot log in.

## Session sizing

One ~1.5–2 h session. If short on time, Steps 1–2 + 5 (policy) are the committable core; the guard sweep (Steps 3–4) is a safe follow-on.

## Rollback

Revert the merge commit. No migrations. Users deactivated by the new policy stay deactivated after rollback (old code can reactivate via `PUT /:id/status`).

## Flagged concerns

- Outstanding JWTs of deactivated users remain valid up to 7 days (middleware doesn't check the DB). Accepted until the auth migration; if unacceptable for go-live, a per-request `isActive` lookup in `authenticateToken` is the stopgap — decision owed.
- The policy makes soft-delete *permanent* for loan-history users; there is deliberately no "purge" admin path. If a data-protection request (GDPR-style erasure) ever arrives, that's a new, explicitly-designed feature — not a route tweak.
