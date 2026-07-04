# Phase 03 — Role Rename Migration

**Prerequisite:** Phases 01–02 merged; suite green. Branch: `phase/03-role-rename` off `main`.

## Objective

Rename all roles to the locked, industry-standard names from `docs/DECISIONS.md`, **correct the role hierarchy** so lender roles sit strictly above employer roles (locked decision 2026-07-04 — the old ordering placing `lender_user` below employer roles was an oversight), remove the two ghost roles (`client_admin`, `staff`) by replacing the logic keyed on them with correct real roles, extend repayment-recording authority to `lender_officer` (locked decision), and migrate existing database documents. After this phase, no old role string exists anywhere in code or data.

The corrected hierarchy (used everywhere a level number appears in this phase):

| Level | New role | (old role, old level) |
|---|---|---|
| 5 | `platform_admin` | `super_user`, 5 |
| 4 | `lender_admin` | `lender_admin`, 4 |
| 3 | `lender_officer` | `lender_user`, **1** |
| 2 | `employer_admin` | `corporate_admin`, **3** |
| 1 | `employer_hr` | `corporate_hr`, **2** |
| 0 | `borrower` | `corporate_user`, 0 |

This is a deliberate **reorder**, not just a renumbering — and because `authorizeMinRole()` compares by these numbers, Step 5b audits every call site so the reorder changes access only where intended.

| Old | New |
|---|---|
| `super_user` | `platform_admin` |
| `lender_admin` | `lender_admin` *(unchanged)* |
| `lender_user` | `lender_officer` |
| `corporate_admin` | `employer_admin` |
| `corporate_hr` | `employer_hr` |
| `corporate_user` | `borrower` |
| `client_admin` *(ghost)* | replaced per Step 4 |
| `staff` *(ghost)* | already deleted with the register route in Phase 01 |

## Scope

Server: `models/User.js`, `constants/roles.js`, `middleware/auth.js`, `routes/{auth,users,companies,loans,reports,dashboard,system,products}.js`, `utils/seedSuperUser.js`, `utils/seeder.js`, `utils/testLoanModel.js`, `utils/__tests__/prepaymentAPI.test.js`, plus a new migration script `server/utils/migrations/renameRoles.js`.

Client (string/logic changes only — **zero** visual changes): `src/utils/roleUtils.js` and the 11 other files that reference role strings: `components/loans/LoanApprovalActions.jsx`, `components/settings/{UserManagement,CreateUserDialog,EditUserDialog}.jsx`, `components/companies/CreateCompanyDialog.jsx`, `components/layout/Navbar.jsx`, `pages/settings/SettingsPage.jsx`, `pages/products/ProductsPage.jsx`, `pages/users/UsersPage.jsx`, `pages/reports/ReportsPage.jsx`, `pages/dashboard/DashboardPage.jsx`.

**Out of scope:** consolidating the per-route tenancy checks (Phase 04 — this phase renames strings inside them but does not restructure them); changing which roles may approve/disburse beyond what Step 4/5 specify; UI label wording changes beyond what directly displays a role string.

## Step-by-step instructions

Work server-first, then data migration, then client. The app is temporarily inconsistent mid-phase — that's fine on a branch; do not merge until all steps pass.

### Step 1 — Constants and schema

1a. `server/constants/roles.js` — replace the whole map:

```js
const ROLES = {
    PLATFORM_ADMIN: 'platform_admin',
    LENDER_ADMIN: 'lender_admin',
    LENDER_OFFICER: 'lender_officer',
    EMPLOYER_ADMIN: 'employer_admin',
    EMPLOYER_HR: 'employer_hr',
    BORROWER: 'borrower'
};
```

1b. `server/models/User.js:46` — schema enum becomes `['platform_admin', 'lender_admin', 'lender_officer', 'employer_admin', 'employer_hr', 'borrower']`; default `'borrower'`. Line 58–60 `department` required-function: `this.role === 'borrower' || this.role === 'employer_hr'`. Lines 104–115 `hasPermission` hierarchy: rename keys **and apply the corrected levels** from the Objective table (platform_admin 5, lender_admin 4, lender_officer 3, employer_admin 2, employer_hr 1, borrower 0).

### Step 2 — Middleware

