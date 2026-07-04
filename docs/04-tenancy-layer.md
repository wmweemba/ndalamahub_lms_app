# Phase 04 — Multi-Tenancy Scoping Layer

**Prerequisite:** Phases 01–03 merged; suite green; roles use new names. Branch: `phase/04-tenancy-layer` off `main`.

## Objective

Replace the ~30 ad-hoc, per-route company-ObjectId comparisons with one reusable scoping layer, so tenant isolation is enforced consistently and a second/third lender client can onboard **without touching this layer again** (locked decision). Shared-database multi-tenancy by company ObjectId — no `TENANT_ID` env pattern. Along the way, close the specific isolation defects the audit found: the lender-admin list-filter `$or` overwrite, the always-zero dashboard company counts, the cross-tenant product calculators, the global `system/info` counts, and the legacy-loan `lenderCompany` null-crash.

## Scope

- New: `server/utils/tenantScope.js` + `server/utils/__tests__/tenantScope.test.js`
- Migrated: `server/routes/loans.js`, `reports.js`, `dashboard.js`, `users.js`, `companies.js`, `products.js`, `system.js`
- Untouched: client (no changes), models (no schema change in this phase)

**Out of scope:** loan-engine math (Phase 05), orphan-safety around deleted users (Phase 06), any role-matrix changes (done in Phase 03). If migrating a route reveals its *authorization* (not scoping) is wrong, flag it — don't redesign it here.

## Design (build exactly this)

One module of pure, unit-testable functions. Route handlers keep their `authorize(...)` guards; the module answers only "which documents can this user see/touch". `req.user` is the JWT payload `{id, username, role, company}`.

`server/utils/tenantScope.js`:

```js
const Company = require('../models/Company');

const LENDER_SIDE_ROLES = ['lender_admin', 'lender_officer'];
const EMPLOYER_SIDE_ROLES = ['employer_admin', 'employer_hr'];

const isPlatformAdmin = (user) => user.role === 'platform_admin';
const isLenderSide = (user) => LENDER_SIDE_ROLES.includes(user.role);
const isEmployerSide = (user) => EMPLOYER_SIDE_ROLES.includes(user.role);

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  const aId = a._id ? a._id : a;
  const bId = b._id ? b._id : b;
  return aId.toString() === bId.toString();
};

/** ObjectIds of employer companies served by this lender company. */
async function clientCompanyIds(lenderCompanyId) {
  const companies = await Company.find({ lenderCompany: lenderCompanyId }).select('_id');
  return companies.map((c) => c._id);
}

/**
 * Mongo filter limiting a Loan query to the caller's tenant.
 * Returns {} for platform_admin. NOTE: returns a fragment that must be
 * combined with other criteria via $and (see mergeFilters) — never spread
 * it into an object that already has $or.
 */
async function loanScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) {
    const clients = await clientCompanyIds(user.company);
    return { $or: [{ lenderCompany: user.company }, { company: { $in: clients } }] };
  }
  if (isEmployerSide(user)) return { company: user.company };
  return { applicant: user.id }; // borrower
}

/** Combine criteria fragments without $or/$and collisions. */
function mergeFilters(...fragments) {
  const parts = fragments.filter((f) => f && Object.keys(f).length > 0);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

/** Document-level read access to a single loan. */
function canReadLoan(user, loan) {
  if (isPlatformAdmin(user)) return true;
  if (isLenderSide(user)) return idsEqual(loan.lenderCompany, user.company);
  if (isEmployerSide(user)) return idsEqual(loan.company, user.company);
  return idsEqual(loan.applicant, user.id);
}

/** Write access to repayment/prepayment/settlement — lender side only (locked decision). */
function canWriteRepayment(user, loan) {
  if (isPlatformAdmin(user)) return true;
  return isLenderSide(user) && idsEqual(loan.lenderCompany, user.company);
}

/** Mongo filter limiting a User query to the caller's tenant. */
async function userScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) {
    const clients = await clientCompanyIds(user.company);
    return { company: { $in: [user.company, ...clients] } };
  }
  return { company: user.company };
}

/** Mongo filter limiting a Company query to the caller's tenant. */
async function companyScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) return { $or: [{ _id: user.company }, { lenderCompany: user.company }] };
  return { _id: user.company };
}

/** Document-level access to a company record. */
function canReadCompany(user, company) {
  if (isPlatformAdmin(user)) return true;
  return idsEqual(company._id, user.company) || idsEqual(company.lenderCompany, user.company);
}

/** Document-level access to a loan product (products belong to lender companies). */
function canReadProduct(user, product) {
  if (isPlatformAdmin(user)) return true;
  if (isLenderSide(user)) return idsEqual(product.company, user.company);
  // employer-side users and borrowers may see products their lender offers them:
  // product.company must be the lender of the caller's company — the route
  // resolves this with companyLenderId() below.
  return null; // caller must use canAccessLenderProduct
}

/** Resolve the lender company id of an employer company (or null). */
async function companyLenderId(companyId) {
  const company = await Company.findById(companyId).select('lenderCompany');
  return company && company.lenderCompany ? company.lenderCompany : null;
}

module.exports = {
  isPlatformAdmin, isLenderSide, isEmployerSide, idsEqual,
  clientCompanyIds, loanScopeFilter, mergeFilters,
  canReadLoan, canWriteRepayment,
  userScopeFilter, companyScopeFilter, canReadCompany,
  canReadProduct, companyLenderId
};
```

