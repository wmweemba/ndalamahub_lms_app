# Phase 27 — Pre-launch fixes & production readiness

**Planned:** 2026-07-28 (Claude Code Fable). **Executes on:** `phase/27-pre-launch-fixes`, branched from `main`.
**Session size:** one ~1.5–2h session. Runs alongside Phase 26 (Coolify launch), not after it — these are launch-week corrections.
**Read first:** CLAUDE.md §§4, 5, 8; `docs/DECISIONS.md` "Manifi launch decisions (2026-07-22)" (items 2 and 7); `server/routes/loans.js`'s `canActOnLoanApproval` (the authority this phase mirrors on the client); `server/middleware/session.js`; `server/jobs/scheduler.js`.

This phase bundles the launch-week items surfaced during Phase 26 verification: four code fixes (loan-officer approval visibility, the broken dev auth environment, the Customers page never showing borrowers, and `lastLogin` never updating), one small UI clarification, and a production-readiness verification pass. Items 6a/6b are partly **manual** (William, on Coolify/Render/Netlify) — this doc's job is to make the code correct and then walk William through the config/infra steps exactly.

**Priority note:** Fix 3 (Customers page empty) is the most launch-critical — for a direct lender, the Customers tab is the primary operating surface and currently always renders "No customers found" even when borrowers exist (confirmed live in production 2026-07-28: a website-created borrower "Production Test" shows in Settings → User Management but not in Customers). Do this one first.

## Ground rules

- Full-stack phase (server changes in scope). Gate before merge: `cd server && pnpm test` (currently **343/343**) and `cd client && pnpm lint && pnpm build && pnpm test` (currently **73/73**) all green.
- Fix 1 must **exactly mirror** the server's existing authority (`canActOnLoanApproval`) — do not invent a looser or stricter client rule. The server remains the enforcer; this fix only makes the buttons match reality.
- Fix 2 must be **env-gated** so production (Coolify, same-domain) behaviour is byte-for-byte unchanged. Verify `git diff` shows the production code path (`CROSS_SITE_COOKIE` unset) still resolves to the old values.
- Stop-and-flag over improvisation.

---

## Fix 1 — Loan officers can't see Approve/Reject on direct loans (client, functional)

### The bug
`client/src/utils/roleUtils.js`'s `canApproveLoan(role)` returns true only for `platform_admin`, `lender_admin`, `employer_admin`, `employer_hr` — it omits `lender_officer`. But the server (`server/routes/loans.js`'s `canActOnLoanApproval`, added in Phase 19) gives `lender_officer` approval authority over **direct** loans. Its only call site, `LoanDetailsDialog.jsx:261` (`const userCanApprove = currentUser && canApproveLoan(currentUser.role)`), therefore hides Approve/Reject from loan officers entirely — breaking Manifi's confirmed "officer approves, admin disburses" model (DECISIONS.md item 2) on day one.

### The fix — a context-aware check mirroring the server
The loan detail dialog already has the full `loan` object (both `loan.company` and `loan.lenderCompany` are populated to `{ _id, name, type }` by the `GET /loans/:id` route). So the client can and should reproduce the server's exact logic rather than widening a role-only list.

**Server reference (do not change — mirror it):**
```js
// server/routes/loans.js
function canActOnLoanApproval(user, loan) {
  if (isPlatformAdmin(user)) return true;
  const isDirect = idsEqual(loan.company, loan.lenderCompany);
  if (isDirect) {
    return isLenderSide(user) && idsEqual(loan.lenderCompany, user.company);
  }
  return (isEmployerSide(user) && idsEqual(loan.company, user.company)) ||
    (user.role === 'lender_admin' && idsEqual(loan.lenderCompany, user.company));
}
// isLenderSide = lender_admin | lender_officer; isEmployerSide = employer_admin | employer_hr
// idsEqual handles either a populated doc ({_id}) or a raw id, via String(x._id ?? x)
```

**Steps:**

