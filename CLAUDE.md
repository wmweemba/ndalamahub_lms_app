# CLAUDE.md — NdalamaHub

**This is a living document.** It is the single file that explains the whole application — architecture, decisions, current state, and rules of engagement. Update it whenever a meaningful state change happens (a phase from `docs/` is completed, an architecture decision changes, auth is migrated, UI_SPEC lands, etc.). Do not let it drift out of sync with reality — a stale CLAUDE.md is worse than no CLAUDE.md, because it will be trusted.

**Last updated:** 2026-07-11 — Phase 08 (support ticket system) executed end-to-end on `phase/08-support-tickets`: a tenant-scoped support ticket system now exists (`server/models/Ticket.js`, `server/routes/tickets.js`, mounted at `/api/tickets`). Any authenticated user can raise a ticket; creation derives `handlerCompany` server-side (borrower/employer-side creators route to their employer's lender via `companyLenderId`; lender-side creators get `handlerCompany: null`, meaning platform-level, handled by Nexus). Tickets carry a threaded `messages[]` array (not a flat description) and an atomic `ticketNumber` counter (`TK<year><seq>`, same pattern as `loanNumber`). Visibility and handler-authority checks (`ticketScopeFilter`, `canReadTicket`, `isHandler`) are local to `tickets.js`, following the same idioms as `tenantScope.js` without being added to that module. A creator's reply reopens a `resolved` ticket to `in_progress`; `closed` is terminal except for `platform_admin`. Client: `client/src/pages/support/SupportPage.jsx` (list + new-ticket dialog + threaded detail dialog with a handler-only status select), routed at `/support`, linked from the Navbar for all roles. Suite is now 234/234 (224 + 10 new, `server/tests/api/tickets.test.js`). Full manual flow (borrower creates → handling lender admin sees/replies/resolves → borrower reply reopens; a second lender's admin gets 403) verified both via API and in the browser UI. Before this phase, the roadmap assumed porting Chama360's ticket module — investigated and deliberately not ported (see `docs/08-support-tickets.md` "Flagged concerns" and the Phase 08 changelog entry for why); built fresh per the phase doc instead, informed by a few of Chama360's patterns (status-transition table shape, resolved-timestamp-write-once rule, never-gate-support-behind-subscription rule for Phase 10).

---

## 1. What NdalamaHub is

NdalamaHub is a multi-tenant Loan Management System (LMS), built and operated by **Nexus** (William's consulting entity, acting as the platform owner). It serves multiple **lender clients** — companies that issue loans — each of which typically operates a payroll-deduction lending model against **employer companies**, whose employees (**borrowers**) receive and repay loans.

**Manifi Investments** is the first confirmed lender client. NdalamaHub is not being built for Manifi specifically — it's being built as a reusable platform that Manifi happens to be the first tenant of. Every architectural decision should hold for a hypothetical second or third lender client. If something only makes sense for Manifi, it belongs in configuration, not in code.

### Hierarchy
```
Nexus (platform owner)
  └── Lender tenants (e.g. Manifi)
        └── Employer companies (a lender's corporate clients)
              └── Borrowers (employees who apply for and repay loans)
```

---

## 2. Current state (as of this writing)

- `feature/phase-0-loan-engine` was **merged into `main`** on 2026-07-04 (clean fast-forward, `main` @ `8ad1f57`). All work now happens against `main`.
- A full pre-go-live audit has been completed and lives at `docs/AUDIT_REPORT.md`. It found several critical issues (see Section 6) that must be fixed before any client-facing use. **Do not treat the app as production-ready until those are resolved.** The audit's original baseline (133 server tests, 111 pass / 22 fail, all failures from the `canAcceptPrepayment` regression) is historical — that regression was fixed in Phase 01, and the suite has been 133/133 since the Phase 01 merge (`0ef9b50`). Phases 02 and 03 are also complete. See `docs/AUDIT_REPORT.md` for the original pre-fix figures.
- Locked decisions from the planning session live at `docs/DECISIONS.md`. Treat that file as authoritative — this CLAUDE.md summarizes it, but `DECISIONS.md` is the source of truth if they ever disagree (and if they do, that's a bug in this file — fix it).
- Phased execution plans **have been generated**: `docs/01-security-critical-fixes.md` through `docs/10-subscription-gating.md`, indexed in `docs/README.md`, plus `docs/03b-api-test-scaffold.md` (an API/route-level test scaffold and tenant-isolation regression baseline, inserted between 03 and 04). Phases 01–03, 03b, and 04–08 are executed; 09–10 have not been. Claude Code executing a phase must follow that phase's document exactly — see Section 11 (Working Rules) before touching code.
- Pre-existing roadmap/planning documents (PRODUCTION_ROADMAP, WEEK_* summaries, etc.) were archived to `docs/archive/` and must not be used as planning input.

---

## 3. Tech stack

- **Monorepo**: root / `client` / `server`, pnpm workspaces-style (not formal pnpm workspaces — root `package.json` just runs `client` and `server` concurrently via `concurrently`)
- **Package manager**: pnpm (`pnpm@10.12.1` pinned in `packageManager` field — respect this, don't use npm/yarn)
- **Backend**: Node.js, Express 4.21.2 (do not upgrade to Express 5.x — this was previously tried and reverted due to a `path-to-regexp` compatibility issue), Mongoose 8.x, MongoDB (currently Atlas, migrating — see Section 4)
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod, React Router 7
- **Auth**: JWT (`jsonwebtoken`, `bcryptjs`) — see Section 8, this is planned to change
- **Testing**: Jest 30 on the server, 234 tests total. 179 are model/utility tests under `server/utils/__tests__/` (133 pre-existing model tests, 17 for `server/utils/tenantScope.js` added in Phase 04, 20 added in Phase 05 for `annualizeRate`/`termToDays`, the Manifi rate-basis/term-unit shape, waived-settlement bookkeeping, and the accrued-interest fix, 3 added in Phase 06 for the user-deletion policy and the orphan-applicant populate guard, and 6 added in Phase 07 for `markOverdueInstallments()` (overdue/in_arrears/defaulted transitions, idempotency, recovery, waived/paid non-transition) — instantiate models/call the scoping module directly, using `mongodb-memory-server` only where a real DB lookup is needed). Since Phase 03b, Supertest and `mongodb-memory-server` are also exercised by 55 API-level tests under `server/tests/api/`, which hit the live Express app (`server/app.js`) over HTTP against a real (in-memory) MongoDB — these exercise route handlers, `authorize`/`authorizeMinRole` chains, and per-route tenancy checks, including 10 added in Phase 08 (`tickets.test.js`) for handler-company routing, the visibility matrix, status-change authority, and the reply-reopens-a-resolved-ticket behavior. Note: Phase 08's doc specified the ticket tests' path as `server/utils/__tests__/tickets.test.js`, but since they're Supertest/HTTP tests (not unit tests calling models directly), they were placed under `server/tests/api/` instead, consistent with the Phase 03b convention — a deliberate deviation from the doc, not an oversight. A `test.failing` entry (none currently exist) marks a known, deliberately-unfixed defect the test suite pins rather than hides. No client-side automated tests exist yet.
- **Scheduled jobs**: `server/jobs/scheduler.js` (built Phase 07) runs `markOverdueInstallments()` (`server/jobs/markOverdueInstallments.js`) daily at 01:00 Africa/Lusaka via `node-cron`; started from `server/server.js` unless `NODE_ENV=test` or `ENABLE_CRON=false`. Manual/operator trigger: `pnpm job:overdue` (`server/jobs/runMarkOverdue.js`) — also how the first production backfill happens post-deploy. Single-process assumption only; if the Coolify migration ever runs more than one server instance, this job needs a lock to avoid double-running.
- **Exports**: PDFKit, ExcelJS — confirmed working end-to-end (not placeholders)

### Test command — resolved
The placeholder-test-script concern was based on a stale pre-merge snapshot. Post-merge, `server/package.json` has `"test": "jest"` (plus `test:watch`, `test:coverage`), and `cd server && pnpm test` was verified to run the real test suite on 2026-07-04 (133 tests then; 224 as of Phase 07). Treat `pnpm test` in `server/` as the regression gate. Since Phase 03b, `server.js` is a thin bootstrap (dotenv/env fail-fast/`connectDB()`/`app.listen()`); the actual Express app lives in `server/app.js` and is what the API tests import — `pnpm start`/`pnpm dev` behavior is unchanged.

---

## 4. Environments & deployment

- **Current**: local development, with hosting believed to be split across Render/Railway (backend) and Vercel (frontend) — verify exact current setup before assuming, since William isn't fully certain of the current split.
- **Target**: migrating to a Coolify-managed Hetzner VPS, using a MongoDB service already running on Coolify. This migration is expected once the audit-fix phases are complete — not before. **After that migration, the current Atlas cluster (`ndalamahub-prod`) remains in service as the permanent dev/staging database** (confirmed by William, 2026-07-10) — it is not decommissioned. This means Atlas is a legitimate target for manual phase-verification writes (seeded test data, one-off scripted checks) without needing to ask each time; just don't treat anything in it as real user data.
- No secrets, connection strings, or credentials belong in this file, in commit messages, or in any doc committed to the repo. Reference environment variable **names** only (e.g. `MONGODB_URI`, `JWT_SECRET`). See `docs/AUDIT_REPORT.md` Section 9 for the current inventory of env vars actually used vs. documented.
- `server/.env.example` and `client/.env.example` exist (added in Phase 02) — names and placeholder comments only, no real values. Server required vars: `MONGODB_URI`, `JWT_SECRET` (server exits at boot if either is missing); optional: `PORT`, `NODE_ENV`, `CORS_ORIGIN`. Client: `VITE_API_URL`. Note: `JWT_EXPIRE` still exists in the local `server/.env` but is unused dead config — safe to delete whenever convenient.

---

## 5. Roles

Roles were renamed and reordered in Phase 03 (2026-07-09) — this table is current reality across schema, middleware, routes, client, and the database (migrated via `server/utils/migrations/renameRoles.js`).

| Role | Level | Scope |
|---|---|---|
| `platform_admin` | Platform (5) | Nexus-level. Manages all lender tenants and platform-wide settings. |
| `lender_admin` | Lender tenant (4) | Manages one lender's operation: products, staff, employer clients, disbursement. |
| `lender_officer` | Lender tenant (3) | Loan officer. Processes applications, records repayments, manages assigned portfolios. |
| `employer_admin` | Employer client (2) | Runs an employer account — manages that employer's users and settings. |
| `employer_hr` | Employer client (1) | Reviews/approves employee loan applications. Read-only on repayment data. |
| `borrower` | Individual (0) | Employee applying for and repaying loans. |

The hierarchy is a deliberate reorder from the original planning-era numbering — lender roles sit strictly above employer roles (locked decision, `docs/DECISIONS.md`, "Role hierarchy correction"). The old names (`super_user`, `corporate_admin`, `corporate_hr`, `corporate_user`, `lender_user`) and the two ghost roles (`client_admin`, `staff`) no longer exist anywhere in code or data — do not reintroduce them.

**Repayment recording authority**: `lender_admin` and `lender_officer` only. Employer-side roles are read-only on repayment/schedule data — this is enforced server-side (route guards + tenancy checks in `server/routes/loans.js`), not just hidden in the UI.

---

## 6. Known critical issues (from `docs/AUDIT_REPORT.md`)

These are non-negotiable, phase-1 fixes — not up for reprioritization against feature work:

- ~~Public registration accepts an attacker-chosen role, including the top-level admin role (total RBAC bypass)~~ — **Fixed in Phase 01** (`server/routes/auth.js`: `/register` route removed; `server/routes/users.js`: lender-admin role-assignment guard added)
- ~~Repayment recording endpoint is dead (throws on every call)~~ — **Fixed in Phase 01** (`server/routes/loans.js`: validation block moved inside `try`, cross-tenant write hole closed via `loan.lenderCompany` check)
- ~~Prepayment/early-settlement engine is dead (regression from commit `531d954`)~~ — **Fixed in Phase 01**: `Loan.canAcceptPrepayment()` return statement restored, the three schedule-recalculator argument-order bugs fixed, and (via Addendum A) `calculateEarlySettlementAmount()`'s savings formula corrected to count all unpaid installments' interest, not just future-dated ones. Suite is 133/133.
- ~~Several admin user-management endpoints 500 due to a non-existent method being called on the JWT payload~~ — **Fixed in Phase 01** (`server/middleware/auth.js`: added `hasMinRole` helper; `server/routes/users.js`: replaced 5 `req.user.hasPermission()` call sites)
- ~~Two ghost roles (`client_admin`, `staff`) referenced in dead code paths that don't exist in the schema~~ — **Fixed in Phase 03**: `client_admin` sites in `server/routes/loans.js` (approve/reject) and `server/routes/reports.js` (four lender-portfolio scoping branches plus the `GET /reports/companies` `authorizeMinRole` gate, which had resolved to level 0 — a broken open gate — and now requires `lender_admin`) replaced with the correct real role; `staff` was already removed with the register route in Phase 01
- ~~No cron/scheduler exists — arrears/overdue status never triggers, ever~~ — **Fixed in Phase 07**: see the new entry below
- ~~Hardcoded JWT fallback secret, unused rate limiter, inconsistent token payload shapes breaking refresh~~ — **Fixed in Phase 02**: `server/utils/auth.js` and the `/refresh` route no longer fall back to `'your-secret-key'` (server now fails fast at boot if `JWT_SECRET`/`MONGODB_URI` are unset); access/refresh tokens now share a canonical `{id, username, role, company}` payload, fixing the previously-unusable refresh flow; the existing per-username login rate limiter is wired up (5/15min) alongside a broader `express-rate-limit` backstop on `/api/auth` (50/15min)
- ~~No `helmet`, `express-rate-limit`, or `express-mongo-sanitize`~~ — **Fixed in Phase 02**: all three added to `server/server.js`; `express-mongo-sanitize` closes the `?status[$ne]=x`-style operator-injection class on list endpoints
- ~~14 high-severity vulnerable server dependencies, 26 on the client~~ — **Server fixed in Phase 02**: `pnpm audit --prod` on the server now shows 0 vulnerabilities (via `pnpm update` + a `pnpm.overrides` pin on transitive `uuid`). Client: `axios`/`react-router-dom`/`vite` bumped within current majors, but several high/moderate findings remain — all transitive dev-build-tool dependencies (`rollup`, `picomatch`, `postcss`, `esbuild` via `@tailwindcss/vite`→`vite`, plus `form-data` via `axios`) not yet resolved; see `changelog.md` Phase 02 entry

Full detail, evidence, and file/line references are in `docs/AUDIT_REPORT.md` — don't duplicate that detail here, just be aware it exists and gates everything else. Phase 01 (register/RBAC/repayment/prepayment fixes plus the settlement-savings fix) and Phase 02 (auth/platform hardening, all items above) are both merged into `main`. All security-baseline items from the original audit are now resolved.

**Found during Phase 03b planning and hotfixed same day (2026-07-10, directly on `main` at William's direction, outside a numbered phase):** two critical authorization defects neither the audit nor phases 01–03 had caught: (1) `PUT /api/loans/:id/approve` and `/reject` skipped the tenancy check entirely for `lender_admin` callers, letting a lender admin of one tenant approve/reject another lender's pending loans — now requires `loan.lenderCompany` to match the caller's company (fail-closed if `lenderCompany` is missing); (2) `PUT /api/users/:id` had no role-escalation cap on its role-update branch (unlike `POST /api/users`, which got one in Phase 03), letting an `employer_admin` promote a same-company user to `lender_admin` or `platform_admin` — now enforces the same `hasMinRole(caller, targetRole)` rule with a 403. Loan *reads* were never affected (list/detail/summary/export already checked `lenderCompany`). Phase 03b added API regression tests pinning both fixes (`server/tests/api/hotfix-regressions.test.js`); Phase 04's route migration preserved these semantics (verified green throughout).

**Closed in Phase 04 (multi-tenancy scoping layer, 2026-07-10):** several tenant-isolation gaps the audit had flagged as part of the "no middleware, ad-hoc checks" problem are now fixed as a side effect of the migration onto `server/utils/tenantScope.js` — the lender-admin list-filter `$or` overwrite (search silently broken for lender admins), the always-zero dashboard company/user counts (`dashboard.js` `/stats` was building a bogus `{company: req.user.company}` filter against the `Company` model, which has no `company` field), cross-tenant probing of another lender's product via `POST /:id/check-eligibility`, `/calculate-fees`, `/calculate-schedule`, the global (unscoped) counts on `GET /api/system/info`, and the legacy-loan `lenderCompany` null-crash on `GET /:id/summary`. See Section 7.

**Left unmigrated in Phase 04 (not in the phase doc's explicit route list, flagged during execution rather than silently included):** `PATCH /api/users/:id/reset-password`, `GET /api/reports/users`, and three `products.js` routes (`/available`, `/category/:category`, `/stats/overview`) still use the pre-Phase-04 ad-hoc company/role comparison pattern. These are correctness-neutral (no known bug), just inconsistent with the new module — worth folding into a small follow-up pass.

**Newly noted in Phase 02 (not fixed, flagged for a future phase):** the `express-mongo-sanitize` fix correctly strips injected Mongo operators (e.g. `$ne`) from query params, but on `GET /api/loans` this leaves `filter.status` as an empty object, which Mongoose then fails to cast, producing a 500 instead of a graceful filtered/empty result. The security property holds (no operator injection, not all loans returned) but the endpoint doesn't validate the shape of the `status` query param.

**Closed in Phase 05 (loan rate engine rebuild, 2026-07-10):** the implausible ~21 million prepayment-summary interest figure flagged during Phase 01 Step 8 verification is fixed — root cause was `Loan.calculateAccruedInterest()` summing interest from every `paid` installment ever recorded (not just outstanding ones), which inflated both the early-settlement quote and the prepayment `beforeInterest`/`afterInterest` figures on any loan with payment history. Now only counts interest on installments that are still outstanding (not `paid`, not `waived`) and past due. Also closed in this phase: schedules were anchored to application date instead of disbursement date (`server/routes/loans.js` disburse route now calls `calculateLoanDetails()` to regenerate the schedule against `disbursedAt`, and sets `endDate` to the last installment's real due date instead of a `term × 30 days` approximation); early-settled loans marked remaining installments `paid` with `paidAmount: 0`, corrupting `getSummary()` totals (now marked `waived`, with the settlement amount counted once via `loan.earlySettlement.settlementAmount`); interest rate was hardcoded as annualized and term as months-only, which could not represent Manifi's confirmed 25%-flat-rate/30-day-term product without day-count drift (rate basis and term unit are now configurable per product/loan — see Section 7). Loan-number generation also moved from a `countDocuments`-based scheme (race-prone under concurrent creates) to an atomic `counters` collection increment — **deploy note:** before this code goes live anywhere with existing loan data, seed that environment's `counters` collection for the current year to the current max sequence, e.g. `db.counters.updateOne({_id: "loanNumber-2026"}, {$set: {seq: <max existing LN2026#### suffix>}}, {upsert: true})`, or new loan numbers will collide with existing ones.

**Closed in Phase 06 (user deletion policy & orphan safety, 2026-07-11):** `DELETE /api/users/:id` (`server/routes/users.js`) previously hard-deleted unconditionally for any caller with `employer_hr`-or-above access, contradicting the locked decision that users with any loan history are never hard-deleted. It now checks `Loan.exists({ applicant: id })` first — if true, the user is deactivated (`isActive: false`) instead, for every caller role including `platform_admin`; only users with zero loan history are hard-deleted. Login (`server/routes/auth.js`) was also found not to check `isActive` at all, meaning soft-delete had no actual effect on a deactivated user's ability to log in — fixed by rejecting deactivated users with the same generic "Invalid username or password" message used for other login failures. Separately, orphaned loans from *past* hard-deletes (predating this fix) were already corrupting reads: `GET /api/dashboard/hr-stats` 500'd on any populated `loan.applicant` that no longer resolved, its `employeesWithLoans` dedupe count was also wrong even without orphans (stringifying the whole populated document instead of just the id), and the CSV/report export in `server/routes/reports.js` had the same crash risk. All now guard with `loan.applicant ? ... : 'Deleted user'` (matching the pre-existing pattern already used in `/reports/overview`). `dashboard.js` `/user-stats`'s `nextPaymentDue` was also fixed to take the earliest pending-installment due date across *all* the caller's active loans, not just the first active loan found. **Known limitation, accepted for now:** a deactivated user's outstanding JWT remains valid until it expires (up to 7 days) — `authenticateToken` doesn't hit the DB per request. The planned auth migration (Section 8) is expected to address this; a per-request `isActive` lookup would be the stopgap if unacceptable before then. Nine pre-existing orphaned loans were found on the Atlas dev database during verification (listed, not repaired, per this phase's explicit scope) — see `changelog.md` Phase 06 entry for the loan numbers.

**Closed in Phase 07 (arrears & cron infrastructure, 2026-07-11):** the platform's first scheduled job now exists. `server/jobs/markOverdueInstallments.js` finds loans (`active`/`in_arrears`) with `pending`/`partial` installments past due, flips those installments to `overdue`, and saves each loan (the pre-save hook's `updatePaymentTracking()`/`checkArrearsStatus()` then handle the status transition) — sequential saves by design, not `updateMany`, so the model hooks stay in the loop. `server/jobs/scheduler.js` runs it daily at 01:00 Africa/Lusaka via `node-cron`, started from `server/server.js` unless `NODE_ENV=test` or `ENABLE_CRON=false`; `pnpm job:overdue` (`server/jobs/runMarkOverdue.js`) is the manual/operator trigger, also used for the first production backfill after deploy. `Loan.checkArrearsStatus()` (previously escalate-only) now also recovers `in_arrears` → `active` once no installments remain overdue (`defaulted` never auto-recovers — reversing a default is a human decision); `calculateDaysInArrears()`'s latent bug — using `.find()` (array-order-dependent) instead of the earliest-due overdue installment — was also fixed. **Flagged, not fixed (out of this phase's scope):** verification found `server/routes/dashboard.js`'s `/lender-stats` and `/hr-stats` have no `in_arrears`/`defaulted`/overdue counters at all — a loan entering `in_arrears` simply vanishes from every dashboard count (it drops out of `activeLoans` and isn't counted anywhere else), so portfolio totals silently shrink as loans go overdue. `docs/07-arrears-cron.md` was amended in-flight to record this as a planning-doc error (the original Objective/acceptance criteria wrongly assumed dashboard overdue metrics existed) and lists it as a follow-up (`inArrearsLoans`/`defaultedLoans` counts, additive, via the existing `tenantScope` filters) to slot into Phase 08/09 or a standalone mini-pass before dashboards are trusted for portfolio health. **Deploy note:** run `pnpm job:overdue` once, manually, immediately after this code goes live in any environment with existing loan data, to backfill arrears status for installments that are already overdue.

---

## 7. Multi-tenancy

Built in Phase 04 (2026-07-10). Shared-database multi-tenancy by company ObjectId (not per-tenant deployment); no `TENANT_ID` env-var pattern. Onboarding a second or third lender client is just inserting a `Company` document — nothing in this layer changes.

**`server/utils/tenantScope.js`** is the single reusable scoping module. Route handlers keep their `authorize`/`authorizeMinRole` guards for *who may call this route*; the module answers *which documents that caller may see or touch*:

- `loanScopeFilter(user)` / `userScopeFilter(user)` / `companyScopeFilter(user)` — Mongo filter fragments for list queries, scoped by role (platform admin → `{}`; lender-side → their company + client companies; employer-side → their company; borrower → their own records).
- `mergeFilters(...fragments)` — combines filter fragments via `$and`, so a route's own criteria (e.g. a search `$or`) never collides with the scope filter's `$or`. This is the fix for the pre-Phase-04 bug where a lender admin's scope filter silently overwrote their search filter on `GET /api/loans`.
- `canReadLoan(user, loan)` / `canWriteRepayment(user, loan)` / `canReadCompany(user, company)` / `canReadProduct(user, product)` — document-level access checks. `canWriteRepayment` is lender-side-only (repayment/prepayment/settlement recording authority, per Section 5). Missing refs (e.g. `loan.lenderCompany` on a legacy loan) fail closed (`false`), never throw.
- `clientCompanyIds(lenderCompanyId)` / `companyLenderId(companyId)` — helpers resolving the lender↔employer relationship in either direction.

Migrated onto this module: `server/routes/{loans,reports,dashboard,users,companies,products,system}.js`. `users.js` additionally has a local `canTouchUser(reqUser, targetUser)` helper (platform admin, same company, or lender-side with target in a client company) for its per-user document checks. `products.js` has a local `canAccessLenderProduct(user, product)` wrapping `canReadProduct` to resolve the employer-side/borrower case via `companyLenderId` (the eligibility/fees/schedule probe endpoints — previously unscoped, now tenant-checked).

**Not yet migrated** (pre-existing ad-hoc pattern, no known bug, just inconsistent — see Section 6): `PATCH /api/users/:id/reset-password`, `GET /api/reports/users`, `products.js`'s `/available`, `/category/:category`, and `/stats/overview` routes.

New ad-hoc company-ObjectId comparisons should not be added anywhere in `server/routes/` going forward — use the module.

---

## 8. Auth

**Current**: custom JWT implementation (`jsonwebtoken` + `bcryptjs`). As of Phase 02, the known critical issues from the security baseline (Section 6) are fixed: no hardcoded fallback secret, fail-fast on missing `JWT_SECRET`/`MONGODB_URI`, unified `{id, username, role, company}` token payload shared by login and refresh (refresh flow now actually works), login rate limiting wired up, and `helmet`/`express-rate-limit`/`express-mongo-sanitize` in place. Login now also returns a `refreshToken` — additive, since the client doesn't yet call `/api/auth/refresh` (still using a single long-lived access token). Tokens remain in `localStorage` (XSS-exfiltratable) and access tokens remain 7-day-lived; both are deliberately unchanged pending the auth migration below.

**Planned**: migration to a more robust, dedicated auth solution once the initial audit issues are resolved — this will support more auth methods and is expected to be cleaner than the current hand-rolled implementation. The specific library/approach hasn't been decided yet. **Do not invest in deep refactors of the current JWT internals beyond the security fixes already scoped in Section 6** — anything more elaborate will likely be thrown away in the migration. Fix what's broken/insecure now; don't build on top of it.

This section will need a real rewrite once the auth migration decision is made — flag it for an update at that point.

---

## 9. Frontend rules

**No visual or design changes to the frontend right now.** UI_SPEC decisions haven't been made yet — that comes after the audit issues are resolved. Frontend work in the meantime should be limited to functional/bug fixes (e.g., fixing a crash, wiring a broken endpoint call) — not redesigns, not new components, not styling changes, even if they seem like obvious improvements. If a phase doc requires a frontend change, it should be the minimum necessary to satisfy that phase's objective.

This restriction lifts once `docs/UI_SPEC.md` exists — update this section then.

---

## 10. Coding conventions

No formal style guide is being imposed yet — conventions may still shift (auth migration, tenancy layer, UI_SPEC), so locking in patterns now risks having to unwind them later. For now:

- Infer conventions from the existing codebase where they're consistent, and flag inconsistencies rather than silently picking one
- Respect the existing ESLint config on the client (`client/eslint.config.js`) — there's no server-side lint config yet; don't add one without discussing it first
- When a phase doc specifies an exact approach (function names, file structure, etc.), follow it exactly rather than substituting a "better" pattern — see Section 9 of the workflow rules below
- Prefer root-cause explanation and a proposed fix before making changes, rather than jumping straight to a patch — this applies to all work on this repo, not just security fixes

---

## 11. Working rules (Fable / Sonnet workflow)

This project uses a two-agent workflow:

- **Claude Code Fable** is the planning agent. It audits, investigates, and produces numbered phase documents in `docs/` (e.g. `docs/01-security-baseline.md`). It does not write production code.
- **Claude Code Sonnet** is the execution agent. It follows a phase document **exactly as written**, with no improvisation authority. If a phase document is ambiguous, incomplete, or appears wrong once execution starts, Sonnet should stop and flag it rather than filling the gap with its own judgment.

If you are Claude Code operating in this repo and there is no specific phase document driving the current task, ask which phase document to follow, or whether this is genuinely a new, undocumented task — don't assume free rein just because CLAUDE.md exists.

Every phase document is expected to be sized to fit a single ~1.5–2 hour focused session, with explicit stopping/resume points if it can't be. Don't try to compress multiple phases into one sitting even if it seems achievable — the phase boundaries exist on purpose.

The test suite (234 server tests as of Phase 08 — 179 model/utility tests plus 55 API-level tests, including the 10 added for tickets in `server/tests/api/tickets.test.js`; `docs/AUDIT_REPORT.md` Section 10 records the original pre-fix baseline of 111 passing, since fixed in Phase 01) is the standing regression check. Treat "suite is green" as a gate before considering any phase complete, once the test-command issue in Section 3 is resolved. From Phase 04 onward, `server/tests/api/hotfix-regressions.test.js` specifically is the regression gate for the two 2026-07-10 authorization fixes — any route migration must keep it green.

---

## 12. Document maintenance

Update this file when:
- A phase document from `docs/` is completed and changes something described here (roles, tenancy, auth, security posture)
- A locked decision in `docs/DECISIONS.md` changes or a new one is added
- The auth migration decision is made
- `docs/UI_SPEC.md` is created and the frontend restriction in Section 9 lifts
- The Coolify/Hetzner migration happens (update Section 4)

When updating, edit the relevant section directly rather than appending a changelog at the bottom — this file should always describe current reality, not a history of it. (History belongs in `docs/DECISIONS.md`, `docs/AUDIT_REPORT.md`, and git history.) Do update the "Last updated" line at the top each time.