Design invariants (enforce in review):
- **Fail closed.** Missing refs (`loan.lenderCompany` undefined on legacy loans) yield `false`/no access, never a throw and never access — that's what `idsEqual`'s null guard is for. This fixes the audit's `loans.js` summary 500 on legacy loans.
- **No role-name literals in routes for scoping decisions** after migration — routes ask the module.
- **Generalizable:** onboarding lender #2 = inserting a Company; nothing here changes.

## Step-by-step instructions

### Step 1 — Create the module and its tests

Write `tenantScope.js` exactly as above. Then `server/utils/__tests__/tenantScope.test.js` using the existing mongodb-memory-server pattern (copy setup from `loanProduct.test.js`), covering at minimum:

1. `loanScopeFilter`: platform admin → `{}`; lender admin of L1 → `$or` with L1 + its client companies; employer_hr → `{company}`; borrower → `{applicant}`.
2. `mergeFilters`: two fragments each containing `$or` → combined under `$and` (regression test for the search-overwrite bug).
3. `canReadLoan` / `canWriteRepayment`: cross-tenant lender (L2 admin on L1 loan) → false; `lenderCompany` missing → false (no throw); employer_admin write → false.
4. `userScopeFilter` / `companyScopeFilter` per-role shapes.

### Step 2 — Migrate `loans.js`

For each site, delete the inline block and call the module. The list below is the complete inventory for this file:

| Route (approx. line pre-edit) | Replace with |
|---|---|
| `GET /` list filter (155–177) | `const scope = await loanScopeFilter(req.user);` then build `filter` from query params (status/date/**search `$or`**) and query with `mergeFilters(filter, scope)`. **This fixes the bug where the lender-admin scope `$or` overwrote the search `$or`** — after this, a lender admin's search works. platform_admin keeps the optional `companyId`/`lenderCompanyId` query filters. |
| `GET /:id` detail access block | `if (!canReadLoan(req.user, loan)) return 403` |
| `GET /:id/summary` (240–257) | `canReadLoan` (also fixes the legacy-loan `.toString()` 500) |
| `GET /:id/repayment-schedule/export/excel` access block | `canReadLoan` |
| `PUT /:id/approve` (607–620) | employer-side must be same company; lender-side must be the loan's lender: `const ok = isPlatformAdmin(req.user) || (isEmployerSide(req.user) && idsEqual(loan.company, req.user.company)) || (isLenderSide(req.user) && idsEqual(loan.lenderCompany, req.user.company)); if (!ok) return 403;` — note this **tightens** the current code, which let any `lender_admin` from any tenant approve; flag this behavior change in the changelog. |
| `PUT /:id/reject` (690–697) | same as approve |
| `PUT /:id/disburse` (763–784) | `canWriteRepayment(req.user, loan)` (disbursement is lender-side money movement; equivalent check) |
| `PUT /:id/repayment` (block installed in Phase 01) | `canWriteRepayment` |
| `GET /:id/settlement-quote` (977–996) | read: `canReadLoan` (it's a quote, read-only) |
| `POST /:id/prepayment` (1067–1082) | `canWriteRepayment` |
| `POST /:id/early-settlement` (1177–1192) | `canWriteRepayment` |
| `GET /:id/prepayment-history` (1296–1313) | `canReadLoan` |
| `POST /` create-loan company/lender resolution | verify the applicant's company & derived `lenderCompany` come from the server-side user/company docs, not the request body; if the route currently trusts body fields for either, replace with server-derived values and flag it. |

### Step 3 — Migrate `reports.js`

Every report route builds a company filter from `req.user.role` branches (the ones repaired in Phase 03 Step 4b). Replace each with `loanScopeFilter(req.user)` (+ `mergeFilters` for the route's own criteria). Routes: `/overview`, `/active-loans`, `/overdue-loans`, `/upcoming-payments`, `/:type/export/:format`, `/loans`, `/companies`, and the CSV `/export` route. For `/companies`, use `companyScopeFilter`. Expected behavior change: lender admins get correctly scoped portfolio data everywhere (Phase 03 fixed the role string; this phase makes the filter uniform).

### Step 4 — Migrate `dashboard.js`

- `/stats` (lines 11–45): replace the bogus `{company: req.user.company}` spread into `Company.countDocuments` (Company has no `company` field — counts were always 0). New behavior: `activeCompanies`/`activeCorporates` counted with `companyScopeFilter(req.user)` merged with `{isActive: true}` (and `type: 'corporate'` for the corporates count); users counted with `userScopeFilter`; loans with `loanScopeFilter`.
- `/lender-stats`: replace its inline lender+clients filter construction with `loanScopeFilter`.
- `/hr-stats`, `/user-stats`: replace inline `company`/`applicant` filters with the module equivalents. (The orphaned-applicant crash in `/hr-stats` is Phase 06 — don't fix here, don't break it further.)

### Step 5 — Migrate `users.js` and `companies.js`

- `users.js` list (`GET /`, filter around line 64): merge `userScopeFilter` instead of inline role branches. Per-document checks in `GET /:id`, `PUT /:id`, `PUT /:id/password`, `PUT /:id/status`, `DELETE /:id` (the `req.user.company.toString() !== user.company...` comparisons): replace with `idsEqual`-based checks via a small local helper `canTouchUser(reqUser, targetUser)` = platform admin, same company, or lender-side + target in a client company (needs `clientCompanyIds`). Create-user route: keep the Phase-01 role-assignment matrix; replace only the company-membership comparisons with module calls.
- `companies.js`: list → `companyScopeFilter`; detail/update/delete → `canReadCompany` (writes additionally keep their existing `authorize` role guards).

### Step 6 — Migrate `products.js` and `system.js`

- Products CRUD already scopes by `company` — swap comparisons to `idsEqual`/`canReadProduct` for consistency.
- **Close the audit gap:** `POST /:id/check-eligibility` (334), `POST /:id/calculate-fees` (378), `POST /:id/calculate-schedule` (477) currently let any authenticated user probe any lender's product. After loading the product, add: platform admin → allow; lender-side → `idsEqual(product.company, req.user.company)`; employer-side/borrower → `idsEqual(product.company, await companyLenderId(req.user.company))`; otherwise 403.
- `system.js` `/info` (11–16): counts become tenant-scoped for non-platform admins — `User.countDocuments(await userScopeFilter(req.user))`, `Company.countDocuments(await companyScopeFilter(req.user))`, `Loan.countDocuments(await loanScopeFilter(req.user))`.

### Step 7 — Sweep and verify

1. `grep -rn "req.user.company.toString()" server/routes` → 0 hits (all comparisons now go through the module).
2. `grep -rn "role === 'lender_admin'\|role === 'platform_admin'" server/routes` → remaining hits must be *authorization* decisions (who may act), not *scoping* decisions (which documents) — justify each survivor in the session report.
3. `cd server && pnpm test` → all green (133 + new tenantScope tests).
4. Manual cross-tenant probe (requires seeding a second lender — extend `server/utils/seeder.js` with a second lender company + admin if it doesn't already create one; that seeder edit is in scope): as Lender-B admin, `GET /api/loans/:idOfLenderALoan` → 403; `GET /api/loans` returns only B's portfolio; `POST /api/products/:aProductId/check-eligibility` → 403; `GET /api/dashboard/stats` shows non-zero, B-scoped counts.

### Step 8 — Close out

Update `CLAUDE.md` Section 7 (target architecture is now the actual architecture — rewrite the section) and Section 6. Changelog entry listing the two intentional behavior changes (approve/reject tenant tightening; product calculators now tenant-checked). Commit; merge green.

## Acceptance criteria

1. Suite green including new `tenantScope.test.js` (≥ 8 new tests).
2. Greps in Step 7.1–7.2 clean/justified.
3. Manual cross-tenant probes in Step 7.4 all denied.
4. Lender-admin loan-list **search** returns matches (bug fixed); dashboard `/stats` company counts non-zero for a lender admin.
5. No client changes in the diff.

## Session sizing

**Two sessions.** Session A: Steps 1–2 (module + tests + loans.js), commit green. Session B: Steps 3–8. Each route file migration is independently committable; if session B runs long, stop at any file boundary with the suite green.

## Rollback

Revert the merge commit — no data migrations. Because behavior tightens in two places (noted above), a rollback also reverts those tightenings; nothing else to unwind.

## Flagged concerns

- `canReadProduct` returning `null` for employer-side forces routes to make the async lender check explicitly — deliberate, so nobody silently treats employer-side as denied/allowed. If the execution agent finds this awkward in practice, flag it; don't redesign silently.
- ~~The `authorizeMinRole` hierarchy quirk~~ **Resolved 2026-07-04**: the hierarchy was corrected in Phase 03 (lender roles strictly above employer roles — see `docs/DECISIONS.md`), so lender officers legitimately pass employer-gated report/dashboard routes and this layer's `loanScopeFilter` gives them lender-side scoping. No open decision remains here.