1. In `client/src/utils/roleUtils.js`, add an id-equality helper mirroring `server/utils/tenantScope.js`'s `idsEqual` — it **must** handle both shapes, because the client's cached `currentUser.company` is a raw id string when hydrated from the login response but a populated object when hydrated from `GET /auth/me` (confirm both paths; the helper covers it):
   ```js
   const idsEqual = (a, b) => {
     if (!a || !b) return false;
     const aId = a._id ? a._id : a;
     const bId = b._id ? b._id : b;
     return String(aId) === String(bId);
   };
   ```
2. Add `canApproveLoanForLoan(user, loan)` reproducing `canActOnLoanApproval` exactly (platform_admin → true; direct loan → lender-side role AND `idsEqual(loan.lenderCompany, user.company)`; employer loan → employer-side of the loan's company, or lender_admin of the loan's lender). Use `ROLES` constants and lender-side/employer-side arrays.
3. Keep the old `canApproveLoan(role)` **only if** something still needs a role-only check — audit shows its **single** call site is `LoanDetailsDialog.jsx:261`. Migrate that site to `canApproveLoanForLoan(currentUser, loan)` and then **delete** `canApproveLoan(role)` (a known-buggy role-only gate with no remaining caller is a trap for the next developer). If the audit finds any other caller, migrate it too or flag why it can't be.
4. `LoanDetailsDialog.jsx:261`:
   ```js
   const userCanApprove = canApproveLoanForLoan(currentUser, loan);
   ```
   (Guard for a null `loan` if the dialog can render before the loan loads — return early/false as the current `currentUser &&` guard did.)

