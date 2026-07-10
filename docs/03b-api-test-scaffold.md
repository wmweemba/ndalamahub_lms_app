# Phase 03b — API Test Scaffold & Tenant-Isolation Baseline

**Prerequisite:** Phases 01–03 merged; suite green at 133/133. Branch: `phase/03b-api-test-scaffold` off `main`.

**Why "03b":** this phase was inserted after the phase index was generated. It must run **before** Phase 04 (tenancy layer), whose document already exists as `04-tenancy-layer.md`, and renumbering phases 04–10 would break the cross-references those documents make to each other. `03b` slots it into the execution order without touching any existing document's number. The final step adds it to the `docs/README.md` index between 03 and 04.

## Objective

Stand up the first tests that exercise the **live Express app over HTTP** (supertest against a real Mongo via mongodb-memory-server), and use them to pin down a **tenant-isolation regression baseline** on the current ad hoc scoping — before Phase 04 rips those ~30 per-route checks out and replaces them with the shared scoping layer.

The existing 133 tests never touch a route handler: they instantiate models and call methods/pure functions directly (no DB connection, no middleware, no auth). That means route guards, `authorize(...)` chains, and every per-route company-ObjectId comparison currently have **zero automated coverage**. Phase 04 is precisely the kind of change where a silent cross-tenant leak is catastrophic and invisible to a green suite — this phase builds the net it will run against.

This is a **targeted scaffold**, not a comprehensive API test suite. Full endpoint coverage is explicitly out of scope (see below).

## Verified current state (read before starting — several docs are wrong about this)

Facts confirmed against the code on 2026-07-10:

1. **`server/server.js` does not export `app`.** It builds the app, calls `connectDB()` at import time, and calls `app.listen()` unconditionally. It cannot be imported by a test without binding a port and dialing the real `MONGODB_URI`. A minimal app/bootstrap split is required (Step 1) — this is the only production-code change in this phase.
2. **`mongodb-memory-server` (v11) and `supertest` (v7) are installed but never used.** `CLAUDE.md` Section 3 and the audit describe the stack as "Jest + Supertest + mongodb-memory-server" — that describes the *installed devDependencies*, not reality. No existing test connects to any database. `server/utils/__tests__/prepaymentAPI.test.js` imports supertest and is named "API integration tests" but only exercises model methods; two of its "authorization" tests are literally `expect(true).toBe(true)`. Leave that file alone (it still provides model coverage); this phase supersedes its name, and the final step corrects CLAUDE.md.
3. **No `jest.config.js` exists** — Jest runs on defaults from `server/package.json` (`"test": "jest"`). Default `testMatch` picks up any `*.test.js`, so new files under `server/tests/` are discovered without config changes. A small `jest` block is added to `package.json` in Step 2 for env setup and timeout only.
4. **Token payload is canonical `{id, username, role, company}`** (Phase 02), produced by `generateToken(user)` in `server/utils/auth.js` and verified by `authenticateToken` in `server/middleware/auth.js` against `process.env.JWT_SECRET` at request time. Tests can mint valid tokens directly without going through `/api/auth/login` — do that everywhere except the login smoke tests, both for speed and to stay clear of the two login rate limiters (per-username 5/15min in `routes/auth.js`, per-IP 50/15min on `/api/auth` in `server.js`).
5. **Fixture-relevant schema requirements:** `User` requires `firstName, lastName, username (unique), email (unique), phone, password (min 6), role, company`; `department` is required when role is `borrower` or `employer_hr`; password is bcrypt-hashed (cost 12) in a pre-save hook. `Company` requires `name, type ('lender'|'corporate'), registrationNumber (unique), address.{street,city,province}, contactInfo.{phone,email}`; `lenderCompany` is required when `type === 'corporate'`. `Loan` requires `applicant, company, lenderCompany, amount, interestRate, term, purpose`; `loanNumber` is auto-generated in a pre-save hook; `canBeApproved()` accepts status `'pending'` or `'pending_approval'`.
6. **`platform_admin` users still require a `company`** (schema-level). The fixture assigns the platform admin to Lender A's company; every platform-admin code path bypasses company checks, so this is inert — but note it, don't "fix" it here.