`server/middleware/auth.js`:
- `authorize` (line 32) and `authorizeRole` (line 50): `'super_user'` → `'platform_admin'` in the implicit-bypass comparisons.
- `authorizeMinRole` hierarchy map (lines 64–71) and the Phase-01 `hasMinRole` helper: rename keys and apply the **corrected levels** from Step 1b (this moves `lender_officer` from level 1 to level 3 — the deliberate reorder). While here, **dedupe**: define the hierarchy once as a module-level `const ROLE_HIERARCHY = {...}` and have `authorizeMinRole` and `hasMinRole` both read it. This is the only structural change permitted in this file. The access consequences of the reorder are audited in Step 5b — do not skip it.

### Step 3 — Mechanical server rename

Across `server/routes/*.js`, `server/utils/seedSuperUser.js`, `server/utils/seeder.js`, `server/utils/testLoanModel.js`, `server/utils/__tests__/prepaymentAPI.test.js`, replace the exact quoted strings (both `'x'` and `"x"` forms):

- `super_user` → `platform_admin`
- `corporate_admin` → `employer_admin`
- `corporate_hr` → `employer_hr`
- `corporate_user` → `borrower`
- `lender_user` → `lender_officer`

Cautions:
- **Do not** touch the string `'corporate'` on its own — it is a *company type* (`Company.type`), not a role, and stays.
- Replace whole quoted tokens only (`grep -rn "corporate_admin" server` before and after; after = 0 hits).
- Comments/log strings that mention old names: update them too — leftover old names in comments will mislead later greps.
- Approximate current reference counts as a completeness check: `users.js` 28, `reports.js` 25, `loans.js` 24, `products.js` 17, `seeder.js` 15, `companies.js` 6, `dashboard.js` 4, `system.js` 3, `auth.js` ~2 (post-Phase-01).

### Step 4 — Ghost-role `client_admin` replacement (behavioral, not mechanical)

Four kinds of sites — replace with the **correct real role**, chosen to preserve/repair intended behavior:

4a. `server/routes/loans.js:579` and `:658` — approve/reject `authorize('corporate_hr', 'corporate_admin', 'client_admin')`. The dead `client_admin` entry plus the inner check that exempts `lender_admin` (lines 607–620) show lender admins were meant to act here. New list: `authorize('employer_hr', 'employer_admin', 'lender_admin')`.

4b. `server/routes/reports.js` scoping branches at lines ~833, ~913 (and per the audit also ~1026, ~1151 — locate every `req.user.role === 'client_admin'` in the file): these branches were meant for **lender admins** (they build the lender-portfolio filter); because the role doesn't exist, real lender admins fall into the corporate else-branch and get wrong/empty data. Change each comparison to `req.user.role === 'lender_admin'`.

4c. `server/routes/reports.js:897` — `authorizeMinRole('client_admin')` on `GET /reports/companies` resolves to level 0 (broken open gate). Change to `authorizeMinRole('lender_admin')`.

4d. After 4a–4c: `grep -rn "client_admin\|'staff'" server client/src` → 0 hits (excluding `docs/`).

### Step 5 — Repayment authority matrix (locked decision)

`docs/DECISIONS.md`: recording repayments is `lender_admin` **and** `lender_officer`; employer-side roles are read-only on repayment/schedule data.

In `server/routes/loans.js`, change the route guards on these four routes from `authorize('lender_admin')` to `authorize('lender_admin', 'lender_officer')`:
- `PUT /:id/repayment` (~line 824)
- `GET /:id/settlement-quote` (~963)
- `POST /:id/prepayment` (~1036)
- `POST /:id/early-settlement` (~1161)

Then update each route's **inner tenancy branch** so `lender_officer` takes the same lender-side path as `lender_admin`: everywhere inside those four handlers that reads `if (req.user.role === 'lender_admin') { ...lenderCompany check... }`, change the condition to `if (req.user.role === 'lender_admin' || req.user.role === 'lender_officer')`. (Phase 04 replaces these blocks wholesale; keep the edit minimal here.)

Read-only visibility for employer roles already holds on the read paths (loan details/summary/schedule export check `loan.company` against the caller) — verify by inspection, change nothing.

### Step 5a — Hierarchy reorder: close the user-creation escalation path

The reorder lets `lender_officer` (now level 3) pass the `authorizeMinRole('employer_hr')` gate on `POST /api/users` — but the route's role-assignment validation blocks only cover employer-side callers and (from Phase 01) `lender_admin`. Unpatched, an officer would skip both blocks and could create a `lender_admin` or `platform_admin`. Two changes inside `router.post('/', ...)` in `server/routes/users.js`:

