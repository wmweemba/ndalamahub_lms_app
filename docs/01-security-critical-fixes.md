# Phase 01 — Security-Critical Fixes & Regression Repair

**Branch baseline:** `main` @ `8ad1f57` (post-merge). Create a working branch `phase/01-security-critical-fixes` off `main`.

**Verified baseline before this phase:** `cd server && pnpm test` → 133 tests, **111 pass / 22 fail**. All 22 failures are caused by the `canAcceptPrepayment()` regression (and the schedule-recalculation argument bug it masks). This phase must end at **133/133**.

## Objective

Close the single catastrophic security hole (anyone on the internet can create a `super_user`), repair the two fatal regressions from commit `531d954` (dead repayment recording, dead prepayment/settlement engine), fix the `req.user.hasPermission()` crashes that 500 the admin user-management flows, and close the latent cross-tenant write hole in the repayment route. These are the audit's four highest-severity findings; nothing else ships before they are fixed.

## Scope

Files touched (exhaustive — touch nothing else in this phase):

- `server/routes/auth.js` — remove public registration route
- `server/routes/users.js` — replace 4 `req.user.hasPermission(...)` calls; add lender-side role-assignment guard in POST `/`
- `server/routes/loans.js` — fix repayment route (scope bug + tenancy check)
- `server/models/Loan.js` — restore `canAcceptPrepayment()` return; fix `calculatePeriodInterest` call signatures in the three schedule recalculators
- `server/middleware/auth.js` — add one exported helper (`hasMinRole`)

**Out of scope** (deliberately — they come later): JWT fallback secret, token payload shapes, rate limiting, helmet/sanitization, console.log cleanup, dependency bumps (all Phase 02); role renames (Phase 03); tenancy middleware (Phase 04); rate-basis engine work and early-settlement bookkeeping (Phase 05). Do not fix other things you notice — flag them.

## Step-by-step instructions

### Step 1 — Remove the public registration endpoint

File: `server/routes/auth.js`.

Delete the entire `router.post('/register', ...)` handler (currently lines 22–164, from the `// @route POST /api/auth/register` comment through its closing `});`). Rationale, verified in this codebase:

- The client has **no** public registration page (`client/src/App.jsx` routes only `/login`; no client code calls `/api/auth/register`).
- An authenticated, role-validated creation path already exists: `POST /api/users` (`server/routes/users.js:161`, gated by `authorizeMinRole('corporate_hr')` with per-role assignment validation).

So the public endpoint is pure attack surface. Removing it (rather than gating it) is the smallest correct fix and also deletes the ghost-role `staff` branches inside it (`auth.js:114–132`).

