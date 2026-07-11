# 2026-07-11 (Phase 08 execution)
- Executed `docs/08-support-tickets.md` on branch `phase/08-support-tickets`, single session (server + client)
- **Chama360 port question, resolved before writing code**: the phase doc flagged up front that the roadmap assumed porting this from Chama360, but Chama360's source wasn't in this workspace. Per William's direction, the actual Chama360 scaffold was located in the separate `wsm-second-brain` repo (`systems/NS-005-in-app-support-system.md` + `scaffold/support-feature/`). Reviewed it and determined it solves a different problem: it's a flat `SupportRequest` doc (single description, no thread) for a single-admin inbox with external notification fan-out (Telegram/Resend/Twilio) — it has no concept of routing a ticket up a lender/employer/platform hierarchy, which is the core requirement here. Decided (with William's sign-off) not to port it; built fresh per the Phase 08 doc instead, carrying over three patterns as implementation guidance: the status-transition table shape, the "write `resolvedAt`/`resolvedBy` only on the first transition" audit rule, and the hard rule that the ticket-submit route must never be gated by subscription/trial middleware (relevant to Phase 10).
- **Step 1**: added `server/models/Ticket.js` — `messages[]` threaded conversation (not a flat description field), `company`/`handlerCompany` for tenant routing, atomic `ticketNumber` counter (`TK<year><seq>`, same `counters` collection pattern as `loanNumber`).
- **Step 2**: added `server/routes/tickets.js`, mounted at `/api/tickets` in `server/app.js` (the doc said `server/server.js`, but routes have lived in `app.js` since Phase 03b's thin-bootstrap split — mounted there instead, consistent with current architecture). Visibility (`ticketScopeFilter`), document-level read access (`canReadTicket`), and handler-authority (`isHandler`) are local helper functions built on `tenantScope.js` primitives (`isPlatformAdmin`, `isLenderSide`, `isEmployerSide`, `idsEqual`, `canReadLoan`, `companyLenderId`) rather than added to that shared module, since they're ticket-specific. Routing rule implemented exactly as specified: borrower/employer-side creators get `handlerCompany` = their company's lender (via `companyLenderId`); lender-side creators get `handlerCompany: null` (platform-level). A reply from the creator on a `resolved` ticket reopens it to `in_progress`; `closed` is terminal except for `platform_admin`.
- **Step 3**: added `server/tests/api/tickets.test.js` (10 tests: handler-company routing for both creator types, ticketNumber uniqueness under concurrent creates, the visibility matrix — colleague borrower denied/employer_hr allowed/other lender's admin denied/handling lender's admin allowed — status-change denied to creator and allowed to handler, and reply-reopens-a-resolved-ticket). Deviated from the doc's specified path (`server/utils/__tests__/tickets.test.js`) since these are Supertest/HTTP tests, not unit tests — placed under `server/tests/api/` instead, matching the Phase 03b convention. Added `createUser` to `server/tests/helpers/fixtures.js` exports (was previously internal-only) since the visibility tests needed a second borrower in the same company. Suite is now 234/234 (224 + 10 new).
- **Step 4**: added `client/src/pages/support/SupportPage.jsx` (list, new-ticket dialog, threaded detail dialog with a handler-only status `Select`), routed at `/support` in `App.jsx`, linked from `Navbar.jsx` for all roles (desktop + mobile). Used existing shadcn primitives (`Card`, `Dialog`, `Badge`, `Select`, `Textarea`, `Button`, `Input`, `Label`) with TanStack Query for data fetching — the doc said to reuse `UsersPage.jsx`'s TanStack Query patterns, but `UsersPage.jsx` actually uses plain `useState`/`useEffect`, not TanStack Query; used TanStack Query anyway since `QueryClientProvider` is already wired at the app root (`main.jsx`) and it's a better fit for this page's mutations (create/reply/status-update) than manual refetch wiring.
- **Step 5 verification**: server suite green (234/234). Client builds clean (`pnpm build`). Full manual flow verified twice — once via direct API calls (curl) and once end-to-end in the browser: `john_employee` (borrower, TechCorp) creates a ticket → correctly routes to `handlerCompany` = FirstBank Lending; `manager` (FirstBank `lender_admin`, the correct handler) sees it, replies, resolves it; `john_employee`'s reply reopens it to `in_progress`; `james_admin` (a different lender's admin) gets 403 on the same ticket. Unauthenticated `GET /api/tickets` → 401. Confirmed in-browser: ticket list, new-ticket dialog, threaded detail view, and the handler-only status dropdown (hidden for the borrower, visible for `manager`) all render and function correctly.
- **Post-review addendum (still 2026-07-11, before merge):** William asked for a documented follow-up — new ticket creation should also fire an owner-facing alert (email to `support@mynexusgroup.com`, Telegram to William), same pattern as his other apps (Chama360's `NS-005` scaffold). Deliberately not implemented now; recorded as a Phase 09 follow-up in `docs/09-email-notifications.md` and `docs/08-support-tickets.md`'s Flagged concerns, and in this file's top summary.

# 2026-07-11 (Phase 07 execution)
- Executed `docs/07-arrears-cron.md` on branch `phase/07-arrears-cron`, single session
- **Step 1**: added `server/jobs/markOverdueInstallments.js` exactly per the phase doc — finds loans (`active`/`in_arrears`) with `pending`/`partial` installments past due (dueDate `< startOfDay`, so a payment due today is not overdue today), flips those installments to `overdue`, and saves each affected loan sequentially (not `updateMany`, so the pre-save hook's `updatePaymentTracking()`/`checkArrearsStatus()` run for each). Added `node-cron` dependency.
- **Step 2**: added `server/jobs/scheduler.js` (daily `0 1 * * *` cron, `Africa/Lusaka` timezone) and wired it into `server/server.js` (`require('./jobs/scheduler')()`, gated on `NODE_ENV !== 'test' && ENABLE_CRON !== 'false'`). Added `ENABLE_CRON=true` to `server/.env.example` with a comment noting it can be set `false` to disable scheduled jobs (e.g. one-off scripts). Single-process assumption only — confirmed no lock mechanism exists; if the Coolify migration ever runs more than one server instance, this job needs one.
- **Step 3**: `Loan.js` `checkArrearsStatus()` (previously escalate-only: `in_arrears` at >0 days, `defaulted` at >90) now also recovers `in_arrears` → `active` once no installments remain overdue; `defaulted` deliberately does not auto-recover. Also fixed the latent `calculateDaysInArrears()` bug — it used `.find()` (first overdue installment in array order) instead of the earliest-due one; now filters overdue installments and takes `Math.min` of their due dates before computing days. Confirmed by inspection that the repayment route's existing "mark installment paid → save" path already triggers `checkArrearsStatus()` via the pre-save hook, so recovery works end-to-end with no route change needed.
- **Step 4**: added `server/jobs/runMarkOverdue.js` (connects directly via `mongoose.connect(process.env.MONGODB_URI)`, runs the job, logs the result, disconnects) and a `"job:overdue": "node jobs/runMarkOverdue.js"` script in `server/package.json` — this is also how the first production backfill happens post-deploy.
- **Step 5**: added `server/utils/__tests__/markOverdue.test.js` (6 tests, `mongodb-memory-server` pattern matching `tenantScope.test.js`): due-yesterday → overdue + `in_arrears` with correct counters, due-today untouched, 100-days-overdue → `defaulted`, idempotency (second run returns all-zero counters), recovery to `active` once the overdue installment is marked paid, and `waived`/`paid` installments never transitioning. One test-construction subtlety: `Loan`'s pre-save hook unconditionally regenerates `repaymentSchedule` via `calculateLoanDetails()` on a *new* document (whenever `amount`/`interestRate`/`term` are set), so a hand-crafted schedule passed into the constructor gets silently overwritten on first save — the test helper works around this by saving once to let the real schedule generate, then overwriting `repaymentSchedule` with the deliberately-aged installments and saving again (a second save doesn't re-trigger `calculateLoanDetails()` since `amount`/`interestRate`/`term` are unchanged, but does still run `updatePaymentTracking()`/`checkArrearsStatus()` since `repaymentSchedule` is modified). Suite: 218 → 224.
- **Step 6 (manual verification)**: confirmed the `[cron] scheduler started (markOverdueInstallments daily @ 01:00 Africa/Lusaka)` boot log appears by default and is absent with `ENABLE_CRON=false`. Ran against the Atlas dev DB (`ndalamahub-prod`, per the standing precedent that it's a legitimate target for phase-verification writes): created a dedicated test borrower (`phase07_testborrower`) under TechCorp (FirstBank's client) to avoid touching existing demo data, applied for, approved, and disbursed a real loan (`LN20260009`, ZMW 5,000, 3-month `reducing_balance`), then directly aged installment 1's `dueDate` 5 days into the past (to simulate an overdue payment without waiting for real time to pass) and ran `pnpm job:overdue` against Atlas directly:
  - Result: `{ loansChecked: 6, loansUpdated: 6, installmentsMarked: 31 }` — this is the job's first-ever run against that database, so besides `LN20260009` it also caught every pre-existing overdue installment across both lender tenants left over from prior phases' manual verification loans (expected: nothing has ever written the `overdue` status outside test fixtures before this phase).
  - `GET /api/reports/overdue-loans` as `manager` (FirstBank `lender_admin`) → 200, correctly tenant-scoped to exactly `LN20260009` (not the other lender's overdue loans), with `daysInArrears: 6`, `missedPayments: 1` — first real data this report path has ever returned.
  - Left `LN20260009` and its now-`in_arrears` status, plus the other 5 loans this run touched, in place on Atlas per existing precedent of not reversing verification writes there.
- **Gap found during Step 6 verification, flagged rather than fixed (out of this phase's scope — `dashboard.js` is not in the Scope section)**: `server/routes/dashboard.js`'s `/lender-stats` and `/hr-stats` have no `in_arrears`/`defaulted`/overdue counters at all. A loan this job moves to `in_arrears` simply drops out of `activeLoans` and is not counted in `pendingLoans`, `approvedLoans`, `disbursedLoans`, `completedLoans`, or `rejectedLoans` either — so a lender's dashboard portfolio totals silently shrink as loans go into arrears, with no visible indication why. Raised with William before proceeding; `docs/07-arrears-cron.md` was amended in-flight (2026-07-11) to record this as a planning-doc error in its own Objective/Step 6.2/acceptance criterion 2 (which had wrongly assumed dashboard overdue metrics were a dead path this phase would light up) and lists the fix (`inArrearsLoans`/`defaultedLoans` additive count fields, server-side only, via the existing `tenantScope` filters) as a follow-up for Phase 08/09 or a standalone mini-pass.
- **Deploy note**: run `pnpm job:overdue` once, manually, immediately after this code goes live in any environment with existing loan data — this performs the first backfill of arrears status for installments that are already overdue at deploy time (mirrors the counter-seeding deploy note from Phase 05 and the role-rename migration note from Phase 03 in spirit: a one-time step required before/at go-live in any new environment).
- Test suite: 218 → 224 (6 new `markOverdue.test.js` tests). All pre-existing 218 tests unmodified and still passing.
- Updated `CLAUDE.md` (Last-updated line, Section 3 test count + new "Scheduled jobs" line, Section 6 — cron/scheduler item marked fixed, new Phase 07 entry recording the job, the arrears de-escalation fix, and the dashboard gap).
- Merged `phase/07-arrears-cron` into `main` with a green suite, per William's explicit direction to proceed straight through to close-out after the dashboard gap was flagged and the phase doc amended.

# 2026-07-11 (Phase 06 execution)
- Executed `docs/06-user-deletion-orphan-safety.md` on branch `phase/06-user-deletion-orphan-safety`, single session
- **Step 1**: `DELETE /api/users/:id` (`server/routes/users.js`) now checks `Loan.exists({ applicant: id })` before deleting. If the target has any loan history (any status, including `completed`/`rejected`), the user is deactivated (`isActive: false`) instead of hard-deleted — absolute policy, applies to `platform_admin` callers too. Only zero-loan-history users are still hard-deleted. Response body now carries `{ deleted, deactivated }` flags.
- **Step 2**: `POST /api/auth/login` (`server/routes/auth.js`) was found to have no `isActive` check at all — soft-deleting a user via the new policy had no effect on their ability to log in until this fix. Added the check immediately after the user lookup, before password comparison, returning the same generic "Invalid username or password" message as other failure paths (doesn't leak account state).
- **Step 3 (orphan-safe populate access)**: swept every `loan.applicant.<field>` dereference across `dashboard.js`, `reports.js`, and `loans.js`.
  - `dashboard.js` `/hr-stats`: `recentApplications.applicantName` guarded (`'Deleted user'` fallback); `employeesWithLoans` dedupe fixed to use `(loan.applicant._id || loan.applicant).toString()` filtered for `Boolean` — it was previously stringifying the whole populated document (wrong count even without orphans), not just extracting the id.
  - `reports.js`: the `/upcoming-payments` route (~line 265) and the `/export` CSV/JSON builder (~line 992) guarded the same way (`'Deleted user'` for names, `'—'` for phone/email/employeeId/department/company/lenderCompany). The `/active-loans`, `/overdue-loans`, `/upcoming-payments` report routes and the `/:type/export/:format` PDF/Excel builders were already using `?.` optional chaining or returning raw populated docs without direct dereferencing — no changes needed there.
  - `loans.js`: Excel schedule export (line 53) and all list/detail/approve/reject/disburse serializers were already either optional-chained or returning `loan.toJSON()` without dereferencing populated fields directly — no changes needed.
- **Step 4**: `dashboard.js` `/user-stats` `nextPaymentDue` previously read only the first active loan with a pending installment found via `.find()`. Fixed to iterate all the caller's active loans and take the installment with the earliest `dueDate` across the whole set. Response field names unchanged.
- **Step 5**: added `server/utils/__tests__/userDeletionPolicy.test.js` (3 tests, `mongodb-memory-server` pattern matching `tenantScope.test.js`): deactivation-not-deletion for a user with a `completed` loan, hard-delete for a zero-loan-history user, and a no-throw assertion mapping over a loan whose applicant was hard-deleted directly via the collection (simulating a pre-existing orphan). Suite: 215 → 218.
- **Step 6 (manual verification, run against Atlas dev DB `ndalamahub-prod`, per the standing precedent that Atlas is a legitimate target for phase-verification writes)**: started the server locally against the real `MONGODB_URI`, logged in as `manager` (FirstBank `lender_admin`), created a dedicated test borrower (`phase06_testborrower`) under TechCorp (FirstBank's client) to avoid touching pre-existing demo accounts, and had that borrower apply for a legacy (non-product) loan (`LN20260008`, ZMW 5,000, `pending_approval`). Verified:
  - `DELETE /api/users/:id` on the test borrower (as `manager`) → 200, `{ deleted: false, deactivated: true }`; subsequent login attempt as that borrower → 401.
  - Simulated a pre-existing-style orphan by hard-deleting the (now-deactivated) test borrower directly via the `users` collection, bypassing the API policy — leaves `LN20260008` with a dangling `applicant` reference.
  - `GET /api/dashboard/hr-stats` (as `manager`) → 200, `LN20260008` shows `applicantName: "Deleted user"` (previously would have 500'd on this populate miss).
  - `GET /api/reports/export?format=csv` (as `manager`) → 200, CSV row for `LN20260008` shows `"Deleted user"` and `"—"` placeholders instead of crashing.
  - Left `LN20260008` and its orphaned-applicant state in place on Atlas per existing precedent of not reversing verification writes there.
  - Ran a `$lookup`-based orphan probe against the full `loans` collection on Atlas and found **9 pre-existing orphaned loans** predating this session (8 real orphans plus the one just created): `LN20250001`–`LN20250004` (applicants from mid-2025 test data) and `LN20260001`–`LN20260004` (applicants `698db1439f62fa69946d7ed4` and `698db1449f62fa69946d7ed8`, likely from earlier phase-verification test users that were hard-deleted before this policy existed). Listed only, per this phase's explicit out-of-scope instruction — not repaired. William to decide what to do with them.
- Test suite: 215 → 218 (3 new `userDeletionPolicy.test.js` tests). All pre-existing 215 tests unmodified and still passing. One transient failure seen mid-session in `tests/api/hotfix-regressions.test.js` (a 404 on a request that passes in isolation) did not reproduce on a clean re-run of the full suite and is attributed to parallel-worker/mongodb-memory-server load flakiness, not this phase's changes — confirmed by running the same suite unmodified (via `git stash`) and by re-running the full suite twice more, both fully green (218/218).
- Updated `CLAUDE.md` (Last-updated line, Section 3 test count, Section 6 new Phase 06 entry) to record the deletion policy, the login fix, the orphan-guard sweep, and the 9 pre-existing orphaned loans found on Atlas.
- Not yet done: merging `phase/06-user-deletion-orphan-safety` into `main` — pending review.

# 2026-07-10 (Phase 05 execution)
- Executed `docs/05-loan-engine-rebuild.md` on branch `phase/05-loan-engine-rebuild`, both sessions
- **Session A (Steps 1–3, 3b)**: added `termToDays`/`annualizeRate` to `server/utils/interestCalculator.js`; added `interestCalculation.rateBasis` (`per_annum`/`per_term`/`per_period`) to `LoanProduct.js` and `Loan.js`, and `term.unit`/`termUnit` (`days`/`weeks`/`months`) to both, plus the `LoanProduct.interestRate` max-validator relaxation to 1000; relaxed nothing else. Threaded rate normalization through `Loan.calculateLoanDetails()` (with the `flat_rate`+`per_term` exactness rule — no annualization round-trip, `principal × rate` to the cent) and all four `generate*Schedule` methods plus `recalculateSchedule`, via two new helpers (`_getInstallmentCount`, `_scheduleDueDate`) that make day/week terms produce the right installment count and clamp the final due date to exactly `anchorDate + term` instead of one frequency-step past it. `server/routes/loans.js`'s product-based create path now copies `rateBasis`/`term.unit` onto the loan. Suite: 195 → 211 (16 new: `termToDays`/`annualizeRate` unit tests, the Manifi shape exact-math test, a backward-compat control-case test, a week-term test, two single-installment day-term recalculation divide-by-zero tests).
- **Session B (Steps 4–6, 8, 9)**: `PUT /:id/disburse` now calls `loan.calculateLoanDetails()` to regenerate the schedule anchored to `disbursedAt`, replacing the `term × 30 days` `endDate` approximation with the last installment's real due date. Added `'waived'` to the installment status enum; the early-settlement route marks remaining installments `waived` (not `paid` with `paidAmount: 0`); the repayment route's all-paid completion check now treats `waived` as complete. Rewrote `Loan.getSummary()` to be settlement- and prepayment-aware (`totalPaid` = paid-installment amounts + prepayments + settlement amount, counted once; `remainingBalance` forced to 0 once settled). Fixed `Loan.calculateAccruedInterest()` — root cause of the ~21M implausible prepayment-interest figure flagged in Phase 01 Step 8 — to only count interest on outstanding (unpaid, non-waived) obligations past due, not every paid installment ever recorded. Model cleanups: removed the `debugSchedule` debug-log artifacts and `// ...existing code...` editor markers from `Loan.js`/`loans.js`; `canBeApproved()` and the reject route no longer check for the nonexistent `'pending'` status (only `'pending_approval'` exists in the enum); loan-number generation moved from `countDocuments`-based numbering to an atomic `counters` collection `findOneAndUpdate` (verified this driver version — `mongodb` 6.x/7.x under `mongoose` 8.24.1 — returns the document directly, not wrapped in `{value}`; code handles both shapes defensively). Client: added "Rate Basis" and "Term Unit" `<select>`s to `CreateProductDialog.jsx`/`EditProductDialog.jsx`, wired into existing form state; loan-term section header now reflects the selected unit. `ProductBasedLoanForm.jsx` left untouched — it doesn't display calculation method today, so per the phase doc's conditional instruction, no term-unit display was added there either. Suite: 211 → 215 (waived-settlement bookkeeping test, two pre-existing accrued-interest tests updated since they pinned the old buggy paid-installment-inclusion behavior, a half-paid-loan settlement test, a seeded-scale prepayment-summary sanity test, a disbursement-anchor test).
- **Deploy note (loan-number counter seeding)**: before this code goes live in any environment with existing loan data, seed that environment's `counters` collection for the current year to the current max sequence, or new loan numbers will collide with existing ones. Example (mongosh): find the max existing sequence for the year — `db.loans.find({loanNumber: /^LN2026/}).sort({loanNumber: -1}).limit(1)` — then `db.counters.updateOne({_id: "loanNumber-2026"}, {$set: {seq: <that max suffix as a number>}}, {upsert: true})`.
- **Step 9.2 manual verification — run twice.** First pass ran as an isolated, scripted verification (Supertest + `mongodb-memory-server`) rather than the shared Atlas dev database, since no explicit go-ahead had been sought for this session to write to that shared instance. That isolated pass confirmed all the same assertions below. William then confirmed Atlas is intentionally being treated as the permanent dev DB going forward (it remains dev-only once the app and DB migrate to Coolify), so the verification was **re-run directly against Atlas** (`ndalamahub-prod`) via a locally-started server pointed at the real `MONGODB_URI`, using existing seeded accounts (`manager`/FirstBank `lender_admin`, `john_employee`/TechCorp `borrower`):
  - Created the real Manifi product as `manager` (`flat_rate`, `per_term`, rate 25, `term: {min: 30, max: 30, default: 30, unit: 'days'}`) — `rateBasis`/`term.unit` persisted and round-tripped correctly.
  - First application attempt hit exactly the collision the counter-seeding deploy note warns about: `E11000 duplicate key error ... loanNumber: "LN20260001"` (5 pre-existing 2026 loans, atomic counter starting fresh at 1). Seeded `counters.loanNumber-2026` to 5 (the actual max) directly on Atlas — Atlas is now ready for this code without further seeding.
  - Applied (as `john_employee`) + approved + disbursed (as `manager`) a ZMW 10,000 loan against the product: `totalInterest` exactly 2500, `totalAmount` exactly 12500, a single installment of 12500 due exactly 30 calendar days after `disbursedAt` (2026-07-10 → 2026-08-09), `endDate` matching.
  - Settled that loan early via `POST /:id/early-settlement`: `getSummary().remainingBalance === 0`, `totalPaid` = 10000 (the settlement amount, counted once), `status: 'completed'`, the installment `waived` (not `paid` with a zero amount) — left in place on Atlas per the existing precedent of not reversing verification writes there.
  - Checked the accrued-interest fix against `LN20260002`, a loan with genuine payment history from Phase 01's verification: `calculateAccruedInterest()` now returns 280 (the two still-outstanding, past-due installments' interest, 140 each) instead of the pre-fix 420 that would have resulted from also summing the already-paid first installment's interest — direct confirmation of the root-cause fix against real production-shaped data.
  - The temporary isolated verification test file was deleted after its run — not part of the committed suite.
- Test suite: 195 → 215 (20 new tests total across both sessions). All pre-existing tests unmodified except two `prepayment.test.js` assertions that pinned the old, buggy `calculateAccruedInterest` behavior (summing already-paid installment interest) — updated to assert the corrected behavior, per the phase doc's explicit fix instruction (Step 5c-bis).
- Updated `CLAUDE.md` (Last-updated line, Sections 2, 3, 6) to describe the rate engine as built rather than target architecture, record the phase's test-count change, and document the accrued-interest root-cause fix plus the counter-seeding deploy step.
- Not yet done: merging `phase/05-loan-engine-rebuild` into `main` — pending review.

# 2026-07-10 (Phase 04 execution)
- Executed `docs/04-tenancy-layer.md` on branch `phase/04-tenancy-layer`, both sessions
- **Session A**: added `server/utils/tenantScope.js` (the single reusable tenant-scoping module — `loanScopeFilter`/`userScopeFilter`/`companyScopeFilter`, `mergeFilters`, `canReadLoan`/`canWriteRepayment`/`canReadCompany`/`canReadProduct`, `clientCompanyIds`/`companyLenderId`) exactly as specified, plus `server/utils/__tests__/tenantScope.test.js` (17 tests, using the repo's existing `mongodb-memory-server` pattern from `server/tests/helpers/db.js` — the phase doc's pointer to `loanProduct.test.js` for that pattern was itself stale, since that file has no DB setup at all; used the real pattern instead). Migrated `server/routes/loans.js` off every ad-hoc access check per the phase doc's table (list filter, detail/summary/export reads, approve/reject/disburse/repayment/prepayment/settlement writes) — including the search-`$or`-overwrite fix on `GET /api/loans`. Suite: 195/195 (178 + 17 new).
- **Session B**: migrated `reports.js`, `dashboard.js`, `users.js`, `companies.js`, `products.js`, `system.js`.
  - **Doc correction found and applied during execution**: Step 3 originally said "For `/companies`, use `companyScopeFilter`" — that mis-identified the collection `GET /reports/companies` queries (it aggregates Loans, not Companies); applied literally it would have made the endpoint silently return empty results for lender admins. Flagged to William, who confirmed and had already amended `docs/04-tenancy-layer.md` with the correction (`loanScopeFilter` for `/reports/companies`' Loan match; `companyScopeFilter` was actually meant for `/overview`'s separate Company aggregation).
  - **Second doc ambiguity flagged and resolved**: Step 4's instruction to replace `dashboard.js` `/user-stats`'s applicant filter with "the module equivalent" would have meant `loanScopeFilter`, which broadens that route from "my own submitted loans" (role-independent, no route gate) to "my tenant's full portfolio" for lender/employer staff — an uncalled-out behavior change unlike the other three intentional changes Step 8 lists. William confirmed: keep the literal `{applicant: req.user.id}` filter, unchanged.
  - `users.js`: added a local `canTouchUser(reqUser, targetUser)` helper per the phase doc's spec, covering `GET /:id`, `PUT /:id`, `PUT /:id/password`, `PATCH /:id/status`, `DELETE /:id`. This is a real behavior change on `GET /:id`: a lender admin can now view their own corporate client's employee (previously 403'd there via flat company equality, while the list endpoint and reset-password route already allowed it) — updated the Phase 03b regression test `server/tests/api/users.tenancy.test.js` that had pinned the old, inconsistent 403 as "current behavior" pending this exact fix.
  - `companies.js`: `DELETE /:id`'s lender-admin branch deliberately does **not** use `canReadCompany` (unlike `PUT /:id`, which does) — `canReadCompany` treats same-company as accessible, which is correct for reads/updates but would have let a lender admin delete their own lender company. Used `idsEqual(company.lenderCompany, req.user.company)` directly instead, preserving the original "corporate clients only, never self" restriction.
  - `products.js`: closed the audit-flagged gap — `POST /:id/check-eligibility`, `/calculate-fees`, `/calculate-schedule` were unscoped (any authenticated user could probe any lender's product); added a local `canAccessLenderProduct` wrapping `canReadProduct` (which returns `null` for employer-side/borrower by design) with the `companyLenderId` resolution the module's own doc comment says to use.
  - `system.js` `/info`: replaced global `countDocuments()` calls with `userScopeFilter`/`companyScopeFilter`/`loanScopeFilter`.
  - **Left unmigrated, flagged rather than silently included**: `PATCH /api/users/:id/reset-password`, `GET /api/reports/users`, and `products.js`'s `/available`, `/category/:category`, `/stats/overview` — none of these five routes appear in the phase doc's explicit per-file route enumerations (Steps 3, 5, 6), unlike every other route in the same files, which are individually named. No known bug in any of them; still using the pre-Phase-04 ad-hoc pattern.
  - Found and left untouched: `server/routes/loans.js.backup`, a tracked-but-unreferenced dead file predating the Phase 03 role rename (still has `corporate_admin`/`corporate_hr` literals) — surfaced by the Step 7.1 sweep grep, excluded as out of scope for this phase.
- **Step 7 sweep**: `grep -rn "req.user.company.toString()" server/routes` and the role-literal grep both clean except the flagged, deliberately-unmigrated routes above (all justified as authorization decisions or explicitly out-of-scope routes).
- **Step 7.4 manual cross-tenant probe**: ran directly against the Atlas dev database (confirmed with William this is safe — no live user data, and the app migrates to a new Coolify-hosted DB once all phases are complete, at which point this Atlas instance remains a permanent dev DB). Seeded two lender tenants (FirstBank Lending, QuickCash Microfinance) via the existing `server/utils/seeder.js` (already creates both — no seeder edit needed) plus `server/utils/seedProducts.js`, created a live test loan for FirstBank via the API, then as QuickCash's `lender_admin` (`james_admin`): `GET /api/loans/:idOfFirstBankLoan` → 403; `GET /api/loans` → empty (no cross-tenant leak); `POST /api/products/:aFirstBankProductId/check-eligibility` → 403; `GET /api/dashboard/stats` → non-zero, QuickCash-scoped counts (previously always zero). Also confirmed as FirstBank's `manager`: `GET /api/loans?search=<loanNumber>` now returns the match (previously silently broken for lender admins) and `/dashboard/stats` shows non-zero, correctly-scoped company/user counts.
- Test suite: 178 → 195 (17 new `tenantScope.test.js` tests; one existing test in `users.tenancy.test.js` updated to match an intentional behavior change, not added/removed). All pre-existing 178 tests otherwise unmodified and still passing.
- Updated `CLAUDE.md` (Sections 2, 3, 6, 7, Last updated line) to describe the tenancy layer as built rather than target architecture, and to record the audit gaps this phase closed plus the five routes intentionally left unmigrated.
- Not yet done: merging `phase/04-tenancy-layer` into `main` — pending final review.

# 2026-07-10 (Phase 03b execution)
- Executed `docs/03b-api-test-scaffold.md` on branch `phase/03b-api-test-scaffold`, all three sessions
- **Session A**: split `server/server.js` into `server/app.js` (exports the Express app — everything except dotenv/env fail-fast/`connectDB()`/`app.listen()`) and a thin bootstrap; verified `pnpm start` still boots, `GET /api/health` responds, and the missing-`JWT_SECRET`/`MONGODB_URI` fail-fast still exits 1. Added the test harness (`server/tests/helpers/{jest.env,db,fixtures,tokens}.js`) and a `jest` config block in `server/package.json` (`setupFiles`, `testTimeout: 30000`). Added `server/tests/api/smoke.test.js` (7 tests: health, auth guard on missing/garbage token, login success/failure, minted-token `/me`, 404)
- Two environment blockers hit during Session A, both fixed as test-infra-only changes (no production code touched):
  - `mongodb-memory-server`'s default `mongod` (8.2.6) is built for macOS 14+; this host runs macOS 13.7.8 (Ventura) and the binary aborts on launch (`dyld: Symbol not found ... built for macOS 14.0`). Pinned `MONGOMS_VERSION=7.0.14` in `server/tests/helpers/jest.env.js` (that binary was already cached locally from a prior project and runs fine)
  - `exceljs`'s transitive `uuid` dependency was bumped to a pure-ESM-only major (v14) by the Phase 02 `pnpm.overrides` security pin, and Jest's default CommonJS loader can't `require()` it — this broke loading `server/app.js` at all (it mounts `routes/loans.js`, which requires `exceljs` at module scope for the Excel-export route, unrelated to what Phase 03b tests). Added a `moduleNameMapper` in the Jest config pointing `uuid` at a two-line `tests/helpers/uuidMock.js` stub (`crypto.randomUUID()`); nothing in this phase's test scope exercises the export route, so a functional stub is sufficient
- **Session B**: added `server/tests/api/loans.tenancy.test.js` (13 tests: list scoping across all six roles, document-level access, `PUT /:id/repayment` write-path tenancy) and `server/tests/api/users.tenancy.test.js` (8 tests: list scoping, document-level access including the pinned-current-behavior lender-admin-vs-own-client-employee 403, create/status/delete cross-tenant denial). Mutation check #1: temporarily commented out the `PUT /:id/repayment` tenancy check in `server/routes/loans.js` (~line 867) — confirmed both `lenderAdminB on loanA -> 403 and unchanged` and `lenderOfficerB on loanA -> 403` flip from pass to fail (200 instead of 403); reverted, `git diff server/routes/` empty, suite green again
- **Session C**: added `server/tests/api/companies.tenancy.test.js` (6 tests) and `server/tests/api/reports.tenancy.test.js` (6 tests: `/reports/loans`, `/reports/companies` including the Phase 03 broken-open-gate pin, `/dashboard/stats`, `/dashboard/lender-stats`), and `server/tests/api/hotfix-regressions.test.js` (5 tests pinning the 2026-07-10 hotfix — both denial paths and both allow paths, so the fix isn't over-tightened). Mutation check #2: temporarily forced `hasAccess = true` on the `lender_admin` branch of `GET /api/loans/:id` — confirmed exactly the `lenderAdminB on loanA -> 403` test flips to fail; reverted, `git diff server/routes/` empty
- No `test.failing` entries were needed — every dashboard/reports assertion in Step 6 matched actual route behavior (the audit's suspicion that dashboard counts might be global did not hold for the two endpoints tested here: both correctly scope by `req.user.company`/lender-portfolio)
- Test suite: 133 → 178 (45 new API tests: 7 smoke + 13 loans + 8 users + 6 companies + 6 reports + 5 hotfix-regressions). All pre-existing 133 tests unmodified and still passing
- `git diff main` at merge time is empty under `server/routes/`, `server/middleware/`, `server/models/`, and `client/` — this phase touched only `server/app.js` (new), `server/server.js` (bootstrap-only), `server/package.json` (jest config), `server/tests/**` (new), and docs
- Updated `CLAUDE.md` (Sections 2, 3, 11, Last updated line), `docs/README.md` (03b row + regression-gate count), `docs/04-tenancy-layer.md` (one-line prerequisite addition naming `hotfix-regressions.test.js` as the regression gate for Phase 04's route migration)

# 2026-07-10 (security hotfix + Phase 03b planning)
- Planned and documented **Phase 03b** (`docs/03b-api-test-scaffold.md`): API/route-level test scaffold (supertest + mongodb-memory-server against the real Express app) and a tenant-isolation regression baseline, inserted between Phases 03 and 04 so the tenancy-layer rewrite has an automated safety net. Numbered `03b` to avoid renumbering the cross-referencing 04–10 docs. Key finding recorded in the doc: the existing 133 tests never exercise a route — `server.js` doesn't export the app, and `supertest`/`mongodb-memory-server` were installed but never used anywhere
- **Security hotfix, applied directly on `main` at William's direction** (outside a numbered phase — both defects were found while reading routes for the 03b plan; neither the audit nor phases 01–03 had caught them, and only one was covered by a future phase):
  - `server/routes/loans.js` `PUT /:id/approve` and `PUT /:id/reject`: the access check was skipped entirely for `lender_admin` callers, so a lender admin of tenant B could approve/reject tenant A's pending loans (cross-tenant write). Now `lender_admin` requires `loan.lenderCompany` to equal their company, fail-closed when `lenderCompany` is missing; employer-side callers keep the existing `loan.company` check; `platform_admin` unchanged. Loan **reads** were never affected — list/detail/summary/export already checked `lenderCompany`. This exact tightening was already specified in `docs/04-tenancy-layer.md` Step 2; landing it now removes a ~5-session window of known cross-tenant exposure, and Phase 04's wholesale block replacement is unaffected
  - `server/routes/users.js` `PUT /:id`: the role-update branch had no escalation cap (unlike `POST /api/users`, which got one in Phase 03), so an `employer_admin` could promote a same-company user to `lender_admin` or `platform_admin`. Now applies the same `hasMinRole(req.user.role, role)` rule and returns 403 ("You cannot assign a role senior to your own"). This defect was covered by **no** phase 04–10 (Phase 04 explicitly excludes authorization changes), hence fixed now per the standing rule: fix critical items immediately unless a future phase fully addresses them
- Verified: `node --check` on both edited files; `cd server && pnpm test` → 133/133 before and after (no existing test exercises these routes — which is precisely the gap Phase 03b closes; its `server/tests/api/hotfix-regressions.test.js` will pin both fixes, including the allow paths)
- Docs updated to match: `docs/03b-api-test-scaffold.md` (Step 7 changed from `test.failing` leak-pins to ordinary regression tests), `docs/04-tenancy-layer.md` (approve-row note, Step 8 changelog note, Rollback section), `CLAUDE.md` (Sections 2 and 6, Last updated line)

# 2026-07-09 (Phase 03 execution)
- Executed `docs/03-role-rename.md` on branch `phase/03-role-rename`, both sessions (server + migration, then client + verification)
- Renamed all six roles to the locked industry-standard names and corrected the hierarchy so lender roles sit strictly above employer roles (deliberate reorder, not just a renumbering — locked decision in `docs/DECISIONS.md`, "Role hierarchy correction"): `super_user`→`platform_admin` (5), `lender_admin` unchanged (4), `lender_user`→`lender_officer` (3, up from 1), `corporate_admin`→`employer_admin` (2, down from 3), `corporate_hr`→`employer_hr` (1, down from 2), `corporate_user`→`borrower` (0)
- `server/constants/roles.js`, `server/models/User.js` (schema enum/default, `department` required-fn, `hasPermission` hierarchy), and `server/middleware/auth.js` (`authorize`, `authorizeRole`, `authorizeMinRole`, `hasMinRole`) all updated; deduped the role-hierarchy map in `auth.js` into a single module-level `ROLE_HIERARCHY` read by both `authorizeMinRole` and `hasMinRole`
- Mechanical rename of the remaining old-role string literals (and stale comments) across `server/routes/*.js`, `server/utils/{seedSuperUser,seeder,testLoanModel}.js`, and `server/utils/__tests__/prepaymentAPI.test.js`; verified zero remaining hits (`'corporate'` as a `Company.type` value deliberately left untouched — it is not a role)
- Removed the two ghost roles found in the audit: `client_admin` sites in `server/routes/loans.js` (approve/reject — `authorize()` list swapped for `'lender_admin'`, restoring the behavior the dead entry plus the inner lender-admin exemption implied was intended) and four `server/routes/reports.js` lender-portfolio scoping branches (`req.user.role === 'client_admin'` → `'lender_admin'`), plus the `GET /reports/companies` `authorizeMinRole('client_admin')` gate, which resolved to level 0 and passed every authenticated caller — now requires `lender_admin`. `staff` was already removed with the register route in Phase 01
- Extended repayment-recording authority to `lender_officer` (locked decision) on the four prepayment/settlement routes in `server/routes/loans.js` (`PUT /:id/repayment`, `GET /:id/settlement-quote`, `POST /:id/prepayment`, `POST /:id/early-settlement`): route guards and the inner `=== 'lender_admin'` tenancy branches extended with an `||` for `lender_officer` (the repayment route's own branch already used `!== 'platform_admin'` and needed no inner change)
- Closed the escalation path the hierarchy reorder opened: `lender_officer` now passes `authorizeMinRole('employer_hr')` on `POST /api/users`, so extended the Phase-01 lender-only role-assignment guard to cover `lender_officer` and added a universal no-escalation rule (`hasMinRole(req.user.role, role)`) blocking any caller from creating a user at or above their own level. Verified by inspection (no changes needed) that `PATCH /:id/status` and `DELETE /:id`'s same-company checks already constrain officers correctly
- Full `authorizeMinRole()` call-site audit (21 sites across `dashboard.js`, `system.js`, `users.js`, `reports.js`): the only deltas anywhere are `lender_officer` gaining access at the `employer_hr`/`employer_admin` gates (intended reorder consequence) and the `reports.js` ghost-gate fix above — no other role gained or lost access
- Client: rewrote `client/src/utils/roleUtils.js` (`ROLES` map + all seven role-check helpers) and updated the 11 files that reference role strings/labels (`LoanApprovalActions.jsx`, `UserManagement.jsx`, `CreateUserDialog.jsx`, `EditUserDialog.jsx`, `CreateCompanyDialog.jsx`, `Navbar.jsx`, `SettingsPage.jsx`, `ProductsPage.jsx`, `UsersPage.jsx`, `ReportsPage.jsx`, `DashboardPage.jsx`) — values, display labels (e.g. "Corporate HR"→"Employer HR"), and local role-hierarchy copies (`UserManagement.jsx`, `SettingsPage.jsx`) all updated to the corrected order. Zero visual/markup changes beyond role strings and labels (`git diff` confirms — no new components, no styling changes)
- Added `server/utils/migrations/renameRoles.js` (up/down, idempotent) and ran it: 9 users migrated (`super_user`→1, `lender_user`→1, `corporate_admin`→2, `corporate_hr`→2, `corporate_user`→3), verified idempotent on a second run (0 modified), verified `--down` correctly reverts, then re-applied `UP` to leave the database matching the new code before merge. **Deploy note**: this migration must be re-run (or already reflect this state) against any other environment's database immediately before this phase's code goes live there
- Verified: `cd server && pnpm test` → 133/133 before and after. `client && pnpm build` green; `pnpm exec eslint` on all 12 touched client files shows only pre-existing lint findings identical to the pre-Phase-03 tree (confirmed via `git stash` diff) — no new lint issues introduced
- Manual end-to-end verification: logged in fresh as `superadmin` (`platform_admin`) and `manager` (`lender_admin`), clicked through Dashboard/Loans/Settings→Users/Reports for both — all render correctly, and `manager`'s Reports page now correctly shows their 4-loan portfolio (previously wrong/empty via the ghost-role branch). API-level matrix spot-checks all matched Step 8.4 exactly: `lender_officer` passes the `PUT /:id/repayment` authorization gate (400 validation error, not 403, on a deliberately incomplete non-mutating payload); `employer_hr` on the same route → 403; `lender_admin` `GET /api/reports/loans` → 200 with correct portfolio; `borrower` `GET /api/reports/companies` → 403 (previously passed the broken ghost gate); `lender_officer` `GET /api/reports/overview` → 200 (reorder consequence, intended); `lender_officer` `POST /api/users` with `role: "lender_admin"` → 403 with the no-escalation message
- Updated `CLAUDE.md` Section 5 (role table is now current reality, hierarchy levels added) and Section 6 (ghost-role item marked fixed)

# 2026-07-09 (CLAUDE.md documentation correction)
- Fixed a stale-documentation inconsistency: CLAUDE.md Sections 2 and 11 still cited the original pre-Phase-01 audit baseline ("133 server tests, 111 pass / 22 fail") as if it were the current test count, contradicting Section 6 of the same file which already correctly states the suite is 133/133 following the Phase 01 fix
- Verified directly before editing: `pnpm test` on `main` (`204b176`) → 133/133; checked out the Phase 01 merge commit (`0ef9b50`) in a throwaway worktree and confirmed the suite was already 133/133 there too, i.e. before Phase 02 touched anything. Also confirmed none of Phase 02's route-file changes are exercised by the suite at all — every test file under `server/utils/__tests__/` imports models/utilities directly, not routes, and the one file importing `supertest` never calls `request(app)`
- Updated CLAUDE.md Section 2 (line 28) and Section 11 (line 147) to describe the 111/133 figure as the historical pre-Phase-01 baseline and state the suite is currently 133/133; bumped the "Last updated" line accordingly
- `docs/AUDIT_REPORT.md` deliberately left untouched — it's a historical record of the pre-Phase-01 audit and is meant to keep the original 111/133 figure
- Documentation-only change; no code modified

# 2026-07-05 (Phase 02 execution)
- Executed `docs/02-security-hardening.md` on branch `phase/02-security-hardening`
- Killed the hardcoded JWT fallback secret (`'your-secret-key'`) in `server/utils/auth.js` (3 sites) and `server/routes/auth.js` refresh route; server now fails fast at boot (`server/server.js`) if `MONGODB_URI` or `JWT_SECRET` is unset. Removed the equivalent Mongo-URI fallback in `server/config/db.js`
- Unified JWT access/refresh token payload shapes (`server/utils/auth.js`, `server/routes/auth.js`): both now sign `{id, username, role, company}`, fixing the previously-broken refresh flow (`generateToken`/`generateRefreshToken` used to take a bare `userId` and sign only `{userId}`, which no route code could read). Login now also returns a `refreshToken` (additive; the client has no refresh call path yet, so this is unused today but unblocks a future client-side refresh loop)
- Wired up the existing-but-unused per-username login rate limiter (5 attempts/15 min) in `server/routes/auth.js`, plus a broader `express-rate-limit` backstop (50/15 min) on `/api/auth` in `server/server.js`
- Added `helmet`, `express-mongo-sanitize`, and `express-rate-limit` to `server/server.js`; `express-mongo-sanitize` closes the `?status[$ne]=x`-style operator-injection class on list endpoints (verified: the `$ne` key is now stripped before reaching Mongoose)
- Stripped all console.log statements that printed request/user/token/filter/document data across `server/routes/{auth,loans,users,companies,reports,dashboard}.js` and the `Loan` pre-save hook (`server/models/Loan.js:520`); deleted the dead `Company` import in `auth.js`. Left the `NODE_ENV === 'test'` `DEBUG_GRACE_*` blocks in `Loan.js` alone (Phase 05 cleanup) and the one remaining `console.log` in `server/routes/system.js:146` alone (inside the explicitly out-of-scope mock settings endpoint, `system.js:63–179`)
- Gated `error: error.message` leaks behind `NODE_ENV === 'development'` across `server/routes/dashboard.js` (4 handlers), `server/routes/products.js` (all 11 handlers), and the Excel-export catch in `server/routes/loans.js`
- Added a `// TODO(phase-09): remove once reset emails send` marker on the dev-gated `resetToken` in the forgot-password response
- Dependency bumps: server — added `helmet`, `express-rate-limit`, `express-mongo-sanitize`; `pnpm update` within existing ranges; added a `pnpm.overrides` entry pinning transitive `uuid` (via `exceljs`) to `>=11.1.1` to close the one remaining moderate finding. `pnpm audit --prod` on the server: **0 vulnerabilities** (was 14 high). Express stayed at 4.22.x (no major bump). Client — `pnpm update axios react-router-dom vite` within current majors (axios 1.18.1, react-router-dom 7.18.1, vite 7.3.6); `pnpm build` green
- Client `pnpm audit --prod` remaining findings (not gated by this phase's acceptance criteria, which only requires 0 high on the **server**): 3 high / 2 moderate / 1 low, all transitive dev-build-tool dependencies pulled in by `@tailwindcss/vite` → `vite` (`rollup`, `picomatch`, `postcss`, `esbuild`) plus `axios` → `form-data`. Not fixed here — no override authorized for the client in this phase's scope; flagged for a future dependency pass
- Created `server/.env.example` and `client/.env.example` (names/placeholders only, no real values). Added `CORS_ORIGIN=http://localhost:5173` to the local `server/.env`. Noted: `JWT_EXPIRE` in the local `.env` is unused dead config and can be deleted
- Test suite: 133/133 before and after all changes
- Manual verifications (Step 8) run against the Atlas demo DB, using a `phase02test_admin` super-user account created for this session and deleted immediately after: missing-`JWT_SECRET` boot check (process exits 1, correct message — note: `env -u JWT_SECRET node server.js` alone does **not** achieve this, since `dotenv.config()` repopulates `JWT_SECRET` from `server/.env` regardless of the shell env; verified instead by temporarily removing the line from `.env` and restoring it immediately after), 6th bad-password login attempt → 429, refresh flow end-to-end (identical `{id, username, role, company, iat, exp}` claim shape; refresh-issued token succeeds against `/api/auth/me` and `/api/loans`), and the mongo-sanitize injection probe (see flag below)
- Flagged: the `?status[$ne]=x` mongo-sanitize probe confirmed the operator-injection hole is closed (the `$ne` key is stripped, and the endpoint does not return all loans) but surfaced a **separate, pre-existing** bug: after sanitization strips the operator key, `GET /api/loans` is left with `filter.status = {}` (an empty object) and Mongoose throws a cast error, returning a 500 with an error message (visible because local `NODE_ENV=development`) instead of a graceful filtered/empty result as anticipated by the phase doc. Not fixed here — input-shape validation on the `status` query param was not in this phase's scope (Step 4b only asked to wire up the sanitize middleware). Flagged for a future phase
- Merged to `main` with a green suite

# 2026-07-04 (Phase 01 execution, Addendum A)
- Applied `docs/01-security-critical-fixes.md` Addendum A to `Loan.calculateEarlySettlementAmount()` (`server/models/Loan.js`): future-scheduled interest for settlement savings now sums every unpaid installment (not just installments still due in the future), fixing the case where `savingsVsSchedule` went negative and was silently clamped to 0 on loans settled mid-schedule
- Test suite: 132/133 → **133/133**. Exactly the targeted test (`Prepayment API Endpoints › calculates interest savings correctly`) flipped red→green; no other test changed, matching the addendum's predicted blast radius
- Manual verifications (Step 8): the Atlas cluster (previously unreachable due to auto-pause) was resumed by William and confirmed reachable (SRV records verified). Ran the server against the demo database and performed all 7 Step 8 checks using existing seeded accounts (`manager`/FirstBank `lender_admin`, `james_admin`/QuickCash `lender_admin`, `david_admin`/TechCorp `corporate_admin`, `john_employee`/TechCorp `corporate_user`) and existing demo loans — **all 7 passed**:
  1. `POST /api/auth/register` → 404 (route gone)
  2. `POST /api/users` as `lender_admin` with `role: super_user` → 403
  3. `GET /api/users/:id` on a same-company user as `corporate_admin` → 200; as `corporate_user` → 403
  4. `PUT /api/loans/:id/repayment` (valid, as the loan's lender admin) → 200, installment updated
  5. Same with a future `paymentDate` → 400 with the exact message, no side effect
  6. Same from a different lender company's admin (`james_admin`/QuickCash on a FirstBank loan) → 403, no side effect
  7. `POST /api/loans/:id/prepayment` (`reduce_term`) on an active loan → 200; verified directly in the DB that the recalculated `repaymentSchedule` has no `NaN`/`null` interest or principal values
  - Check 4 recorded a real partial payment (reference `phase01test_repayment001`, ZMW 400 on installment 2 of loan `LN20260002`) and check 7 recorded a real prepayment (notes `phase01test verification prepayment`, ZMW 2000) on demo loans — left in place per instruction rather than reversed, since undoing a prepayment's schedule recalculation cleanly is nontrivial and risks corrupting the demo data further. No test users were created (checks 1–2 were blocked before any DB write; verified user count unchanged at 11).
  - Noted but out of scope: the prepayment response's settlement-preview summary (`beforeInterest`/`afterInterest`) showed an implausible ~21 million interest figure — a distinct bug from a different area of `calculateEarlySettlementAmount`/accrued-interest math, unrelated to Addendum A's fix and outside Phase 01's scope. Flagged for Phase 05.
- Suite re-confirmed 133/133 after Step 8. Merged to `main`.

# 2026-07-04 (Phase 01 execution)
- Executed `docs/01-security-critical-fixes.md` on branch `phase/01-security-critical-fixes` (unmerged — see flag below)
- Removed public `POST /api/auth/register` endpoint (`server/routes/auth.js`); the authenticated `POST /api/users` path is the only user-creation route now
- Closed the lender-admin privilege-escalation gap in `POST /api/users` (`server/routes/users.js`) — lender admins can no longer mint `super_user` accounts and are now scoped to their own company or their corporate client companies via `Company.lenderCompany`
- Fixed 5 crashing `req.user.hasPermission(...)` call sites in `server/routes/users.js` by adding a JWT-payload-safe `hasMinRole` helper to `server/middleware/auth.js`
- Fixed the dead `PUT /api/loans/:id/repayment` route (`server/routes/loans.js`): moved payment-date validation inside the `try` block, and closed a cross-tenant write hole by checking `loan.lenderCompany` instead of dead role logic
- Restored `Loan.canAcceptPrepayment()`'s return statement and fixed argument-order bugs in the three schedule recalculators (`_recalculateReducingBalanceSchedule`, `_recalculateSimpleInterestSchedule`, `_recalculateInterestOnlySchedule`) in `server/models/Loan.js` — regression from commit `531d954`
- Test suite: 111/133 → 132/133. The one remaining failure (`Prepayment API Endpoints › calculates interest savings correctly`) traces to `Loan.calculateEarlySettlementAmount()`, a method outside this phase's scope (Phase 05 territory) — flagged, not fixed, per the phase doc's Step 7 instruction
- Manual verifications (Step 8) not performed: the local `.env` points `MONGODB_URI` at a live production Atlas cluster, and no isolated seeded test environment was available — running functional checks (creating users, recording repayments) against it was judged unsafe

# 2026-07-04
- Merged `feature/phase-0-loan-engine` into `main` (fast-forward, no conflicts); all work now proceeds against `main`
- Added pre-go-live audit (`docs/AUDIT_REPORT.md`), locked decisions log (`docs/DECISIONS.md`), and phased execution plans `docs/01`–`docs/10` (indexed in `docs/README.md`); archived stale roadmap/planning docs to `docs/archive/`; moved LOAN_ENGINE_DOCUMENTATION, FRONTEND_TEST_PLAN, and ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE into `docs/` as live docs with obsolescence banners
- Recorded three newly resolved decisions in `docs/DECISIONS.md` and amended the affected plans:
  - Manifi product terms confirmed via Clement (flat rate, 25%, fixed 30-day term) + explicit term-unit modeling (days/weeks/months) — Phase 05 updated
  - Disbursement-anchored schedules and `waived`-status early settlement confirmed as planned — Phase 05 assumptions cleared
  - Role hierarchy corrected (lender roles strictly above employer roles: platform_admin 5, lender_admin 4, lender_officer 3, employer_admin 2, employer_hr 1, borrower 0) with a mandatory `authorizeMinRole` effective-access regression audit — Phases 03/04 updated
- No application code changed; verified test baseline on `main`: 133 server tests, 111 pass / 22 fail (all failures from the known `canAcceptPrepayment` regression, fixed in Phase 01)

# 2026-02-15
- Added full backend support for loan grace period and moratorium logic (principal-only and full moratorium)
- Repayment schedule now includes isGrace, isMoratorium, and graceType fields
- All grace/moratorium scenarios are covered by automated tests
- Schema updated for robust multi-tenant and legacy compatibility
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: For changes prior to February 2026, see [changelog_to_feb_2026.md](./changelog_to_feb_2026.md)

## [Unreleased]

### Changed
- **Frontend Test Plan Progress** (February 15, 2026):
  - Checked off all items for scenarios 1 through 5.2 in the test completion checklist.

### Added
- **Dashboard Portfolio Metrics Enhancements** (February 15, 2026):
  - Lender dashboard now displays Outstanding Balance and Total Interest Earned for the lender's portfolio.
  - Corporate admin/HR dashboard now displays Outstanding Balance and Total Interest Earned for the company's loans.
  - Metrics update live as portfolio changes.

### Added
- **Loan Application Form Enhancements** (February 12, 2026):
  - Payment schedule preview now working correctly
    - Fixed API endpoint to manually build schedules using available calculator functions
    - Removed calls to non-existent schedule generation functions
    - All 4 calculation methods now properly implemented:
      - reducing_balance: Manual loop with calculateMonthlyPayment() + calculatePeriodInterest()
      - flat_rate: Calculate total interest upfront, divide equally
      - simple_interest: Period-by-period interest calculation
      - interest_only: Monthly interest payments + balloon principal
    - Real-time schedule display with monthly payment, total repayment, total interest
    - First 3 installments table showing principal/interest breakdown
    - Debounced 500ms API calls to avoid excessive requests
  - Collateral section now always visible
    - Changed from conditional to always-shown for all products
    - Shows "(Optional)" label when not required by product
    - Shows red asterisk (*) when required by product
    - Allows optional collateral submission even for products that don't require it
  - Fixed term dropdown for short-term loans
    - Shows all available terms for products with max ≤ 12 months
    - Maintains 6-month intervals for long-term loans (> 12 months max)
    - Payday Loans now correctly show 1, 2, 3 months options
    - Bridge Loans show all monthly increments from 3-12
  - Fixed Payday Loan product configuration
    - Updated interest rate: 7% → 84% APR (7% per month equivalent)
    - Changed processing fee: Fixed K50 → 5% percentage-based
    - Now correctly calculates: K3,000 × 84% × 3/12 = K630 interest
    - Processing fee: K3,000 × 5% = K150
    - Monthly payment: K1,210, Total repayment: K3,630 (matches test plan)
  - Fixed validation bugs
    - Removed incorrect isAmountValid function check (was checking existence, not calling)
    - Removed duplicate useEffect for payment schedule fetching
    - Amount validation now works correctly for all loan amounts

- **Loan Disbursement Workflow** (February 12, 2026):
  - Added comprehensive disbursement form with notes field
    - Replaced simple "Disburse Loan" button with full form UI
    - Required disbursement notes field for audit trail (e.g., "Funds transferred to account ending 1234")
    - Blue-themed Card matching approval (green) and rejection (red) form patterns
    - Confirm/Cancel buttons with proper validation and state management
  - Added disbursement summary display
    - Shows principal amount, processing fee, and net disbursement
    - Calculates net amount customer receives: Amount - Processing Fee
    - Example: K50,000 - K2,000 fee = K48,000 net disbursement
    - Provides transparency before disbursement confirmation
  - Updated "Disburse Loan" button behavior
    - Now toggles disbursement form instead of direct action
    - Only shows when approval/rejection/disbursement forms are hidden
    - Maintains consistent UX across all loan actions

- **Loan Schema Processing Fees** (February 12, 2026):
  - Added `fees` field to Loan schema
    - Structure: `{ processing: Number, insurance: Number }`
    - Stores calculated fees from product configuration at loan creation
    - Min validation: 0 (fees cannot be negative)
  - Added virtual fields for easy access
    - `processingFee`: Returns `fees.processing` or 0
    - `insuranceFee`: Returns `fees.insurance` or 0
    - `totalUpfrontFees`: Sum of processing + insurance fees
    - `netDisbursement`: Loan amount minus total upfront fees
  - Enabled virtuals in JSON/Object output
    - `toJSON: { virtuals: true }`
    - `toObject: { virtuals: true }`
    - Ensures virtual fields are included in API responses
  - Created utility scripts for fee population
    - `utils/updateLoanFees.js`: Updates existing loans with product-calculated fees
    - `utils/fixTestLoans.js`: Links test loans to correct products and populates fees
    - Example: Bridge Loan K50,000 × 4% = K2,000 processing fee

### Fixed
- **Bridge Loan Product Configuration** (February 12, 2026):
  - Corrected calculation method: interest_only → simple_interest
  - Updated processing fee: 2.5% → 4% (K50,000 loan = K2,000 fee)
  - Removed insurance fee: 1.5% required → 0% (not needed for bridge loans)
  - Fixed simple_interest calculation in API endpoint:
    - Formula: totalInterest = amount × (rate/100) × (term/12)
    - Monthly payment: (amount + totalInterest) / term
    - Example: K50,000 @ 24% for 6 months = K6,000 interest, K9,333.33 monthly
  - Test results now match expected: K56,000 total repayment

- **Education Loan Product Configuration** (February 12, 2026):
  - Corrected calculation method: simple_interest → interest_only
  - Updated processing fee: 1% → 1.5% (K40,000 loan = K600 fee)
  - Removed insurance fee: 0.5% optional → 0% (not applicable)
  - Fixed interest_only calculation in API endpoint:
    - **Critical Bug**: Function call `calculateInterestOnlyPayment(amount, interestRate)` had parameter mismatch
      - Function expects 5 params: (principal, annualRate, term, frequency, accrualBasis)
      - Was called with only 2 params
      - Function returns object {interestPayment, totalInterest, balloonPayment, finalPayment}
      - Code treated return value as number, causing undefined/NaN cascade
    - **Solution**: Replaced with direct formula: `monthlyInterest = (amount × (interestRate / 100)) / 12`
    - Now correctly calculates:
      - K40,000 @ 14% for 24 months = K466.67 monthly interest
      - 23 payments of K466.67 (interest only)
      - 1 final payment of K40,466.67 (interest + full principal balloon)
      - Total interest: K11,200, Total repayment: K51,200
  - Payment schedule preview now displays correctly (was showing all N/A values)
  - Balloon payment structure properly represented in schedule

- **Frontend Testing & Product Management Enhancements**:
  - Created complete product CRUD dialogs
    - CreateProductDialog: Comprehensive form with all LoanProduct schema fields (450+ lines)
      - Basic info: name, description, category, status
      - Interest rates: min/max/default with percentage inputs
      - Loan amounts and terms: min/max/default configurations
      - Calculation method: reducing_balance, flat_rate, simple_interest, interest_only
      - Day count convention: actual/365, actual/360, 30/360
      - Fees: Processing fee (with type and amount), Insurance fee (with required checkbox)
      - Repayment frequency: Multi-select checkboxes (monthly, weekly, bi-weekly, quarterly, annually)
      - Collateral requirements: Checkbox with types selection (property, vehicle, equipment, inventory, securities, guarantor, other)
      - Grace period: Allowed checkbox with max months and interest treatment options
      - Prepayment settings: Allowed checkbox with penalty toggle and rate input
      - Eligibility criteria: Age range, income, credit score, employment months, employment types
    - EditProductDialog: Pre-filled edit form with same comprehensive fields (400+ lines)
    - Both dialogs submit to backend with full validation and error handling
  - Enhanced ProductsPage with full CRUD functionality
    - Create button: Opens CreateProductDialog with onClick handler
    - Edit button: Opens EditProductDialog with selected product data
    - Delete button: Confirmation prompt with API call to DELETE endpoint
    - Auto-refresh product list after create/update/delete operations
  - Fixed authorization middleware bug (CRITICAL FIX)
    - Updated `authorize()` middleware to handle both calling patterns:
      - `authorize('role1', 'role2')` - rest parameters pattern
      - `authorize(['role1', 'role2'])` - array pattern
    - Used `roles.flat()` to normalize both patterns to flat array
    - Resolves "Access denied. Insufficient permissions" error for lender_admin users
    - Now allows both patterns across all route files without breaking authorization
  - Product management now fully operational for lender_admin role
    - james_admin (QuickCash lender) can create, edit, delete products
    - Proper multi-tenant isolation maintained
    - Role-based access control working correctly

- **Frontend Testing & Navigation Enhancements**:
  - Added Products navigation menu to main navbar
    - Created ProductsPage component with category filtering
    - Dynamic product cards showing interest rates, amount ranges, and terms
    - Calculation method badges (reducing_balance, flat_rate, simple_interest, interest_only)
    - Company name badges on each product for multi-tenant clarity
  - Implemented lender filtering for product management (super_user only)
    - Dynamic lender dropdown populated from companies API
    - Backend support for company query parameter filtering
    - Real-time product filtering by both category and lender
    - Scalable solution for managing hundreds of products across multiple lenders
  - Created comprehensive test data seeding
    - Updated seeder.js with 11 users across all roles
    - 5 companies: 2 lenders (FirstBank, QuickCash), 3 corporates (TechCorp, Mining Corp, RetailMart)
    - 14 loan products seeded via seedProducts.js (7 types × 2 lenders)
    - Automated setup script (setup-test-data.sh) for one-command initialization
  - Created FRONTEND_TEST_PLAN.md (1,300+ lines)
    - Complete step-by-step testing guide with dummy data
    - 7 test parts: Setup, Products, Loan Lifecycle, Prepayments, Reports, Edge Cases, Performance
    - All 4 calculation methods covered with specific test scenarios
    - Login credentials quick reference table
    - Expected results for all test cases
    - Troubleshooting guide included
  - **Frontend Test Results**: Part 2 (Product Management) ✅ PASSED
    - Scenario 2.1: Browse products by category - PASSED
    - Scenario 2.2: Create custom product - PASSED
    - Scenario 2.3: Edit product configuration - PASSED
    - Scenario 2.4: Product filtering by lender - PASSED
    - Scenario 2.5: Product eligibility preview - PASSED
    - All CRUD operations working for lender_admin role

- **Phase 0: Loan Engine Enhancement - Week 4 ✅ COMPLETED**:
  - Built Prepayment & Early Settlement Engine (`server/models/Loan.js` extended, 600+ lines total)
    - Prepayment schema: Tracks amount, allocation strategy (reduce_term/reduce_payment), principal/interest/fee portions
    - Early settlement object: Records settlement date, amounts, fees, savings realized
    - Validation methods: `canAcceptPrepayment()`, `calculateRemainingBalance()`, `calculateAccruedInterest()`
    - Settlement calculation: `calculateEarlySettlementAmount()` with full breakdown and fees
    - Prepayment recording: `recordPrepayment()` with interest-first allocation strategy
    - Schedule recalculation: `recalculateSchedule()` supporting both reduce_term and reduce_payment strategies
    - Method-specific recalculation: 4 separate functions for reducing_balance, flat_rate, simple_interest, interest_only
  - Extended Loans API (`server/routes/loans.js`, 4 new endpoints)
    - `GET /api/loans/:id/settlement-quote`: Returns early settlement breakdown (read-only)
    - `POST /api/loans/:id/prepayment`: Records prepayment, triggers auto-recalculation, returns before/after summary
    - `POST /api/loans/:id/early-settlement`: Processes full payoff, marks loan completed
    - `GET /api/loans/:id/prepayment-history`: Lists all prepayments with summary totals
    - Authorization: lender_admin only for all prepayment operations
    - Multi-tenant validation: Checks lenderCompany match for security
  - Created comprehensive test suite (`server/utils/__tests__/`, 41 new tests)
    - `prepayment.test.js`: 19 tests for validation, balance calculation, settlement, recording
    - `prepaymentAPI.test.js`: 20 tests for API endpoints, authorization, multi-tenant isolation
    - `scheduleRecalculation.test.js`: 12 tests for both strategies across all 4 calculation methods
    - All 130 tests passing ✅ (99 + 41 new tests)
  - Built frontend prepayment components
    - PrepaymentDialog: Recording prepayments with strategy selection (308 lines)
    - PrepaymentHistoryDialog: Audit trail viewer with summary cards (233 lines)
    - Integrated into LoanDetailsDialog with action buttons
    - Added UI components: radio-group, textarea, alert (shadcn/ui compatible)
    - Installed @radix-ui/react-radio-group dependency
    - Frontend build successful ✅

  ### Added
  - **Repayment Schedule Export (Excel)** (February 15, 2026):
    - Backend: Added per-loan Excel export endpoint `GET /api/loans/:id/repayment-schedule/export/excel` which returns an XLSX file of the repayment schedule.
    - Frontend: Implemented `Export Repayment Schedule (Excel)` button in the loan details dialog with `handleExportRepaymentSchedule` that downloads the generated XLSX file.
    - Includes loading and error states; the export is available for loans with populated repayment schedules.

- **Phase 0: Loan Engine Enhancement - Week 3 ✅ COMPLETED**:
  - Created comprehensive LoanProduct model (`server/models/LoanProduct.js`, 400+ lines)
    - 9 product categories: personal, business, payday, bridge, microfinance, auto, education, mortgage, other
    - Flexible configuration: interest rate ranges, term ranges, amount ranges
    - Support for all 4 calculation methods (reducing_balance, flat_rate, simple_interest, interest_only)
    - Fee structure: processing (percentage/fixed), insurance (optional), late payment, early settlement
    - Eligibility criteria: age range, minimum income, employment duration, credit score, employment types
    - Validation methods: `isAmountValid()`, `isTermValid()`, `isRateValid()`
    - Fee calculations: `calculateProcessingFee()`, `calculateInsuranceFee()`, `calculateUpfrontFees()`
    - Eligibility checking: `checkEligibility()` with detailed error messages
  - Built Products API (`server/routes/products.js`, 350+ lines, 10 endpoints)
    - Public endpoints: List products, get product, filter by category, check eligibility, calculate fees
    - Admin endpoints: Create, update, delete products, get statistics
    - Multi-tenant isolation: All queries filtered by company
  - Created product seeder (`server/utils/seedProducts.js`, 250+ lines)
    - 7 default product templates: Personal 18%, Business 22%, Payday 7%, Bridge 24%, Microfinance 28%, Auto 18%, Education 14%
    - Automatically seeds products for each lender company
    - Successfully tested with 7 products for 1 lender
  - Integrated products with loan application
    - Enhanced `server/routes/loans.js` with product-based loan creation
    - Added product reference field to Loan model
    - Automatic fee calculation from product configuration
    - Validation against product limits (amount, term, rate)
    - Backward compatible with legacy loans (without products)
  - Created frontend product components
    - ProductSelector: Grid-based product browser with category filtering (180+ lines)
    - ProductBasedLoanForm: 2-step wizard with real-time fee calculation (350+ lines)
    - ProductComparison: Side-by-side comparison for up to 4 products (450+ lines)
    - Badge component: For product categories and status indicators
  - Created comprehensive test suite (`server/utils/__tests__/loanProduct.test.js`, 280+ lines)
    - 28 tests covering all product functionality
    - Test suites: Validation Logic, Fee Calculations, Eligibility Checks, Interest Methods, Product Categories
    - All 28 tests passing ✅
  - Created comprehensive documentation (`WEEK_3_PRODUCT_CATALOG.md`)
    - Complete API endpoint reference with examples
    - Product configuration guide
    - Integration examples for loan applications
    - Fee calculation examples
    - Eligibility checking guide

- **Phase 0: Loan Engine Enhancement - Week 1, Day 1 ✅ COMPLETED**:
  - Added interest calculation configuration to Loan schema
  - Added `interestCalculation` object with method, accrualBasis, and accrualFrequency fields
  - Added `repaymentFrequency` field supporting weekly, bi-weekly, monthly, and quarterly schedules
  - Support for multiple amortization methods: reducing_balance, flat_rate, simple_interest, interest_only
  - Support for day count conventions: actual/365, actual/360, 30/360
  - Prepares foundation for daily interest accrual implementation
  - Created MongoDB Atlas connection for ndalamahub-prod database
  - Fixed password reset utility to properly hash passwords using pre-save hook
  - Environment configuration completed with .env file setup

- **Phase 0: Loan Engine Enhancement - Week 1, Day 2 ✅ COMPLETED**:
  - Created comprehensive interest calculator utility (`server/utils/interestCalculator.js`)
  - Implemented daily interest rate calculations for all three day count conventions
  - Added functions for calculating days between dates (actual and 30/360)
  - Built period interest calculator with accurate date handling
  - Created date manipulation utilities (addMonths, addDays, addWeeks)
  - Implemented payment frequency helpers (weekly, bi-weekly, monthly, quarterly)
  - Added 30 comprehensive unit tests with Jest - all passing ✅
  - Created manual test script demonstrating real-world calculations
  - Configured Jest testing framework for server-side tests

- **Phase 0: Loan Engine Enhancement - Week 1, Day 3 ✅ COMPLETED**:
  - Integrated interest calculator into Loan model
  - Updated `calculateLoanDetails()` method to use daily interest accrual
  - Updated `generateRepaymentSchedule()` method with actual day calculations
  - Replaced fixed 30-day month assumption with accurate date calculations
  - Interest now varies by actual days in month (28-31 days)
  - February payments now have correctly lower interest than 31-day months
  - Support for bi-weekly, weekly, and other payment frequencies fully functional
  - Created comprehensive test script demonstrating new calculations
  - Verified calculations with real loan scenarios

- **Phase 0: Loan Engine Enhancement - Week 1, Days 4-5 ✅ COMPLETED**:
  - Implemented flat rate amortization method for Zambian microfinance market
  - Added `calculateFlatRateInterest()` function to interest calculator utility
  - Added `calculateFlatRatePayment()` function returning monthly payment and total interest
  - Modified `calculateLoanDetails()` to detect and handle flat_rate method
  - Created `generateFlatRateSchedule()` method with equal principal/interest per installment
  - Split schedule generation into method-specific functions (flat_rate vs reducing_balance)
  - Created comparison test demonstrating 68.65% higher interest cost for flat rate
  - Verified flat rate calculations: ZMW 10,000 @ 24% for 6 months = ZMW 1,200 total interest
  - Test confirms flat rate charges interest on full principal throughout entire loan term
  - Successfully tested both methods side-by-side with identical loan parameters

- **Phase 0: Loan Engine Enhancement - Week 1, Days 6-7 ✅ COMPLETED**:
  - Created comprehensive loan calculation test suite (14 tests)
  - Added integration tests for reducing balance method (4 tests)
  - Added integration tests for flat rate method (3 tests)
  - Added day count convention tests (2 tests)
  - Added edge case tests covering zero interest, single payment, large amounts, long terms (4 tests)
  - Added February interest calculation validation test
  - All 44 tests passing (30 interest calculator + 14 loan calculations)
  - Installed mongodb-memory-server for future database testing needs
  - Created comprehensive loan engine documentation (LOAN_ENGINE_DOCUMENTATION.md)
  - Documented all features: daily accrual, day count conventions, flat rate, payment frequencies
  - Added API usage examples and migration guide
  - Documented schema changes and utility functions
  - Included performance considerations and known limitations
  - Added roadmap for Weeks 2-12 implementation plan

**Week 1 Summary**: Complete foundation for enterprise-grade loan calculations implemented and tested. Daily interest accrual with accurate date handling replaces fixed 30-day assumptions. Flat rate method added for microfinance market. 44/44 tests passing. Full documentation created.

- **Phase 0: Loan Engine Enhancement - Week 2, Days 1-2 ✅ COMPLETED**:
  - Implemented simple interest amortization method
  - Added `calculateSimpleInterest()` and `calculateSimpleInterestPayment()` functions
  - Simple interest calculates interest on original principal per period (not declining balance)
  - Interest varies by actual days in month, unlike flat rate's equal division
  - Added simple_interest handling in `calculateLoanDetails()` method
  - Created `generateSimpleInterestSchedule()` method with accurate period calculations
  - Added 4 comprehensive tests for simple interest method
  - Test validates variable interest based on actual days per period
  - Comparison shows simple interest between reducing balance and flat rate costs
  - Created testSimpleInterest.js demo comparing all three methods
  - All 48/48 tests passing (30 calculator + 18 loan calculations)

- **Phase 0: Loan Engine Enhancement - Week 2, Days 3-4 ✅ COMPLETED**:
  - Implemented interest-only amortization method with balloon payment support
  - Added `calculateInterestOnlyPayment()` function to interest calculator
  - Interest-only loans pay interest each period, principal due at maturity
  - Added interest_only handling in `calculateLoanDetails()` method
  - Created `generateInterestOnlySchedule()` method with balloon payment flag
  - Added `isBalloonPayment` field to repayment schedule schema
  - Added 4 comprehensive tests for interest-only loans
  - Tests validate balloon payment structure and lower regular payments
  - Comparison: Interest-only 79.71% more expensive than reducing balance but preserves capital
  - Created testInterestOnly.js demo showing use cases (bridge financing, investment properties)
  - All 52/52 tests passing (30 calculator + 22 loan calculations)

**Week 2 Summary**: Extended loan engine with simple interest and interest-only methods. Simple interest charges interest on original principal per period with actual day variations. Interest-only provides lower monthly payments with balloon principal at end, suitable for bridge financing and investment properties. All 4 amortization methods now implemented (reducing balance, flat rate, simple interest, interest-only). 52/52 tests passing. Ready for Week 3 loan product configuration.
  - Added `simple_interest` handling in `calculateLoanDetails()` method
  - Created `generateSimpleInterestSchedule()` with accurate period calculations
  - Added 4 comprehensive tests for simple interest method (48/48 tests passing)
  - Created comparison demo showing simple interest between reducing balance and flat rate costs
  - Test validates variable interest based on actual days per period
  - For ZMW 10,000 @ 24% for 6 months: Same total interest as flat rate (~ZMW 1,200) but payment amounts vary by days

- **Phase 0: Loan Engine Enhancement - Week 2, Days 3-4 ✅ COMPLETED**:
  - Implemented interest-only amortization method with balloon payment
  - Added `calculateInterestOnlyPayment()` function to interest calculator
  - Interest-only loans: Pay only interest each period, principal due at maturity
  - Added `interest_only` handling in `calculateLoanDetails()` method
  - Created `generateInterestOnlySchedule()` method with balloon payment flag
  - Added `isBalloonPayment` field to repaymentSchedule schema
  - Added 4 comprehensive tests for interest-only loans (52/52 tests passing)
  - Test validates balloon payment flag, lower regular payments, but higher total cost
  - Comparison: ZMW 50,000 @ 18% for 12 months
    * Interest-only: ZMW 750/month, ZMW 9,000 total interest, ZMW 50,000 balloon at end
    * Reducing balance: ZMW 4,584/month, ZMW 5,008 total interest
    * Interest-only is 79.71% more expensive but preserves capital
  - Created demo showing use cases (bridge financing, investment properties, business expansion)

**Week 2 In Progress**: Implemented simple interest and interest-only methods. System now supports 4 complete amortization methods. 52/52 tests passing.

### Changed
- Updated super user password reset script to avoid double-hashing
- Configured MongoDB Atlas connection string for cloud database
- Updated server package.json test scripts to use Jest
- **Loan model now uses daily interest accrual instead of monthly approximations**
- **Repayment schedules now generated with actual calendar dates**

### Fixed
- Fixed double password hashing issue in reset password utility

### Removed
- Removed local MongoDB dependency in favor of MongoDB Atlas

---

## [0.3.2] - 2026-02-09

### Added
- **Production Roadmap**:
  - Created comprehensive production readiness roadmap in `PRODUCTION_ROADMAP.md`
  - Detailed 10-phase transformation plan from MVP to enterprise-grade SaaS
  - Included gap analysis across security, infrastructure, testing, and compliance
  - Prioritized implementation with estimated timelines (16-24 weeks)
  - Aligned deployment strategy with Coolify self-hosted platform
  - Defined success metrics and KPIs for production readiness

- **Bootstrapped Cost Optimization Guide**:
  - Created `BOOTSTRAPPED_COST_OPTIMIZATION.md` for startup-friendly approach
  - Detailed self-hosting strategy for ~93% cost reduction ($3,000-17,000/year savings)
  - Complete guide for running testing infrastructure on Coolify (TestSprite alternative)
  - Self-hosted monitoring stack (Grafana, Prometheus, Loki, GlitchTip, UptimeKuma)
  - Free tier strategies for email (SendGrid), CDN (Cloudflare), and payment processing
  - Cost breakdown: $20-30/month fixed vs $300-1,500/month traditional SaaS
  - Reusable testing platform architecture for all future projects

- **Zambian Payment & Communication Guide**:
  - Created `ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE.md` for local context
  - WhatsApp Business API analysis ($50-100/month minimum - not recommended)
  - Email magic link authentication guide (free alternative to SMS OTP)
  - Flutterwave payment gateway guide (available in Zambia, unlike Stripe)
  - Recurring billing support for loan repayments via Flutterwave
  - Mobile money integration (Airtel Money, MTN Mobile Money)
  - Cost comparison: Email ($0) vs WhatsApp ($600-1,200/year) vs SMS ($120-480/year)

- **Implementation Roadmap**:
  - Created `NEXT_STEPS.md` with concrete 4-week action plan
  - Week 1: Foundation & Monitoring (Grafana, Prometheus, Loki, UptimeKuma)
  - Week 2: Email magic link authentication implementation
  - Week 3: Security hardening (audit logs, validation, rate limiting)
  - Week 4: Testing foundation (Jest, Supertest, CI/CD)
  - Includes daily task breakdowns with clear deliverables
  - Success criteria defined for each week
  - Cost timeline and learning resources included

- **Loan Management System Gap Analysis**:
  - Created `LMS_GAP_ANALYSIS.md` - comprehensive enterprise LMS feature comparison (50,000+ words)
  - Analyzed 8 domains: Loan Engine, Product Flexibility, Document Management, Credit Scoring, Reporting, Compliance, Advanced Features, Integrations
  - Compared current system against Mambu, nCino, Temenos, FIS LoanServ standards
  - Identified 70+ missing features with priority rankings and effort estimates
  - Total gap: 461 development days (12+ months to full enterprise parity)
  - Current system at 40% feature completeness vs. enterprise LMS
  - Phase 1 (Months 1-3): Core loan engine enhancements - 70 days, $28k traditional (bootstrapped: $0 + 168 hours personal time)
  - Includes detailed code examples and implementation recommendations
  - Focus areas: Daily interest accrual, flat rate amortization, product configuration, document verification, affordability analysis, aging reports, SMS notifications, Flutterwave integration

- **Phase 0: Loan Engine Technical Specifications**:
  - Created `PHASE_1_LOAN_ENGINE_SPECS.md` - detailed implementation guide (18,000+ words)
  - 5 sprints over 12 weeks @ 2 hours/day time budget (168 total hours)
  - Sprint 1 (Weeks 1-2.5, 35hrs): Multiple amortization methods (reducing balance, flat rate, interest-only, equal principal)
  - Sprint 2 (Weeks 3-4.5, 35hrs): Loan product configuration system with eligibility rules
  - Sprint 3 (Weeks 5-7, 42hrs): Repayment flexibility (bi-weekly/weekly schedules, prepayment, grace periods, balloon payments)
  - Sprint 4 (Weeks 8-9.5, 28hrs): Affordability & risk analysis (DTI calculator, credit bureau integration, automated underwriting)
  - Sprint 5 (Weeks 10-12, 28hrs): Reporting & testing (PAR30/60/90 analysis, schedule exports, 300+ test cases)
  - Includes complete database schemas, API specifications, UI mockups, test cases, and success criteria
  - Budget: $0 (self-implemented, bootstrapped approach with 2hr/day commitment)

### Changed
- **Documentation Organization**:
  - Archived historical changelog from v0.1.0 to v0.3.1 as `changelog_to_feb_2026.md`
  - Created fresh changelog for tracking changes from February 2026 onwards
  - Improved maintainability by separating historical and ongoing development logs
  
- **Production Roadmap Updates for Zambian Context**:
  - Updated authentication section with email magic link implementation (passwordless)
  - Replaced Stripe references with Flutterwave (available in Zambia)
  - Updated MFA strategy to use email OTP instead of SMS (cost-effective)
  - Modified Phase 8 to reflect Flutterwave integration with mobile money support
  - Added "launch with manual payments, automate later" strategy for bootstrapped approach
  - Updated payment architecture with ZMW (Zambian Kwacha) currency support
  - **MAJOR**: Reprioritized roadmap with Phase 0 (Loan Engine Enhancement, 12 weeks) before infrastructure work
  - **MAJOR**: Updated executive summary to emphasize loan engine gaps (40% completeness vs. enterprise)
  - Rationale: Core product value must be enterprise-grade before scaling infrastructure
  - Revised total timeline: 28-36 weeks (was 16-24 weeks) with loan engine first
  
- **Implementation Roadmap Restructure**:
  - Renamed original `NEXT_STEPS.md` to `NEXT_STEPS_INFRASTRUCTURE.md` (preserved for Phase 1+)
  - Created new `NEXT_STEPS.md` focused entirely on Phase 0 (Loan Engine)
  - 12-week implementation plan (84 days, Feb 10 - May 4, 2026)
  - Tailored to 2 hours/day time budget (14 hours/week, 168 total hours)
  - Week-by-week breakdown with daily 2-hour tasks and clear deliverables
  - Includes prerequisites, testing requirements, documentation needs for each day
  - Weekly milestone checkpoints and emergency fallback plans
  - Learning resources provided for financial mathematics and IFRS 9 standards
  
- **Bootstrapped Guide Updates**:
  - Added Zambian payment gateway recommendations
  - Updated email service recommendations for authentication use case
  - Added note about Stripe unavailability in Zambia
  - Included Flutterwave pricing for Zambian market (2% mobile money, 1.4% bank transfers)