1. Extend the Phase-01 lender guard's condition from `req.user.role === 'lender_admin'` to `(req.user.role === 'lender_admin' || req.user.role === 'lender_officer')` (same company/`platform_admin` restrictions apply to both).
2. Add a universal no-escalation rule immediately after the existing validation blocks, using the deduped hierarchy (import `ROLE_HIERARCHY` or compare via `hasMinRole`):

```js
        // No caller may create a user with a role above their own level
        if (!hasMinRole(req.user.role, role)) {
            return res.status(403).json({
                success: false,
                message: 'You cannot create users with a role senior to your own'
            });
        }
```

(`hasMinRole(callerRole, targetRole)` is true when caller level ≥ target level, so an officer can create employer-side users and borrowers but not `lender_admin`; a `lender_admin` can create anything below `platform_admin` — the Phase-01 explicit `super_user`/`platform_admin` block stays as belt-and-braces.)

Apply the same two-part reasoning to the other `employer_hr`-gated user-management routes the officer now reaches (`PATCH /:id/status`, `DELETE /:id`): their inner same-company checks already constrain officers to their own (lender) company's users until Phase 04 broadens them deliberately — verify by inspection, change nothing beyond Step 5a.1–2.

### Step 5b — `authorizeMinRole` effective-access audit (required)

Re-grep every call site (`grep -rn "authorizeMinRole(" server/routes`) — 21 sites as of planning; line numbers may have shifted after Phases 01–02. For **each** site, record in the session report: route, old effective role list, new effective role list. The only permitted delta, at every site, is **`lender_officer` gaining access** (the deliberate reorder) — plus the Step 4c ghost-role fix. Any other role gaining or losing access anywhere is a regression: fix it before the phase is complete.

Expected results, precomputed for verification (old levels in parentheses):

| Gate (new name) | Sites (pre-phase lines) | Old access | New access | Delta |
|---|---|---|---|---|
| `employer_hr` (was `corporate_hr`, 2→1) | dashboard.js:239; users.js:22, 161, 321, 640; reports.js:46, 252, 303, 366, 440, 1128 | corporate_hr, corporate_admin, lender_admin, super_user | + `lender_officer` | intended |
| `employer_admin` (was `corporate_admin`, 3→2) | dashboard.js:11; system.js:194; reports.js:809, 1010 | corporate_admin, lender_admin, super_user | + `lender_officer` | intended |
| `lender_admin` (4→4) | dashboard.js:72; system.js:11, 50 | lender_admin, super_user | unchanged | none |
| `platform_admin` (was `super_user`, 5→5) | system.js:103, 166 | super_user | unchanged | none |
| `lender_admin` (was ghost `client_admin` → level 0, passed everyone) | reports.js:897 | **everyone** (broken gate) | lender_admin, platform_admin | intended fix (Step 4c) |

If the grep at execution time finds a site not in this table (added by an earlier phase), audit it the same way and add it to the report.

### Step 6 — Database migration script

Create `server/utils/migrations/renameRoles.js`:

```js
/**
 * One-time migration: rename user roles to industry-standard names.
 * Usage:  node utils/migrations/renameRoles.js         (apply)
 *         node utils/migrations/renameRoles.js --down  (revert)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const UP = {
  super_user: 'platform_admin',
  lender_user: 'lender_officer',
  corporate_admin: 'employer_admin',
  corporate_hr: 'employer_hr',
  corporate_user: 'borrower'
};

async function run() {
  const down = process.argv.includes('--down');
  const mapping = down
    ? Object.fromEntries(Object.entries(UP).map(([k, v]) => [v, k]))
    : UP;

  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  for (const [from, to] of Object.entries(mapping)) {
    const { modifiedCount } = await users.updateMany({ role: from }, { $set: { role: to } });
    console.log(`${from} -> ${to}: ${modifiedCount} user(s)`);
  }

  const legacy = await users.countDocuments({ role: { $in: Object.keys(UP) } });
  console.log(down ? 'Revert complete.' : `Remaining legacy-role users (must be 0): ${legacy}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
