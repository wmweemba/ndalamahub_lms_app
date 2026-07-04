# NdalamaHub LMS — Pre‑Go‑Live Audit Report

Scope: Read-only audit of feature/phase-0-loan-engine (36 commits ahead of main; the entire loan engine, product catalog, prepayment, and export work exists only on this branch). Evidence verified by reading code, running the existing Jest suite, and running pnpm audit. No code was changed.

Note on the roadmap: NDALAMAHUB_MANIFI_ROADMAP.md / MANIFI_PROJECT_MASTER.md were not found in this repo or in wsm-second-brain, so I audited against the assumptions you listed plus the in-repo PRODUCTION_ROADMAP.md.

---

## Executive Summary

1. 🔴 Anyone on the internet can create a super_user account. POST /api/auth/register has no auth middleware and accepts an arbitrary role from the request body, including super_user (server/routes/auth.js:25-135). This is a total RBAC/tenancy bypass and the single most urgent finding.
2. 🔴 Recording a loan repayment is dead. PUT /api/loans/:id/repayment references paymentDate before it is in scope (server/routes/loans.js:826), throwing a ReferenceError outside the try/catch. On Express 4 the request hangs with no response. I reproduced the scope semantics in isolation to confirm. The UI's RecordPaymentDialog calls exactly this endpoint.
3. 🔴 The entire prepayment / early-settlement / schedule-recalculation feature is dead. canAcceptPrepayment() lost its return statement in commit 531d954 — it always returns undefined, so every prepayment and settlement call is rejected (server/models/Loan.js:1121-1130). 22 of 133 server tests currently fail because of this, despite commit messages and PRODUCTION_ROADMAP.md claiming "130/130 tests passing, prepayment engine operational."
4. Both fatal regressions (#2 and #3) were introduced by the same commit (531d954, the grace/moratorium commit) — consistent with the file_editing_troubleshooting_log.txt in the repo root. They look like botched automated edits, and they are committed, not just local.
5. Interest math is currently reducing-balance by default, and "flat rate" means an annualized flat rate. There is no code path that implements "interest = amount × 0.25 per 30-day term." Details in Section 3 — this materially affects the Manifi pricing conversation.
6. Arrears never happen. No code anywhere sets an installment to overdue (only tests do), and there is no cron/scheduler. So in_arrears/defaulted statuses, the overdue-loans report, and overdue dashboard metrics are permanently empty.
7. Multi-tenancy is real but hand-rolled per route, with holes. Scoping is by company ObjectId comparisons repeated in ~30 places (no middleware, no query plugin). There is no TENANT_ID concept anywhere — that roadmap assumption is aspirational. Found one cross-tenant write hole (repayment route, currently masked by bug #2) and several smaller leaks.
8. Several admin user-management endpoints 500 on use: they call req.user.hasPermission(...), a Mongoose method that doesn't exist on the decoded JWT payload (server/routes/users.js:116,380,470,527).
9. Email, cron, support tickets, and billing/subscriptions are 0% built. No email library is even installed; password reset has a // TODO: Send email and returns the reset token in the API response in dev mode.
10. Hygiene is weak for a fintech go-live: verbose console.log of tokens/user objects throughout, tokens fall back to a hardcoded 'your-secret-key' if JWT_SECRET is unset, refresh-issued tokens are unusable (wrong payload shape), no helmet/rate limiting/NoSQL-injection sanitization, and 14 high-severity vulnerable production dependencies on the server (51 total findings on the client).

---

## 1. Authentication & RBAC — ⚠️ Partial, with one 🔴 critical hole

Roles actually defined: super_user, lender_admin, corporate_admin, corporate_hr, lender_user, corporate_user — consistent across the User schema enum (server/models/User.js:46), server/constants/roles.js, and client roleUtils.js. Server-side enforcement exists via authorize/authorizeRole/authorizeMinRole middleware (server/middleware/auth.js), with super_user implicitly bypassing all of them.

Ghost roles referenced but nonexistent: client_admin (in loans.js:579,658 authorize lists and in four reports.js scoping branches) and staff (auth.js:114-131). These are dead branches with real consequences — see Sections 2 and 4.

Routes with no auth middleware at all: only the five /api/auth/* endpoints (register, login, refresh, forgot/reset-password) and /api/health. Every other route has authenticateToken. But:

- 🔴 Public registration with attacker-chosen role (auth.js:25). The role field goes straight into the User document; the enum includes super_user. Any user who knows a valid company ObjectId (every logged-in user knows their own from /auth/me) can mint a super_user. Risk if shipped: complete compromise.
- Rate limiter is created but never used. loginRateLimiter is instantiated at auth.js:20 and referenced nowhere. Login is unthrottled brute-forceable.
- Hardcoded JWT fallback secret. utils/auth.js:8,17,25 fall back to 'your-secret-key'. The auth middleware verifies with process.env.JWT_SECRET (no fallback), so a missing env var also produces a confusing split-brain state.
- Two incompatible token shapes. Login signs {id, username, role, company} (auth.js:193-208); register/refresh sign {userId} only (utils/auth.js:5-20). All route code reads req.user.id/.role/.company, so tokens issued by /register and /refresh are unusable — every authorized call fails. The refresh flow is effectively broken. ⚠️
- Login logs token payloads and user details to console (auth.js:180-212); forgot-password returns the reset token in the response body when NODE_ENV=development (auth.js:326).
- Frontend-only vs backend enforcement: page-level gating in roleUtils.js/ProtectedRoute.jsx is cosmetic (login-check only), but backend middleware is the real authority on almost all routes, so this pattern is acceptable — except where the backend checks themselves are wrong (below).

Can a corporate_user token read another company's data by hitting endpoints directly? For loans/users/companies/dashboards: no — per-route checks hold for the read paths I traced. Exceptions I could verify from code (not by live request — noted per your constraint):
- POST /api/products/:id/check-eligibility, /:id/calculate-fees, /:id/calculate-schedule have no company check — any authenticated user can probe any lender's product terms cross-tenant (products.js:334,378,477). Low sensitivity, real gap.
- GET /api/reports/companies is gated by authorizeMinRole('client_admin') — an unknown role, which resolves to required level 0, so even corporate_user/lender_user pass the gate (reports.js:897, middleware/auth.js:79). Data is still company-scoped, but the role gate is broken.
- The registration hole (#1) makes all other scoping moot until fixed.

---

## 2. Multi-Tenant Isolation — ⚠️ Partial

How it's implemented: purely ad hoc per-route logic — if (req.user.role === ...) blocks building Mongo filters or comparing loan.company/lenderCompany to req.user.company (the company ObjectId baked into the JWT at login). No middleware-level scoping, no schema plugin, no query-level default filter.

TENANT_ID: does not exist. Zero hits for "TENANT" across server and client. Scoping is exclusively by company/lenderCompany ObjectId references. The roadmap's TENANT_ID=manifi env-var pattern is aspirational, not supported.

Query-by-query review of Loan/Company/User access — issues found:

| Location | Issue | Severity |
|---|---|---|
| loans.js:824-891 (record repayment) | For lender_admin (the only role that passes authorize), the inner company check is dead code (role !== 'lender_admin' is never true), and loan.lenderCompany is never compared. Lender B's admin could record payments on Lender A's loans — a cross-tenant write. Currently unreachable only because the route crashes first. | 🔴 (latent) |
| loans.js:161-164 | Lender-admin list filter overwrites filter.$or set by search — search silently broken for lender admins. | Low |
| reports.js:833,913,1026,1151 | Scoping branches check the nonexistent client_admin role, so real lender_admins fall into the else branch and get company = <lender company> — i.e., wrong/empty data rather than their portfolio (fails closed, but broken). | Medium |
| dashboard.js:16-31 | /stats spreads {company: req.user.company} into Company.countDocuments — the Company schema has no company field, so activeCompanies/activeCorporates are always 0 for non-super users. | Medium |
| system.js:11-16 | /system/info returns global user/company/loan counts to any lender_admin — minor cross-tenant metadata leak. | Low |
| reports.js:54 | /overview loads every loan in the database (with borrower populate) purely to console.log samples, regardless of caller's tenant. Not returned to the client, but a PII log leak + perf bomb. | Medium |
| loans.js:224-257 (summary) | Correctly scoped, but loan.lenderCompany.toString() will throw 500 on legacy loans missing that ref. | Low |

Correctly scoped throughout: loan detail/list/approve/disburse read paths, products CRUD, companies CRUD, users list/create, prepayment endpoints, report exports.

---

## 3. Loan Calculation Logic — ⚠️ Partial (core methods work; recalculation & lifecycle broken)

What's implemented (models/Loan.js + utils/interestCalculator.js): four methods — reducing_balance (default), flat_rate, simple_interest, interest_only — with actual/365, actual/360, and 30/360 day-count conventions and weekly/bi-weekly/monthly/quarterly frequencies. Unit tests for the calculators pass (interestCalculator.test.js, loanCalculations.test.js, graceMoratoriumSchedule.test.js).

The precise current behavior on your open client question:
- Default is amortized reducing-balance, not flat-rate. A legacy (non-product) application sets no interestCalculation.method, so it defaults to reducing_balance with the standard PMT amortization formula (Loan.js:106,605-611). Product-based loans inherit the product's method.
- Flat-rate treats the rate as an annual rate: interest = principal × (rate/100) × (termMonths/12) (interestCalculator.js:209-212). So a "25%" flat-rate loan for a 1-month term yields 2.08% interest (25%/12), not amount × 0.25. To reproduce "interest = amount × 0.25 on a 30-day loan" under the current code you'd have to enter the rate as 300% annual. Nothing in the code implements a per-term/per-30-day rate. This is the exact mismatch to resolve with Manifi before configuring their product.
- Also note there is no "30-day term" concept — term is in months (min 1), and interest for reducing-balance schedules is computed on actual days between due dates.

Schedule generation on creation: produces sequential due dates by frequency, principal/interest splits per method, status: 'pending', grace/moratorium flags. Three correctness problems:
1. Schedules are anchored to the application date, not disbursement. The schedule is generated in the pre-save hook when the loan is created (Loan.js:534), using disbursedAt || new Date() — and disbursement (loans.js:787-794) changes status/dates but never regenerates the schedule. A loan approved two weeks after application has due dates two weeks early, and endDate is separately approximated as term × 30 days.
2. Post-prepayment recalculation passes wrong arguments: _recalculateReducingBalanceSchedule calls calculatePeriodInterest(balance, rate, daysInPeriod, accrualBasis) but the function signature is (principal, rate, startDate, endDate, basis) (Loan.js:1446 vs interestCalculator.js:92) — a number lands where a date is expected → NaN interest in recalculated schedules. Same bug in the simple-interest and interest-only recalculators. This is what the 22 failing tests would have caught if the suite were green.
3. 🔴 canAcceptPrepayment() is truncated (Loan.js:1121-1130): commit 531d954 replaced return acceptableStatuses.includes(this.status) with a stray const paymentAmount = ... and no return. Confirmed by git log -L and by the test run — every prepayment/settlement path throws "Loan cannot accept prepayments in current status."

Other model-level defects: a module-scope debugSchedule array at the top of Loan.js:1 grows unboundedly across all schedule generations (memory leak) plus heavy test-only debug logging left in; loan numbers are generated via countDocuments (race → duplicate-key failures under concurrency, Loan.js:520-531); early settlement marks remaining installments paid with paidAmount: 0 (loans.js:1234-1240), which corrupts getSummary()'s totalPaid/remainingBalance math; canBeApproved() accepts a 'pending' status that isn't in the schema enum.

---

## 4. Dashboards — ⚠️ Partial

Endpoints are /api/dashboard/stats, /lender-stats, /hr-stats, /user-stats (routes/dashboard.js), matching what DashboardPage.jsx calls.

- /stats (corporate_admin+): company-scoped for users/loans, but the company counts are always 0 for non-super users (bogus filter — Section 2). ⚠️
- /lender-stats: correctly scoped to the lender + its corporate clients. Loads all portfolio loans into memory with full schedules (fine at Manifi's scale, won't scale). Handles empty tenant gracefully ($in: [] → zeros, empty arrays). ✅ mostly.
- /hr-stats: scoped correctly, but recentApplications does loan.applicant.firstName on a populated ref — since users are hard-deleted (users.js:669), an orphaned loan makes the whole dashboard 500 (dashboard.js:334). Also employeesWithLoans calls .toString() on populated applicant docs (dashboard.js:350), which does not yield IDs — the dedupe is wrong. 🔴 crash-on-orphan / wrong metric.
- /user-stats: scoped to applicant: req.user.id; empty state fine; nextPaymentDue only looks at the first active loan found, not the earliest due across loans. ⚠️ minor.
- All four handlers return error: error.message unconditionally — internal error details leak in production (unlike most other routes, which gate on NODE_ENV).
- Arrears/overdue metrics on all dashboards are permanently zero because nothing ever sets installments overdue (Section 8).

---

## 5. PDF & Excel Export — ✅ Working (with caveats)

The 0.2.50 changelog claim is verified: GET /api/reports/:type/export/:format streams real PDFKit documents and real ExcelJS workbooks with correct MIME/Content-Disposition headers — no placeholder JSON (reports.js:437-804). The per-loan repayment-schedule Excel export is also real (loans.js:16-108) and enforces the same access matrix as loan details.

Caveats:
- Scoping matches the on-screen reports ✅ — same filter construction. The separate CSV /api/reports/export route is also scoped but crashes with a 500 if any loan has a deleted applicant (reports.js:1185, unguarded loan.applicant.firstName).
- Column auto-width is computed from col.header, which is never set, so every column is the 12-char minimum — cosmetic squashing in Excel.
- Overdue-loans exports will always be empty (Section 8). PDF layout is manual x/y positioning — long names will overlap columns; no page footer/branding. I could not verify visual output without running the app.

---

## 6. Support Ticket System — ❌ Missing entirely

No ticket model, routes, or UI anywhere in the codebase. Grep hits for "support"/"ticket" are incidental words. The roadmap's assumption that this must be ported (from Chama360) is correct — it is 100% unbuilt here.

---

## 7. Subscription & Payment Flow — ❌ Missing entirely

No billing, subscription, trial, or expiry logic exists — no models, routes, middleware, or gating of any kind. The only artifact is a cosmetic <option value="stripe"> in a mock payment-settings form (SettingsPage.jsx:503) with no backend. Consequently the roadmap's "trial gating must exclude support routes" requirement has nothing to attach to yet — there is neither gating nor support routes.

---

## 8. Email Notifications / Cron — ❌ Missing entirely

- No scheduler: node-cron/agenda/bull are not in package.json and not referenced. Consequence: nothing ever transitions installments to overdue — the only writers of that status are test fixtures — so in_arrears/defaulted loan statuses, checkArrearsStatus(), the overdue report, and arrears dashboards are all dead paths.
- No email integration: Resend, nodemailer, SendGrid, etc. are neither installed nor imported. Password reset says // TODO: Send email (auth.js:320). SMTP env vars are only read back by the mock system-settings endpoint (system.js:63-69); PUT /system/settings validates and then discards input (system.js:146). The backup endpoint is also fake (system.js:166-179).

---

## 9. Environment Variables & Config — ⚠️ Partial

Actually referenced in code: server — NODE_ENV, MONGODB_URI, JWT_SECRET, PORT, CORS_ORIGIN, plus display-only SMTP_HOST/SMTP_PORT/SMTP_USER/FROM_EMAIL/FROM_NAME/ADMIN_EMAIL/ALLOWED_ORIGINS; client — VITE_API_URL only.

Mismatches vs docs:
- JWT_EXPIRE is set in the local server/.env and documented, but never read — expiry is hardcoded ('7d' access / '30d' refresh).
- README documents VITE_NODE_ENV (unused) and the SMTP block (used only by the mock settings screen). CORS_ORIGIN is used in code but absent from the local .env, so CORS currently defaults to * (server.js:15).
- There is no .env.example in the repo.

Secrets: server/.env exists locally, is gitignored, and has never been committed (checked git log --all for .env paths — clean). No live credentials found hardcoded in the repo. The two hardcoded-secret risks are the 'your-secret-key' JWT fallback (Section 1) and seed scripts (utils/seedSuperUser.js, seeder.js) that presumably contain default passwords — worth rotating any seeded accounts before go-live.

---

## 10. General Code Health — ⚠️ Partial

- Error leakage: most routes correctly gate error.message behind NODE_ENV === 'development', but all of dashboard.js and products.js return raw error.message unconditionally, and the loans Excel export does too (loans.js:106). The global handler prints stack traces to console but doesn't leak them.
- Broken admin flows (500s): req.user.hasPermission(...) doesn't exist on the JWT payload → GET /users/:id (other users), PUT /users/:id (admin edits, or self-edit including a role field), and admin password-change all throw (users.js:116,380,470,527). Note main's recent commits claim these were "fixed," but the current branch code says otherwise.
- Mobile responsiveness: real but thin — pages use a handful of sm:/md:/lg: classes each (4–8 per page); Navbar has some responsive handling. "Comprehensive mobile responsiveness" (commit 131d3c0 on main) is overstated; expect rough edges on tables/dialogs.
- Testing: server has a genuine Jest + mongodb-memory-server suite — 133 tests, currently 111 pass / 22 fail (all failures from the canAcceptPrepayment regression). No route/integration coverage of auth or tenancy. Client has zero automated tests (manual FRONTEND_TEST_PLAN.md only).
- Injection/validation: no helmet, no express-rate-limit, no express-mongo-sanitize. Query params are spread into Mongo filters unsanitized (e.g., ?status[$ne]=x operator injection on list endpoints; search goes into $regex → ReDoS potential; User.findOne({ username }) on login accepts object payloads). Impact is bounded by tenancy filters but should be closed. Hard-delete of users creates orphaned loans that crash dashboards/exports (IDOR-style checks themselves were mostly fine).
- Dead/duplicate code: LoanApplicationForm_new.jsx, ReportModal_new.jsx, an empty authStore.js, root-level debug scripts (debug_db.js, check_user_company.js), pervasive console.log of user/token data, and the // ...existing code... edit artifacts in Loan.js:2 and loans.js:14.
- Dependencies (pnpm audit): server prod deps — 14 high (path-to-regexp ReDoS via Express 4.21 chain, minimatch, tmp, qs DoS…), client prod deps — 26 high (axios 1.11 has a long CVE list incl. credential-leak issues; react-router 7.7 XSS/DoS; vite dev-server file-read). None are exotic; routine upgrades fix most.

---

## Discrepancies vs. the Roadmap

| Roadmap assumption | Ground truth |
|---|---|
| "TENANT_ID=manifi env-var pattern" | No TENANT_ID concept exists anywhere; tenancy is company-ObjectId-per-document. Adopting the env-var pattern would be new architecture, not configuration. |
| "Prepayment engine operational, 130/130 tests passing" (PRODUCTION_ROADMAP.md) | 22/133 tests fail; prepayment/settlement is fully dead at runtime (regression committed in 531d954). |
| "Complete loan lifecycle … repayment" | Repayment recording endpoint crashes/hangs on every call (same commit). |
| "Working multi-tenant architecture with RBAC" | Broadly true for reads, but public registration allows self-service super_user creation, and refresh-token flow issues unusable tokens. |
| Flat-rate "Zambian microfinance standard implemented" | Flat-rate exists but is annualized; the "25% per 30-day term" model Manifi may expect is not expressible without entering 300% annual. |
| Support tickets "to be ported from Chama360" | Correct — nothing exists here. |
| Trial/subscription gating "critical requirement" | Nothing exists; nothing to exclude support routes from yet. |
| "Mobile-responsive design" ✅ | Partially real; thin coverage. |
| "Zero automated tests" (infra section) | Understates reality in the good direction — 133 server unit tests exist; but 22 fail and there are no API/auth/tenancy tests. |

---

## Open Questions Needing a Human Decision

1. Flat-rate semantics (the live client question): Should "25%" mean 25% per annum (current code), 25% per loan term, or 25% per 30 days? The answer decides whether you fix data entry conventions (rate = 300 for the Manifi product) or change calculateFlatRateInterest to a per-term rate. The current default for non-product loans is reducing balance — is that ever intended for Manifi?
2. Schedule anchor date: should due dates be generated from disbursement (industry norm) rather than application date? Changing it affects any existing loans.
3. Tenancy model for Manifi: single shared database with company scoping (what exists) vs. the roadmap's TENANT_ID/per-tenant deployment idea. If Manifi is the only tenant on their instance, the per-instance deployment largely sidesteps the cross-tenant risks — worth deciding before spending effort hardening cross-tenant paths.
4. User deletion policy: hard delete currently orphans loans and crashes dashboards/exports. Soft-delete (isActive) vs. cascade vs. block-if-loans-exist is a policy call.
5. Who may record repayments: the route says lender_admin only, the dead inner check implies corporate roles were once intended. Confirm the intended matrix before fixing the route.
6. Early settlement bookkeeping: settled installments are marked paid with amount 0 — decide the correct accounting representation before fixing summaries.
7. main vs feature branch: the entire Phase-0 engine is unmerged (36 commits). Decide whether go-live ships from this branch (fix regressions here) or requires a merge/stabilization step first.

---

## Suggested Priority Order (input, not a plan)

1. Close the registration hole — remove public role selection / lock /register down. (Small change, catastrophic risk.)
2. Fix the two 531d954 regressions — restore canAcceptPrepayment()'s return and move the paymentDate validation inside the repayment handler; while in that route, add the missing lenderCompany tenancy check. Green tests (133/133) are the acceptance signal.
3. Fix the req.user.hasPermission crashes in users.js (blocks day-1 admin workflows for Manifi).
4. Resolve the flat-rate/rate-semantics question with Manifi, then configure/adjust the product accordingly; decide on schedule anchor date at the same time.
5. Auth hygiene bundle: remove JWT fallback secret, unify token payloads (fixes refresh), wire up login rate limiting, strip token/user console.logs, set CORS_ORIGIN.
6. Orphan-safety + arrears: guard populated-applicant access in dashboards/exports; add the missing overdue-marking job (this is also your first piece of cron infrastructure, which email reminders will need anyway).
7. Ghost-role cleanup (client_admin, staff) — fixes lender-admin reports and the reports/companies role gate.
8. Dependency bumps (axios, react-router, express-chain transitive fixes) and error-message gating in dashboard/products routes.
9. Then the genuinely new builds in roadmap order: support tickets port, email/Resend integration, subscription gating.

Two cross-cutting observations for your session planning: the failing test suite is currently your best regression tripwire — I'd treat "suite must be green" as a gate for every future session; and the 531d954 incident shows edits are landing without the tests being run, which is a process fix worth making before any of the code fixes.
