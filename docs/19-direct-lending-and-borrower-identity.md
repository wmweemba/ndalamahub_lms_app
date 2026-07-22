# Phase 19 — Direct-lending model & borrower identity (server)

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/19-direct-lending-identity`, branched from `main`.
**Session size:** one ~2h session. Stop point after Step 3.
**Read first:** CLAUDE.md §§5–7, `docs/DECISIONS.md` "Manifi launch decisions (2026-07-22)", `server/utils/tenantScope.js` (whole file — this phase changes its core resolution helper), `server/models/User.js`, `server/models/Company.js`, `server/routes/users.js` (creation + role-cap logic), `server/routes/loans.js` approve/reject routes (`:511`, `:586`).

## Objective

Make NdalamaHub support **direct-lending tenants** (lender → customer, no employer in between) as first-class configuration alongside the existing employer/payroll model, and rebuild borrower identity around **NRC** per the locked decisions: NRC required for every borrower (replaces Employee ID for direct customers, supplements it for payroll ones); email optional for borrowers (stays required+unique for staff roles).

This is a **full-stack-era phase**: server changes are in scope again (the zero-server rule was specific to the UI runway, phases 12–17). The regression bar: the whole existing suite stays green and grows — API tests are the contract.

## Ground rules

- The employer/payroll model must keep working unchanged — every behavior change below is conditional on the new config, and the existing 261-test suite plus `hotfix-regressions.test.js` must stay green untouched in meaning.
- Tenancy edits are security-sensitive: any change to `tenantScope.js` or an `authorize(...)` list gets an API test in the same commit.
- Stop-and-flag over improvisation, as always.

## Steps

### Step 1 — Lending model on the lender company

- `server/models/Company.js`: add `lendingModel: { type: String, enum: ['employer', 'direct'], default: 'employer' }` — meaningful only when `type === 'lender'` (validate: reject `lendingModel: 'direct'` on a corporate company).
- `POST /api/companies` accepts it on lender creation; `PUT` may change it only by `platform_admin` (a lender flipping its own operating model is a platform-level act).
- Client (minimal, this phase only): `CreateCompanyDialog.jsx`/`EditCompanyDialog.jsx` — when type = lender, show a "Lending model" select (Employer-based / Direct-to-customer). Nothing else client-side this phase.
- Extend `GET /api/auth/me` to include `company: { _id, name, type, lendingModel }` (populated) — later client phases key the whole Customers experience off this. Additive only; existing response fields unchanged.

### Step 2 — The `companyLenderId` fix (closes a live fail-open bug)

`server/utils/tenantScope.js` `companyLenderId()` returns `company.lenderCompany || null`; for a **lender-type** company that's `null`, so a borrower attached directly to a lender **bypasses the subscription gate** (`payingLenderId → null → next()`) and breaks product resolution. Fix centrally: if the company's `type === 'lender'`, return its own `_id`. Add API tests: a direct borrower under a `suspended` lender gets 402; under an `active` lender, product listing resolves.

### Step 3 — Approval authority matrix

`server/routes/loans.js`:

- `/approve` and `/reject`: current gate `authorize('employer_hr','employer_admin','lender_admin')`. New behavior: **add `lender_officer` to the `authorize` list**, then enforce in-handler by loan shape: if the loan is **direct** (its `company` equals its `lenderCompany`), approver must be lender-side (`lender_officer`/`lender_admin` of that lender); if **employer-model**, exactly today's rule (employer-side of the loan's company, or the loan's lender admin) — i.e. lender_officer gains approval **only over direct loans**. Fail closed.
- `/disburse` unchanged (`lender_admin` — Clement's matrix: officer approves, admin disburses; admin can do both since admin remains in the approve set).
- Loan creation (`POST /`, borrower): for a borrower whose `company` is a lender-type company, set `company = lenderCompany = that company`. Read how `lenderCompany` is currently derived and make the direct case explicit, not incidental.
- API tests (in the same commit): direct loan — officer approve 200, employer_hr of any company 403, cross-tenant officer 403, admin approve+disburse 200; employer loan — matrix unchanged (officer 403 on employer loans).

**⏸ Stop point** — commit + full suite if running long.

### Step 4 — Borrower identity: NRC-first, email-optional

`server/models/User.js`:

- Add `nrc: { type: String, trim: true, uppercase: true }` — **required when `role === 'borrower'`**, not required otherwise. Loose format validation only (digits and slashes — don't hard-pin the NRC format; flag if you find an existing convention).
- Uniqueness: **compound partial unique index `{ company: 1, nrc: 1 }`** (only where `nrc` exists). Per-company, not global — the same person may legitimately exist under two tenants, and global uniqueness would leak cross-tenant existence. Do **not** add a global unique on `nrc`.
- `email`: required + unique stays for all non-borrower roles; **optional for borrowers**. The current schema-level `unique: true` must become a **partial unique index** (unique where email exists) — this is an index migration: write `server/utils/migrations/rebuildUserIndexes.js` (drops/recreates the affected indexes; run once against dev Atlas during this phase; production is a fresh DB so it just builds correctly).
- `department`: currently required for borrowers — make it **optional for borrowers** (meaningless for direct customers; the demo already showed the client never marked it). `employeeId` stays optional at schema level; route-level: creating a **payroll** borrower (company type corporate) still accepts employeeId as today.
- `username`: unchanged mechanics. Convention (enforced in routes/UI later, not schema): borrower username = email if present, else NRC.
- `server/routes/users.js` creation path: allow lender staff (`lender_admin`, and decide-with-test `lender_officer` — yes, officers onboard walk-ins) to create `borrower` users with `company = their own lender company` **only when that company's `lendingModel === 'direct'`**; employer-model lenders keep today's rule (borrowers belong to client companies). Validation: borrower creation requires `nrc`; email optional; friendly 400s.
- API tests: NRC required for borrower create, duplicate NRC same company 400, same NRC different company OK, staff create without email OK, staff create without NRC 400, borrower-without-email login by username works.

### Step 5 — Dev-environment groundwork for later phases

Against dev Atlas (approved manual-write target): create a **direct-model test lender** (e.g. "DirectLend Test") with one lender_admin + one lender_officer + one direct borrower (NRC-only, no email), and one direct loan — the fixture set phases 20–24 verify against. Record names/logins in the changelog entry (password convention per prior phases).

## Acceptance criteria

1. A direct lender's borrower: attaches to the lender company, applies for a loan (company = lenderCompany), the loan is approvable by that lender's officer and disbursable by its admin; employer-side roles have no path to it. Employer-model behavior byte-for-byte unchanged in the suite.
2. Subscription gating holds for direct borrowers (the fail-open is closed, test-pinned).
3. NRC rules enforced exactly as the decisions log states; index migration ran cleanly on dev Atlas.
4. Full server suite green (261 + this phase's new tests — expect ~15–20 new); client suite/lint/build untouched-green.

## Close-out

Update CLAUDE.md (§2 entry; §5 note on approval matrix; §7 note the `companyLenderId` lender-self rule) and `changelog.md`; merge → `main`, push, delete branch.