### Cross-tenant defects found during planning — hotfixed 2026-07-10, pin them with regression tests

Two critical defects were found while reading the routes for this document and were **fixed immediately as a hotfix on `main` (2026-07-10, ahead of this phase — see `changelog.md`)**. This phase pins the fixed behavior with ordinary passing tests (Step 7) so Phase 04's wholesale replacement of these blocks cannot silently reintroduce them:

- **`PUT /api/loans/:id/approve` and `/reject`** (`server/routes/loans.js`): the inner access check used to be skipped entirely when `req.user.role === 'lender_admin'` — a lender admin of tenant B could approve/reject tenant A's pending loans. **Fixed:** lender admins now require `loan.lenderCompany` to match their company (fail-closed on missing `lenderCompany`); employer-side callers keep the existing `loan.company` check. Phase 04 Step 2 replaces this block with the `tenantScope` module call, which preserves the same semantics.
- **`PUT /api/users/:id`** (`server/routes/users.js`): the role-update branch had **no cap relative to the target role** — unlike `POST /api/users`, which Phase 03 gave a universal no-escalation rule — so an `employer_admin` could set a same-company user's role to `lender_admin` or `platform_admin`. **Fixed:** the same `hasMinRole(req.user.role, role)` cap now applies on update, returning 403 for any role senior to the caller's own.

### Inconsistencies to flag, not resolve (they inform Phase 04's design)

- `authorizeMinRole` (`server/middleware/auth.js:79–80`) uses `|| -1` / `|| 0`, so a hypothetical `authorizeMinRole('borrower')` gate would wrongly deny actual borrowers (level 0 is falsy). No route currently passes `'borrower'` (verified by grep), and `hasMinRole` already uses `??` correctly. Latent only — flag for the Phase 04/05 executor, don't change middleware here.
- `lender_officer` is lumped with `borrower` on loan read paths (`GET /api/loans`, `GET /api/loans/:id`, `/summary`, schedule export): an officer sees only loans where **they are the applicant**, i.e. effectively nothing of the portfolio they're supposed to service. Whether officers should get lender-side read scope is a Phase 04 design question (its `loanScopeFilter` already answers "yes"). Baseline tests in this phase use `lender_admin` for lender-side read assertions and do not enshrine the officer behavior either way.
- `GET /api/loans` overwrites `filter.$or`: a `search` param sets `$or`, then the `lender_admin` branch replaces it (tenancy survives, search silently dies). Already named in the Phase 04 objective; no test needed here.
- `GET /api/users/:id` denies a `lender_admin` access to their **own corporate clients'** users (flat `company` equality), while `GET /api/users` (list) and `PATCH /:id/reset-password` include client companies. Inconsistent hierarchy handling — Phase 04's problem.

If executing this phase reveals any route behaving differently from what this section describes, **stop and flag it** — do not silently adjust a test's expectation to make it pass.

## Scope

- **New:** `server/app.js`; `server/tests/helpers/{jest.env.js,db.js,fixtures.js,tokens.js}`; `server/tests/api/{smoke,loans.tenancy,users.tenancy,companies.tenancy,reports.tenancy,hotfix-regressions}.test.js`
- **Modified:** `server/server.js` (bootstrap-only after the split), `server/package.json` (jest config block), and — final step only — `CLAUDE.md`, `changelog.md`, `docs/README.md`
- **Untouched:** all route files, middleware, models, client. `git diff` on `server/routes/`, `server/middleware/`, `server/models/` must be empty at merge time (the mutation checks in Steps 5c/8 temporarily edit a route file but must be fully reverted).

**Out of scope, explicitly:**

- Full endpoint coverage of the API. Not covered here (flagged for a future phase, see "Flagged for future phases"): `products.js` (all routes), `system.js`, `dashboard.js` beyond the two stat endpoints in Step 6, `auth.js` beyond login smoke (refresh, forgot/reset-password, logout, `/me` edge cases), loan creation/disbursement/prepayment/settlement flows, export endpoints (PDF/Excel), pagination/filter/search behavior, validation error shapes.
- Fixing any defect this phase's tests document — including the two known leaks above. Tests pin them; Phase 04 fixes them.
- Client-side tests.
- Any middleware/model/route refactor beyond the `server.js` split.