After deleting, confirm `generateToken`/`generateRefreshToken` are still imported (they're used by `/refresh`) but remove any now-unused imports from the destructure at the top of the file (check each: `validatePassword` and `hashPasswordResetToken` are still used by reset-password; `validateEmail`, `validatePhoneNumber`, `formatPhoneNumber` were used only by register — remove them if grep confirms no other use in this file).

Verification: `grep -rn "auth/register" server client/src` returns no live code references (docs/tests references are fine); `POST /api/auth/register` returns 404.

### Step 2 — Close the lender-side gap in POST /api/users

File: `server/routes/users.js`, inside `router.post('/', ...)` (starts line 161).

The existing role-assignment validation block (lines 207–246) only constrains `corporate_admin`/`corporate_hr` callers. A `lender_admin` caller skips it entirely and can currently create a `super_user` in any company. Insert, immediately **after** the corporate block ends (after line 246) and before the username-uniqueness check:

```js
// Lender admins cannot mint platform-level accounts, and may only create
// users in their own company or their corporate client companies
if (req.user.role === 'lender_admin') {
    if (role === 'super_user') {
        return res.status(403).json({
            success: false,
            message: 'You cannot create super user accounts'
        });
    }
    const isOwnCompany = company === req.user.company.toString();
    const isClientCompany = companyDoc.lenderCompany &&
        companyDoc.lenderCompany.toString() === req.user.company.toString();
    if (!isOwnCompany && !isClientCompany) {
        return res.status(403).json({
            success: false,
            message: 'You can only create users within your own company or your corporate clients'
        });
    }
}
```

Note: `companyDoc` is already loaded at line 199. If the `Company` schema field linking a corporate to its lender is named differently than `lenderCompany`, check `server/models/Company.js` and use the actual field name; if no such field exists, **stop and flag** rather than guessing.

### Step 3 — Fix the `req.user.hasPermission()` crashes

`req.user` is a decoded JWT payload (set in `server/middleware/auth.js:14`), not a Mongoose document, so `hasPermission` doesn't exist and these routes throw 500.

3a. File: `server/middleware/auth.js`. Add this helper above `module.exports` and export it. Reuse the exact hierarchy already defined in `authorizeMinRole` (line 64):

```js
// Check whether a role meets a minimum role level (JWT-payload-safe
// replacement for the Mongoose User.hasPermission method)
const hasMinRole = (role, minRole) => {
    const roleHierarchy = {
        'super_user': 5,
        'lender_admin': 4,
        'corporate_admin': 3,
        'corporate_hr': 2,
        'lender_user': 1,
        'corporate_user': 0
    };
    return (roleHierarchy[role] ?? -1) >= (roleHierarchy[minRole] ?? Infinity);
};
```

Add `hasMinRole` to the `module.exports` object. (Note `?? Infinity` for an unknown `minRole`: an unrecognized required role must fail closed, never pass. Phase 03 will dedupe the two hierarchy copies during the rename — do not refactor `authorizeMinRole` now.)

3b. File: `server/routes/users.js`. Import it — the file's existing import from `../middleware/auth` gains `hasMinRole`. Then replace all four call sites:

- Line 116 (`GET /:id`): `!req.user.hasPermission('corporate_admin')` → `!hasMinRole(req.user.role, 'corporate_admin')`
- Line 380 (`PUT /:id/password`): same replacement
- Line 470 (`PUT /:id`): same replacement
- Line 527 (`PUT /:id`, role update): `req.user.hasPermission('corporate_admin')` → `hasMinRole(req.user.role, 'corporate_admin')`
- Line 542 (`PUT /:id`, isActive update): same as 527

Verification: `grep -n "hasPermission" server/routes/` returns nothing. (The method on the User model may stay; it's harmless there.)

### Step 4 — Fix the dead repayment-recording route

File: `server/routes/loans.js`, `router.put('/:id/repayment', ...)` (starts line 824).

**Bug:** lines 825–835 execute *before* the `try {` and reference `paymentDate`, which is only destructured at line 841 inside the try. Every call throws `ReferenceError` outside the try/catch → request hangs.

4a. Delete the entire block currently between the handler's opening `async (req, res) => {` and the `try {` (the `// Validate payment date is not in the future` block, lines 825–835).

4b. Re-insert the identical validation **inside** the try, immediately after the existing `if (!paymentDate) {...}` check (which ends at line 859):

```js
    // Validate payment date is not in the future
    const paymentDateObj = new Date(paymentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    paymentDateObj.setHours(0, 0, 0, 0);
    if (paymentDateObj > today) {
      return res.status(400).json({
        success: false,
        message: 'Payment date cannot be in the future. Please use today or a past date.'
      });
    }
```

4c. **Fix the latent cross-tenant write hole.** The route is `authorize('lender_admin')`, so the only roles that reach the handler are `lender_admin` and `super_user` — which makes the existing inner check (lines 884–891, `if (req.user.role !== 'super_user' && req.user.role !== 'lender_admin')`) dead code, and `loan.lenderCompany` is never compared. Replace that entire block with:

```js
    // Tenancy check: a lender admin may only record payments on loans
    // where their company is the lender
    if (req.user.role !== 'super_user') {
      if (!loan.lenderCompany || loan.lenderCompany.toString() !== req.user.company.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this loan'
        });
      }
    }
```

This matches the pattern already used correctly in the prepayment routes (`loans.js:1068–1082`). The `!loan.lenderCompany` guard covers legacy loans missing the ref (fail closed).

Do **not** change the route's `authorize('lender_admin')` list in this phase. Per `docs/DECISIONS.md`, recording authority is `lender_admin` + `lender_officer`; `lender_officer` is the rename of `lender_user` and is added in Phase 03 as `authorize('lender_admin', 'lender_user')` → renamed. Phase 03's document handles it.

### Step 5 — Restore `canAcceptPrepayment()`

File: `server/models/Loan.js`, method at lines 1121–1130. Commit `531d954` replaced the return statement with a stray unused line. Current (broken):

```js
loanSchema.methods.canAcceptPrepayment = function() {
  // Can only prepay active loans that haven't been settled
  if (this.earlySettlement?.settled) {
    return false;
  }

  // Can accept prepayments if loan is active or disbursed
  const acceptableStatuses = ['active', 'disbursed', 'in_arrears'];
  const paymentAmount = this.monthlyPayment || 0;
};
```

Replace the last line (`const paymentAmount = ...`) with:

```js
  return acceptableStatuses.includes(this.status);
```

(Delete the stray `const paymentAmount` line entirely; it is dead.)

### Step 6 — Fix the schedule-recalculation argument bug

Restoring Step 5 un-masks this bug, and the suite cannot go green without fixing it. `calculatePeriodInterest(principal, annualRate, startDate, endDate, accrualBasis)` (`server/utils/interestCalculator.js:92`) expects **dates**, but the recalculators pass a precomputed day *count* → `NaN` interest.

File: `server/models/Loan.js`. Three sites:

6a. `_recalculateReducingBalanceSchedule` (lines ~1440–1451). Current:

```js
    const daysInPeriod = getDaysInPeriod(
      i === 1 ? startDate : new Date(schedule[i-2].dueDate),
      currentDate,
      accrualBasis
    );

    const interest = calculatePeriodInterest(
      balance,
      annualRate,
      daysInPeriod,
      accrualBasis
    );
```

Replace both statements with a single correct call (delete the `getDaysInPeriod` statement):

```js
    const interest = calculatePeriodInterest(
      balance,
      annualRate,
      i === 1 ? startDate : new Date(schedule[i - 2].dueDate),
      currentDate,
      accrualBasis
    );
```

6b. `_recalculateSimpleInterestSchedule` (lines 1561–1572) — same bug via a different function: `calculateSimpleInterest(principal, annualRate, startDate, endDate, accrualBasis)` (`interestCalculator.js:244`) also expects dates, but receives `daysInPeriod`. Replace the `getDaysInPeriod` + `calculateSimpleInterest` pair with:

```js
    const interest = calculateSimpleInterest(
      remainingBalance,
      annualRate,
      i === 1 ? startDate : new Date(schedule[i - 2].dueDate),
      currentDate,
      accrualBasis
    );
```

6c. `_recalculateInterestOnlySchedule` (lines 1608–1619) — same transformation as 6a, keeping `remainingBalance` as the principal argument:

```js
    const interest = calculatePeriodInterest(
      remainingBalance,
      annualRate,
      i === 1 ? startDate : new Date(schedule[i - 2].dueDate),
      currentDate,
      accrualBasis
    );
```

If `getDaysInPeriod` becomes unused in `Loan.js` after this, leave the import (it may be used elsewhere in the file — check with grep; only remove from the require if truly unused).

### Step 7 — Run the suite and fix nothing else

```
cd server && pnpm test
```

Expected: **133/133 pass**. If any test still fails:

- Read the failing assertion. If the failure traces to the exact functions in Steps 5–6, iterate on those edits.
- If a failure traces to *any other* code path, **stop, do not fix it, and flag it** in your session report — it's either a pre-existing issue outside this phase's scope or a sign the plan missed something.

### Step 8 — Manual verification (server running locally against dev DB)

1. `POST /api/auth/register` with a `super_user` payload → **404** (route gone).
2. `POST /api/users` as a `lender_admin` token with `role: "super_user"` → **403**.
3. `GET /api/users/:id` (another user's ID) as `corporate_admin` → 200, as `corporate_user` → 403 (previously 500).
4. `PUT /api/loans/:id/repayment` as the loan's lender admin with a valid body → 200, installment updated (previously hung).
5. Same request with a *future* `paymentDate` → 400 with the exact message.
6. Same request with a lender-admin token from a *different* lender company → 403.
7. `POST /api/loans/:id/prepayment` (active loan, valid amount, `"reduce_term"`) → 200, recalculated schedule has no `NaN`/`null` interest values.

### Step 9 — Close out

- Update `CLAUDE.md`: Section 2 (branch merged — remove the pre-merge note), Section 3 (test script note — `pnpm test` in `server/` runs the real suite; verified), Section 6 (mark the four fixed items as resolved, keep the rest).
- Add a `changelog.md` entry.
- Commit with a message listing the four fixes; merge `phase/01-security-critical-fixes` into `main` only with a green suite.

## Acceptance criteria

1. `cd server && pnpm test` → **133 passed, 0 failed**.
2. `POST /api/auth/register` returns 404.
3. `grep -rn "hasPermission" server/routes/` → no matches.
4. Manual checks in Step 8 all behave as specified.
5. No files outside the Scope list are modified (`git diff --stat` review).

## Session sizing

Fits one focused ~1.5–2 h session. If it must be split, the safe stopping point is **after Step 3** (registration + users.js fixes are self-contained and committable with the suite still at 111/133 — the 22 failures are pre-existing). Steps 4–7 must land together (Step 5 without Step 6 makes the suite *worse* than baseline).

## Rollback

All changes are ordinary code commits on `phase/01-security-critical-fixes`; revert with `git revert <merge-commit>` on `main` if needed. No schema/data migrations in this phase. Note: rolling back re-opens the public-registration hole — if a rollback is ever needed in a deployed environment, take the deployment offline first.

## Flagged concerns / assumptions

- **Registration removal vs. gating:** `docs/DECISIONS.md` says "registration endpoint lockdown — no public role selection, no unauthenticated path to creating privileged accounts". Removing the route outright satisfies this and is safe because the client never calls it and `POST /api/users` already exists. If a public borrower self-signup is ever wanted, it should be built deliberately later (fixed role `borrower`, employer-scoped invitation) — not by resurrecting this endpoint.
- The Step 2 lender-admin guard assumes `Company.lenderCompany` is the field linking a corporate client to its lender (used the same way in `loans.js:163`). Verified in `loans.js`; execution agent should re-confirm against `server/models/Company.js` before applying.