```

Notes: the collection-level `updateMany` bypasses the schema enum on purpose (the enum only validates on save anyway, but this also avoids loading documents). Run it against the dev database during this phase; running it against the production/Atlas database happens **at deployment of this phase**, immediately before the new code goes live — record that in the changelog entry as a deploy step.

### Step 7 — Client rename

7a. `client/src/utils/roleUtils.js` — rewrite `ROLES` keys/values to match Step 1a (`PLATFORM_ADMIN: 'platform_admin'`, etc.), then update every `ROLES.X` usage in the same file (`canApproveLoan`, `canDisburseLoan`, `canAccessCompanies`, `canAccessReports`, `canAccessSettings`, `canManageUsers`, `canApplyForLoan` — `CORPORATE_USER` → `BORROWER` — `canManageProducts`, `canViewProducts`).

7b. In the 11 other client files listed in Scope, replace role strings/`ROLES.X` references the same way as Step 3 (same caution: `'corporate'` as a company type stays). Where a file *displays* a role name to the user (e.g. role dropdowns in `CreateUserDialog.jsx`/`EditUserDialog.jsx`, badges in `UsersPage.jsx`), update both the value and its human label (e.g. "Corporate HR" → "Employer HR", "Corporate User" → "Borrower") — that's a string swap, not a design change.

7c. `grep -rn "super_user\|corporate_admin\|corporate_hr\|corporate_user\|lender_user\|client_admin" client/src` → 0 hits.

### Step 8 — Verify & close out

1. `cd server && pnpm test` → 133/133. (Tests referencing old roles were renamed in Step 3 — `prepaymentAPI.test.js`, `testLoanModel.js`.)
2. Run the migration on the dev DB; verify `Remaining legacy-role users: 0`.
3. **All existing sessions are invalidated by design**: outstanding JWTs carry old role strings, so every check fails until re-login. Log in fresh as (at minimum) a `platform_admin` and a `lender_admin` seed user and click through dashboard, loans, users, reports.
4. Manual matrix spot-checks: `lender_officer` can `PUT /api/loans/:id/repayment` (own lender's loan) → 200; `employer_hr` on the same call → 403; `lender_admin` hits `GET /api/reports/loans` and gets their portfolio (previously wrong/empty data via the ghost-role branch); `GET /api/reports/companies` as `borrower` → 403 (previously passed the broken gate); `lender_officer` can `GET /api/reports/overview` → 200 (reorder consequence, intended); `lender_officer` `POST /api/users` with `role: "lender_admin"` → 403 (Step 5a no-escalation rule).
5. Update `CLAUDE.md`: Section 5 (roles table now reflects reality — remove the "until the role-rename phase executes" paragraph), Section 6 (ghost roles resolved). Changelog entry (include the production-DB migration deploy step). Commit; merge green.

## Acceptance criteria

1. Suite 133/133.
2. Greps in Steps 3, 4d, 7c return zero old/ghost role strings in `server/` and `client/src`.
3. Migration script is idempotent (second run reports 0 modifications) and `--down` restores the old names.
4. Manual matrix checks in Step 8.4 behave exactly as listed.
5. `git diff` shows no client styling/markup changes beyond role strings and their labels.
6. **Step 5b audit table is complete in the session report**: every `authorizeMinRole()` call site enumerated with old/new effective access, and the only deltas anywhere are `lender_officer` gaining access (deliberate reorder) and the reports.js:897 ghost-gate fix. Any other access change at any site is a regression that must be fixed before this phase is marked complete — not noted and moved past.
7. The Step 5a no-escalation rule holds: no role can create a user with a role level above its own (spot-checked per Step 8.4).

## Session sizing

**Two sessions.** Session A: Steps 1–6 (server + migration), commit with green suite — the client still sends old strings but the server work is verifiable via API/tests. Session B: Steps 7–8 (client + end-to-end verification). Do not deploy between A and B.

## Rollback

Code: revert the merge commit. Data: `node utils/migrations/renameRoles.js --down`. Both directions must be exercised once on the dev DB before merge (Acceptance 3).

## Flagged concerns

- ~~Hierarchy quirk~~ **Resolved 2026-07-04** (see `docs/DECISIONS.md`, "Role hierarchy correction"): lender roles now sit strictly above employer roles. The reorder's access consequences are contained by Steps 5a/5b.
- Old JWTs dying at deploy is treated as acceptable (users just re-log-in). If that's not acceptable for a live client, the deploy needs a maintenance window.