## Design

### App/bootstrap split (Step 1)

`server/app.js` — everything currently in `server.js` **except** dotenv, the env fail-fast, `connectDB()`, and `app.listen()`:

```js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(require('helmet')());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('express-mongo-sanitize')());

const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));

// ... the eight app.use('/api/...') route mounts, /api/health, error handler, 404 handler
// (move verbatim from server.js — do not reorder, do not reword responses)

module.exports = app;
```

`server/server.js` shrinks to bootstrap only — **behavior identical for `pnpm start`/`pnpm dev`:**

```js
require('dotenv').config();

const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const connectDB = require('./config/db');
connectDB();

const app = require('./app');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NdalamaHub server is running on port ${PORT}`);
});
```

The env fail-fast and `connectDB()` **must stay in `server.js`** — if either moves into `app.js`, importing the app in tests would exit the process or dial the real database. Tests import `server/app.js` only, never `server/server.js`.

### Test harness (Step 2)

- `server/tests/helpers/jest.env.js` — registered as a Jest `setupFiles` entry; sets `process.env.JWT_SECRET = process.env.JWT_SECRET || 'ndalamahub-test-secret'` and `process.env.NODE_ENV = 'test'` before any module loads. Do **not** load `.env` in tests.
- `server/package.json` gains:

```json
"jest": {
  "setupFiles": ["<rootDir>/tests/helpers/jest.env.js"],
  "testTimeout": 30000
}
```

  The timeout covers mongodb-memory-server startup (it downloads a MongoDB binary on first ever run — allow that one slow run; it's cached afterwards). The existing 133 tests are unaffected by both settings — verify they still pass after adding this block.

- `server/tests/helpers/db.js` — exports `connect()` / `disconnect()` / `clear()` wrapping one `MongoMemoryServer` per test file (`MongoMemoryServer.create()` in `beforeAll`, `mongoose.connect(uri)`, teardown in `afterAll`). Jest runs files in separate workers, so per-file instances don't collide.
- `server/tests/helpers/tokens.js` — `authHeader(user)` returning `{ Authorization: `Bearer ${generateToken(user)}` }` using the real `generateToken` from `server/utils/auth.js`, so test tokens are bit-identical in shape to production tokens.
- `server/tests/helpers/fixtures.js` — exports `seedTwoTenants()` which creates, via the real Mongoose models (so hooks/validation run):

| Fixture | Details |
|---|---|
| `lenderA`, `lenderB` | `type: 'lender'`, unique `registrationNumber`, minimal valid `address`/`contactInfo` |
| `employerA`, `employerB` | `type: 'corporate'`, `lenderCompany` → their lender; also `$addToSet` into the lender's `corporateClients` |
| `platformAdmin` | role `platform_admin`, company `lenderA` (schema requires a company; all platform paths bypass it) |
| `lenderAdminA`, `lenderOfficerA` | company `lenderA` |
| `employerAdminA`, `employerHrA`, `borrowerA` | company `employerA`; `department` set on the HR and borrower |
| `lenderAdminB`, `lenderOfficerB`, `employerAdminB`, `employerHrA`-equivalent `employerHrB`, `borrowerB` | mirror of tenant A |
| `loanA` | applicant `borrowerA`, company `employerA`, lenderCompany `lenderA`, amount 10000, interestRate 24, term 6, status `'active'`, with `calculateLoanDetails()` + `generateRepaymentSchedule()` called before save so repayment installments exist |
| `loanB` | mirror in tenant B |
| `loanA_pending`, `loanB_pending` | same shape, status `'pending'` (satisfies `canBeApproved()`), no schedule needed |

  All 11 users share one known password (e.g. `'Test123!'`). Note: 11 bcrypt-cost-12 hashes ≈ 2–3s per test file — acceptable; if a file only needs a subset, the factory may accept a filter, but don't optimize prematurely.

### Conventions

- New API tests live under `server/tests/api/`, not `utils/__tests__/` — they are cross-cutting HTTP tests, not unit tests of a util. (Existing `utils/__tests__/` files stay where they are.)
- Every assertion on a denial must check **both** the status code (403, or 401 for missing/garbage tokens) **and**, for list endpoints, that the response body contains no document belonging to the other tenant (assert on IDs, not counts alone).
- Response envelope varies by router (`loans.js`/`users.js` use `{success, data}`; `companies.js` returns bare arrays/objects; `reports.js` varies). Match each route's actual shape; if a shape differs from what the route code suggests, flag it rather than loosening the assertion to `.anything()`.

## Step-by-step instructions

### Session A (~1.5–2h): app split + harness + smoke tests

**Step 1 — App/bootstrap split.** Create `server/app.js` and shrink `server/server.js` exactly as in Design. Then verify the server still boots for real: with a valid `server/.env`, run `pnpm start`, hit `GET /api/health`, expect `{"status":"OK",...}`, and confirm the missing-env fail-fast still works (`JWT_SECRET= MONGODB_URI= node server.js` must exit 1 with the error message).

**Step 2 — Harness.** Create the four helper files and the `package.json` jest block per Design. Run `pnpm test` — the existing 133 tests must still pass, unchanged.

**Step 3 — `server/tests/api/smoke.test.js`** (~7 tests):
1. `GET /api/health` → 200 without auth.
2. `GET /api/loans` with no token → 401.
3. `GET /api/loans` with a garbage token → 401.
4. `POST /api/auth/login` with seeded credentials → 200; body has `token`, `refreshToken`; decoding `token` (verify with the test secret) yields `{id, username, role, company}`.
5. `POST /api/auth/login` wrong password → 401.
6. `GET /api/auth/me` with a **minted** token → 200 and the right user — proves minted tokens are equivalent to login-issued ones, which the rest of the suite relies on.
7. Unknown route → 404.

**Stopping point / gate:** `cd server && pnpm test` → 133 old + ~7 new, all green; manual boot check from Step 1 done. Commit.

### Session B (~2h): loans + users isolation baseline

**Step 4 — `server/tests/api/loans.tenancy.test.js`** (~12 tests):

List scoping, `GET /api/loans` (assert by loan `_id` membership):
1. `platformAdmin` sees `loanA` and `loanB`.
2. `lenderAdminA` sees `loanA`, **not** `loanB`.
3. `employerAdminB` sees `loanB` only.
4. `employerHrA` sees `loanA` only.
5. `borrowerA` sees `loanA` only (own loans), not `loanB`.

Document-level, `GET /api/loans/:id`:
6. `lenderAdminA` on `loanA` → 200.
7. `lenderAdminB` on `loanA` → 403.
8. `employerAdminB` on `loanA` → 403.
9. `borrowerB` on `loanA` → 403.

Write path, `PUT /api/loans/:id/repayment` (installment 1, valid `amount`/`paymentDate`/`paymentMethod`/`referenceNumber`):
10. `lenderAdminA` on `loanA` → 200; installment reflects the payment.
11. `lenderAdminB` on `loanA` → 403 **and the loan is unchanged** — this pins the Phase 01 cross-tenant-write fix.
12. `employerAdminA` on `loanA` → 403 (role guard: employer-side is read-only on repayments — locked decision); `lenderOfficerB` on `loanA` → 403 (right role, wrong tenant).

**Step 5 — `server/tests/api/users.tenancy.test.js`** (~8 tests):
1. `GET /api/users` as `employerAdminA` → only `employerA` users (assert no B-tenant `_id` present).
2. `GET /api/users` as `lenderAdminA` → `lenderA` + `employerA` users only, none from tenant B.
3. `GET /api/users/:id` as `employerAdminA` on `borrowerB` → 403.
4. `GET /api/users/:id` as `lenderAdminA` on `borrowerA` (their own client's employee) → **currently 403** (flat company equality — see Inconsistencies). Assert 403 with a comment marking it as pinned-current-behavior that Phase 04 will revisit.
5. `POST /api/users` as `employerAdminA` with `company: employerB._id` → 403.
6. `POST /api/users` as `lenderAdminA` creating a borrower in `employerB` → 403 (not own company, not their client).
7. `PATCH /api/users/:id/status` as `employerAdminA` on `borrowerB` → 403.
8. `DELETE /api/users/:id` as `employerAdminA` on `borrowerB` → 403 and the user still exists.

**Step 5c — Mutation sanity check #1 (write path).** In `server/routes/loans.js`, temporarily comment out the tenancy block inside `PUT /:id/repayment` (the `if (!loan.lenderCompany || loan.lenderCompany.toString() !== req.user.company.toString())` check, ~line 854). Run `pnpm test`: **test 11 of Step 4 must fail** (and name it in the changelog note). Restore the line, run again, all green. If the test does *not* fail with the check removed, the test is broken — stop and fix the test before proceeding.

**Stopping point / gate:** suite green (~153+ tests); mutation check #1 performed and reverted (`git diff server/routes/` empty). Commit.

### Session C (~1.5–2h): companies + reports + known-leak pins + docs

**Step 6 — `server/tests/api/companies.tenancy.test.js`** (~6 tests) and `server/tests/api/reports.tenancy.test.js` (~6 tests):

Companies:
1. `GET /api/companies` as `lenderAdminA` → exactly `lenderA` + `employerA`.
2. `GET /api/companies` as `employerAdminA` → exactly `[employerA]`.
3. `GET /api/companies` as `borrowerA` → 403.
4. `PUT /api/companies/:employerB._id` as `lenderAdminA` → 403, document unchanged.
5. `DELETE /api/companies/:employerB._id` as `lenderAdminA` → 403, document still exists.
6. `PUT /api/companies/:employerA._id` as `employerAdminB` → 403.

Reports/dashboard (assert tenant-B data absent by ID where the response carries IDs, by count where it's aggregate):
1. `GET /api/reports/loans` as `employerAdminA` → rows reference `loanA` only.
2. `GET /api/reports/loans` as `lenderAdminB` → rows reference `loanB` only.
3. `GET /api/reports/companies` as `lenderAdminA` → `employerA` scope only, `employerB` absent.
4. `GET /api/reports/companies` as `employerAdminA` → 403 (pins the Phase 03 fix of the formerly broken-open `authorizeMinRole` gate).
5. `GET /api/dashboard/stats` as `employerAdminA` → loan counts reflect tenant A only (with two active loans total across tenants, the count must be 1).
6. `GET /api/dashboard/lender-stats` as `lenderAdminA` → tenant-A counts only.

For 5–6: read the actual response shape in `server/routes/dashboard.js` before writing assertions; if a stat turns out not to be tenant-scoped at all (the audit suspected some dashboard counts are global), **flag it in the phase-completion notes and pin it with `test.failing`** rather than asserting the leaky value as correct.

**Step 7 — `server/tests/api/hotfix-regressions.test.js`** — ordinary passing tests pinning the two defects hotfixed on 2026-07-10 (see "Verified current state"), plus the lender-side happy path so the tightened check isn't over-broad (~5 tests):
1. `PUT /api/loans/:loanA_pending._id/approve` as `lenderAdminB` → 403 and the loan stays `pending`.
2. `PUT /api/loans/:loanA_pending._id/reject` as `lenderAdminB` (with `approvalNotes`) → 403, loan unchanged. Use a fresh pending loan or re-seed between 1 and 2 so the first test's state change can't mask the second.
3. `PUT /api/loans/:loanA_pending._id/approve` as `lenderAdminA` (the loan's own lender) → 200 and status `approved` — guards against the fix over-tightening.
4. `PUT /api/users/:borrowerA._id` as `employerAdminA` with `{role: 'platform_admin'}` → 403 and the stored role is still `borrower` (no-escalation cap on update).
5. `PUT /api/users/:borrowerA._id` as `employerAdminA` with `{role: 'employer_hr'}` (at/below own level, same company) → 200 and the role changes — the cap must not block legitimate updates.

Each test gets a comment naming the original defect and the 2026-07-10 hotfix changelog entry. These are the tests that make Phase 04's rewrite of these blocks safe.

**Step 8 — Mutation sanity check #2 (read path).** In `server/routes/loans.js` `GET /:id`, temporarily replace the `lender_admin` branch's `hasAccess` assignment with `hasAccess = true`. Run the suite: Step 4's test 7 (`lenderAdminB` on `loanA` → 403) **must fail**. Restore, re-run, green, `git diff server/routes/` empty.

**Step 9 — Documentation updates (required for phase completion):**
- `CLAUDE.md`: Section 3 — correct the testing description (existing 133 tests are model/util-only; supertest + mongodb-memory-server now actually in use by the API suite under `server/tests/api/`; new total test count; note that `test.failing` entries are expected and what they mean). Section 11 — the regression gate is now "full suite green" at the new count. Update the "Last updated" line.
- `changelog.md`: Phase 03b entry — files added, test counts, both mutation checks (which line was disabled, which named test failed), and the flagged-items list below.
- `docs/README.md`: insert a `03b` row in the execution-order table between 03 and 04 (sessions: 3), and update the standing-rules line about the 133-test gate to reference the new count.
- `docs/04-tenancy-layer.md`: **do not restructure it**, but append one line to its Prerequisite: "Phase 03b merged; its API suite (including `server/tests/api/hotfix-regressions.test.js`) is the regression gate for every route migration in this phase."

**Final gate & merge:** full suite green; `git diff` limited to the files in Scope; merge `phase/03b-api-test-scaffold` into `main`.

## Acceptance criteria (all checkable)

1. `server/app.js` exists and exports the Express app; `server/server.js` contains only dotenv/env-check/connectDB/listen; `pnpm start` boots and serves `GET /api/health` exactly as before; missing-env fail-fast still exits 1.
2. The pre-existing 133 tests pass **unmodified** (zero edits to existing test files).
3. **At least 35 new tests** across the six new files, all green (`test.failing` entries count as green while the defects exist), including as named musts: Step 4 tests 2, 7, 11; Step 5 tests 1, 3; Step 6 companies test 4 and reports test 3.
4. **Mutation checks performed and documented (both):** removing the repayment tenancy check makes Step 4 test 11 fail; forcing `hasAccess = true` on `GET /loans/:id` makes Step 4 test 7 fail; both reverted, suite green after each revert. Recorded in `changelog.md` with the disabled line and the failing test names. This is the proof the baseline actually catches the regression class it exists for — a scaffold that stays green under mutation is rejected.
5. No production behavior change: `git diff main` touches nothing under `server/routes/`, `server/middleware/`, `server/models/`, or `client/`.
6. The Step 7 regression pins for the 2026-07-10 hotfix (approve/reject tenancy check; `PUT /users/:id` no-escalation cap) exist and pass, including both allow-path tests (3 and 5).
7. CLAUDE.md, changelog.md, docs/README.md, and the one-line 04-doc prerequisite update are all done.

## Flagged for future phases (do not action now)

- **Phase 04 (tenancy layer):** the `GET /users/:id` lender-vs-client-company inconsistency; the `GET /api/loans` `$or` overwrite; `lender_officer` having no portfolio read scope; the `authorizeMinRole` falsy-zero (`|| -1`) latent bug — recommend Phase 04's executor switches it to `??` while replacing scoping call sites, since the middleware is in scope there. (The approve/reject cross-tenant bypass and the `PUT /users/:id` escalation hole were hotfixed 2026-07-10 — Phase 04's migration of those blocks must preserve, not re-derive, that behavior; Step 7's regression tests enforce this.)
- **Future test-coverage phase (unscheduled):** everything in "Out of scope" — products/system/dashboard routes, auth flows beyond login, loan lifecycle (create→approve→disburse→repay→settle) as an end-to-end API test, export endpoints, validation shapes, the `?status[$ne]=x` 500 (documented in CLAUDE.md Section 6). The scaffold built here (app export, db helper, fixture factory, token helper) is the foundation that phase builds on.
- **Housekeeping:** `server/routes/loans.js.backup` and root-level `check_user_company.js` / `debug_db.js` are stray files noticed during planning — candidates for deletion in any convenient phase.