### Tests
Add to `client/src/components/loans/LoanDetailsDialog.test.jsx` (or a `roleUtils` unit test if cleaner): with fixtures where `loan.company === loan.lenderCompany` (direct), a `lender_officer` **of that lender** sees Approve/Reject; a `lender_officer` of a **different** lender does not; a `lender_admin` of that lender does. With an employer-model fixture (`loan.company !== loan.lenderCompany`), the pre-existing behaviour holds (employer_hr of the loan's company yes; lender_officer no; lender_admin of the lender yes). Also assert `canDisburseLoan` is unchanged (still `lender_admin`/`platform_admin` only — disbursement authority is not touched by this phase).

### Acceptance
On the dev DirectLend Test fixture (or Manifi production, carefully), a `lender_officer` opening a `pending`/`pending_approval` direct loan sees Approve and Reject and can approve; a `lender_admin` can then disburse. Employer-model behaviour unchanged. Client suite green.

---

## Fix 2 — Dev Render/Netlify auth broken by the Phase 25 cookie migration (server, env-gated)

### The bug (two layers)
1. **Boot crash:** Phase 25 made `SESSION_SECRET` a required env var (`server/server.js` fail-fast). The dev Render service never had it added → the server exits at boot (`Missing required environment variables: SESSION_SECRET`). **Config-only, William** — see manual steps.
2. **Cross-site cookie:** even once it boots, the session cookie is `sameSite: 'lax'` (`server/middleware/session.js`). The dev frontend (`ndalamahublms.netlify.app`) and backend (`ndalamahub-lms-app.onrender.com`) are **different registrable domains**, so the browser won't send a `lax` cookie on the SPA's cross-site XHR — login returns 200 but the next request is unauthenticated and bounces to `/login`. Production (Coolify, same parent domain `*.nxhub.online`) is unaffected — this is dev-only.

### The fix — env-gated cross-site cookie
Make the cookie's `sameSite`/`secure` respond to a `CROSS_SITE_COOKIE` flag, defaulting to today's behaviour when unset (so production is untouched). In `server/middleware/session.js`:

```js
const crossSite = process.env.CROSS_SITE_COOKIE === 'true';
// ...
cookie: {
  httpOnly: true,
  // SameSite=None REQUIRES Secure — force it on when cross-site, otherwise keep the prod rule
  secure: crossSite || process.env.NODE_ENV === 'production',
  sameSite: crossSite ? 'none' : 'lax',
  // ...existing maxAge / rolling settings unchanged
},
```

No other server code changes. Confirm the mount order and the global CORS (`app.js`: `cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true })`) already send credentials — they do (Phase 25). The client already sets `withCredentials: true` (`api.js`). The remaining coupling is purely configuration (below): with credentials, `CORS_ORIGIN` **must** be the exact Netlify origin, not `*` (browsers reject wildcard + credentials), and `originCheck` (`allowedOrigins = [CORS_ORIGIN, APP_URL]`) must include it so the login `POST` isn't 403'd.

### Tests (light — the behaviour is config-gated)
Optional but preferred: a Supertest case that, with `process.env.CROSS_SITE_COOKIE='true'` set for that test, logs in and asserts the `Set-Cookie` header contains `SameSite=None` and `Secure`; and the default case still yields `SameSite=Lax`. If mutating env mid-suite is awkward given the existing `jest.env.js` setup, skip the automated test and rely on the manual browser verification below — flag which you chose. Do **not** destabilise the existing session/originCheck tests.

### Manual steps for William (config — Sonnet: walk him through these, do not attempt them)
These cannot be done from the repo. Sonnet should present them clearly and offer help if any step is unclear.

**On Render (backend service `ndalamahub-lms-app`), add/set environment variables:**
- `SESSION_SECRET` = a long random string (e.g. `openssl rand -hex 32`). Fixes the boot crash. (Does **not** need to match production.)
- `CROSS_SITE_COOKIE` = `true`
- `CORS_ORIGIN` = the exact Netlify origin, no trailing slash — **verify the real URL first** (`https://ndalamahublms.netlify.app` unless it's since changed)
- `NODE_ENV` = `production` (if not already; keeps `secure` cookies + prod behaviour)
- Optional cleanup: remove the now-unused `JWT_SECRET`.

**On Netlify (frontend site), set and redeploy:**
- `VITE_API_URL` = `https://ndalamahub-lms-app.onrender.com/api` — **with the `/api` suffix** (every call site assumes `/api` is part of the base; this was the exact production bug fixed on 2026-07-24). `VITE_*` vars are baked at build time, so **trigger a fresh deploy** after setting it.

**Then verify in a browser:** open the Netlify site → log in as a seeded dev user → confirm you land on the dashboard and it **stays** (no bounce to `/login`) → hard-refresh (session survives) → navigate → log out. If it still bounces, check the browser devtools Network tab: the login response should carry `Set-Cookie` with `SameSite=None; Secure`, and the subsequent `/auth/me` request should send that cookie. Report what you see.

### Acceptance
Dev Render server boots; browser login on the Netlify dev site holds across navigation and refresh. Production (Coolify) behaviour provably unchanged (the `CROSS_SITE_COOKIE`-unset path is identical to before). Server suite green.

---

## Fix 3 — Customers page always shows "No customers found" for direct lenders (client, functional — launch-critical)

### The bug
`client/src/pages/customers/CustomersPage.jsx`'s query reads the wrong response shape. `GET /api/users` returns `{ success: true, data: [...] }` (see `server/routes/users.js` list handler, ~line 109), but the queryFn does:
```js
const response = await api.get('/users?role=borrower');
return Array.isArray(response.data) ? response.data : [];   // response.data is {success, data} — never an array → always []
```
So `customers` is **always** `[]` and the page always renders the empty state — even though the borrowers exist. `Settings → User Management` (`UserManagement.jsx`) reads the same endpoint correctly (`setUsers(response.data.data)`), which is why the same borrower shows there but not in Customers. Confirmed live in production 2026-07-28 ("Production Test" borrower visible in User Management, absent from Customers). The Phase 23 tests mock `api.get` as returning a bare array, so they never exercised the real `{success, data}` shape — this escaped until production.

### The fix
Read the array from `response.data.data`:
```js
queryFn: async () => {
  const response = await api.get('/users?role=borrower');
  return Array.isArray(response.data?.data) ? response.data.data : [];
},
```
Audit the rest of `CustomersPage.jsx` (and `CustomerDetailDialog.jsx` if it re-fetches) for the same `response.data` vs `response.data.data` confusion and fix any other instance. Do **not** change the server response shape (User Management and other callers depend on `{success, data}`).

### Tests
Update `client/src/pages/customers/CustomersPage.test.jsx`: the `api.get` mock for `/users?role=borrower` must return the **real** shape `{ data: { success: true, data: [ ...borrowers ] } }` (axios wraps the body in `.data`, so the mock's resolved value is `{ data: <body> }`), and the test must assert a seeded borrower **renders in the list** (not just that the page mounts). This is the assertion that was missing and would have caught the bug. Verify the existing tests still pass with the corrected mock shape.

### Acceptance
On production (or dev with a seeded direct borrower), the Customers tab lists the borrower(s) that exist under the lender — "Production Test" appears in Customers, matching User Management. Search by name/NRC/phone works.

---

## Fix 4 — `lastLogin` never updates (server, minor)

### The bug
`User.js` has a `lastLogin` field and `UserManagement.jsx` displays it ("Last login", falling back to "Never"), but `POST /api/auth/login` (`server/routes/auth.js`) never sets it — so every user shows "Never", including users who are currently logged in (confirmed: Clement shows "Never" while viewing the page as himself).

### The fix
In the login route, after credentials are verified and before/around the session is established, set `user.lastLogin = new Date()` and persist it (`await user.save()`, or a targeted `User.updateOne({ _id: user._id }, { lastLogin: new Date() })` to avoid re-running the full save/validation path — pick whichever is consistent with how the route already loads the user, and don't disturb the password-hash pre-save hook). Confirm this doesn't interfere with the Phase 25 session regeneration.

### Tests
Add a Supertest assertion (in the sessions/auth test file): after a successful `POST /api/auth/login`, the user's `lastLogin` is set (non-null, recent). Keep it light.

### Acceptance
After logging in, that user's "Last login" in User Management shows a real recent timestamp, not "Never".

---

## Item 5 — System Settings is a non-functional stub (client, clarity only)

Access is already correctly locked to `platform_admin` (fixed 2026-07-28). The page's controls, however, don't persist (`PUT /system/settings` is a `console.log` no-op) and its readouts (`GET /system/info` dbStatus/storageUsed, health, backup) are hardcoded mocks — a decision to leave for post-launch (DECISIONS.md / UI_SPEC punch list). To stop it misleading its only viewer (the platform owner):

- In `client/src/components/settings/SystemSettings.jsx`, add a single informational banner at the very top of the returned markup (above "System Information") — warning-tinted, using the app's existing status-tint tokens — reading approximately: *"Display only — these values are placeholders and changes are not yet saved. Full System Settings backing is planned post-launch."* No behaviour change, no removal of controls.
- Do **not** build real backing this phase (that's a full-stack post-launch item needing a settings model + routes).

Acceptance: the banner renders for `platform_admin`; nothing else changes.

---

## Item 6 — Production readiness verification (mostly manual; Sonnet guides, William executes)

Not code bugs — checks that must pass before real borrower data exists. Sonnet performs what it can via the Coolify logs/shell if available, otherwise walks William through each.

### 6a — Confirm the scheduled jobs actually run in production
`server/jobs/scheduler.js` starts from `server/server.js` **unless** `NODE_ENV==='test'` or `ENABLE_CRON==='false'`. The four jobs: `markOverdueInstallments` 01:00, `rolloverLoans` 01:30, `expireSubscriptions` 02:00, `sendPaymentReminders` 08:00 (Africa/Lusaka). The **rollover job is business-critical** for Manifi — if it doesn't run, overdue loans never capitalize.

- Confirm on the Coolify server: `NODE_ENV=production` and `ENABLE_CRON` is **unset or `true`** (not `false`).
- Confirm the startup log line is present in the Coolify logs: `[cron] scheduler started (markOverdueInstallments daily @ 01:00, rolloverLoans daily @ 01:30, …)`. If it's absent, the scheduler didn't start — investigate the two env conditions above.
- **Single instance only:** confirm the Coolify service runs exactly **one** replica/container. The jobs have **no distributed lock** (documented constraint, CLAUDE.md §3) — two instances would double-run every job (e.g. roll a loan over twice in one night). If Coolify is set to scale >1, either scale to 1 or flag that a job lock is now required (that would be a new, separate piece of work — do not build it under time pressure this week; scaling to 1 is the launch answer).
- Optional smoke: run `pnpm job:overdue` once manually against production and confirm it completes cleanly (it's idempotent).

### 6b — Backups before real data
The fresh production DB will hold real borrower/loan/collateral records within days. Before that:

- Configure a scheduled `mongodump` (Coolify scheduled task, or the Mongo service's own backup feature) writing to **off-VPS** storage, with a stated retention (e.g. daily, keep 7). Record the schedule + destination in the runbook.
- **Do one restore test** — dump, restore into a throwaway DB, confirm collections/counts. A backup that has never been restored is not a backup. (Phase 26's runbook lists this; this phase makes sure it's actually done, not just planned.)

Acceptance: crons confirmed scheduled + single-instance; a backup has run **and** been test-restored once. Record both outcomes for the Phase 26 runbook / changelog.

---

## Deferred to post-launch (record, do not build here)

Flagged during the 2026-07-28 production review; William confirmed these are **not** launch-critical:
- **User Management table requires horizontal scrolling** to see all columns (role/company/status/last-login/actions) — the wide table isn't great UX. Polish post-launch; belongs on the UI punch list (`docs/18-post-demo-ui-punchlist.md`).
- **Mobile/responsive review** of User Management (and the Customers surface generally) — confirm the tables collapse to card lists sensibly on small screens. Post-launch.
- **Two-step onboarding model** (approve customer, then separately approve loan) — discussed 2026-07-28; the current one-step atomic conversion (approve application → customer + pending loan + collateral, then the loan's own approval/disburse gates) is correct and stays for launch. Revisit as a potential post-launch refinement only if William still wants it after operating the current flow.

## Close-out (for the executing session)

- Server suite green (343 + Fix-2/Fix-4 tests), client suite green (73 + Fix-1/Fix-3 tests), lint/build clean.
- Update `changelog.md` with a Phase 27 entry (the four code fixes, the System Settings banner, and the readiness-check outcomes incl. William's config actions).
- Update `CLAUDE.md`: strike the two "known open issues" from the 2026-07-28 Last-updated note as they're closed; add that Fix 3 (Customers-empty) and Fix 4 (lastLogin) are closed; note the dev environment is restored in §4; keep the System Settings stub caveat (still a stub, just now labelled).
- **Do not finalize the cross-repo documentation or commit** beyond the LMS repo's own changelog/CLAUDE.md and this phase's code — William will return for a final review pass across all three repos (LMS, manifipay_website, wsm-second-brain) and authorise the commits/pushes himself.
- Merge `phase/27-pre-launch-fixes` → `main` only on William's go-ahead (launch week — he may want to review the diff first).

## Notes for William (manual actions summary)
1. **Render:** add `SESSION_SECRET`, `CROSS_SITE_COOKIE=true`, `CORS_ORIGIN=<exact Netlify URL>`, ensure `NODE_ENV=production`.
2. **Netlify:** set `VITE_API_URL=https://ndalamahub-lms-app.onrender.com/api` and redeploy.
3. **Coolify (production):** confirm single instance + `ENABLE_CRON` not `false`; verify the `[cron] scheduler started` log line; configure + test-restore a backup.
The code fixes (1, 3, 4) and the System Settings banner need no action from you. Sonnet will prompt you at the right moments for the config/infra items and can help troubleshoot each.
