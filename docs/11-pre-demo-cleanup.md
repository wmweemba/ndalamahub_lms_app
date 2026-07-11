# Phase 11 — Pre-Demo Cleanup

**Prerequisite:** Phases 01–10 merged; suite green at 251/251. Branch: `phase/11-pre-demo-cleanup` off `main`.

## Objective

Close out every small, known, code-level leftover from phases 01–10 before the Manifi demo and the UI build: make the dashboards arrears-aware (the Phase 07 flag — currently a loan entering `in_arrears` silently vanishes from every dashboard count), fix the `GET /api/loans` status-param 500 (the Phase 02 flag), build the owner-facing new-ticket alert (the Phase 08 flag deferred out of 09), finish the Phase 04 tenancy-migration leftovers, and clear the accumulated housekeeping (stray files, dead config, unarchived legacy docs, unverified hosting inventory). After this phase, CLAUDE.md Sections 6 and 7 should contain **no open "flagged, not fixed" code items** — everything remaining on the roadmap is either the UI build, the Coolify migration, or an explicitly deferred decision in `docs/DECISIONS.md`.

**Zero client changes.** The frontend freeze (CLAUDE.md Section 9) holds until UI_SPEC exists. The new dashboard fields are additive server-side response fields the UI phase will consume later.

## Verified current state (2026-07-11, read before starting)

- `/lender-stats` and `/hr-stats` (`server/routes/dashboard.js`) both already fetch the caller's full scoped loan set via `await Loan.find(await loanScopeFilter(req.user))` and derive every count with in-memory `.filter()` calls. Neither has any `in_arrears`/`defaulted` count — and note `activeLoans` counts strictly `status === 'active'`, so arrears loans currently appear in **no** bucket.
- `GET /api/loans` (`server/routes/loans.js`) still does `if (status) { filter.status = status; }` with no shape/enum validation — after `express-mongo-sanitize` strips an injected operator (e.g. `?status[$ne]=x`), `filter.status` is `{}` and Mongoose throws a cast error → 500. The security property holds; the failure mode is just ugly.
- `POST /api/tickets` (`server/routes/tickets.js` ~98) creates the ticket and notifies nobody. Phase 09's counterparty notifications cover replies and status changes only. `server/utils/email.js` exports `sendEmail({to, subject, html})` — never throws, no-ops with a warn log when `RESEND_API_KEY` is unset. `server/utils/emailTemplates.js` exports eight templates behind a shared `layout()`; template functions return `{subject, html}`.
- Phase 04 leftovers confirmed still on the pre-04 inline pattern: `PATCH /api/users/:id/reset-password` (`users.js` — inline `corporateCompanies` lookup; note `users.js` already has the Phase 04 `canTouchUser` helper to reuse) and `GET /api/reports/users` (`reports.js` ~846 — same inline lookup). `products.js`'s `/available` (and `/category/:category`, `/stats/overview`) build role-branched filters inline; no unsafe comparisons, just inconsistency.
- Stray files at `server/routes/loans.js.backup`, `server/check_user_company.js`, `server/debug_db.js` (all flagged since Phase 03b planning). `JWT_EXPIRE` still sits unused in the local `server/.env`.
- Three legacy docs whose archive obligations were missed by their phases are still live in `docs/`: `LOAN_ENGINE_DOCUMENTATION.md` (Phase 05), `FRONTEND_TEST_PLAN.md` (Phase 03), `ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE.md` (Phase 09).
- CLAUDE.md Section 4 still says the current hosting split (Render/Railway backend, Vercel frontend) is *believed*, not verified — and per the locked 2026-07-11 cutover decision, the dev environment doubles as the client demo environment, so its hosting must be known and presentable.

## Scope

- Modified: `server/routes/{dashboard,loans,users,reports,products,tickets}.js`, `server/utils/emailTemplates.js`, `server/.env.example`, `server/tests/api/` (new/extended test files)
- New: `server/utils/telegram.js`
- Deleted: `server/routes/loans.js.backup`, `server/check_user_company.js`, `server/debug_db.js`
- Moved: the three legacy docs → `docs/archive/`
- Docs: `CLAUDE.md`, `changelog.md`, `docs/README.md`

**Out of scope:** any client/UI change (Section 9 freeze); the auth migration and `isActive` stopgap (deferred decision); penalty/late fees (awaiting Clement); notification preferences or an in-app notification center (deferred from Phase 09); anything Coolify (separate runbook doc). If migrating a leftover route reveals an *authorization* bug (not scoping inconsistency), stop and flag it — hotfix rules apply.

## Step-by-step instructions

### Session A — dashboards, status validation, tenancy leftovers (~1.5–2h)

**Step 1 — Arrears-aware dashboards.** In `server/routes/dashboard.js`:

1a. `/lender-stats`: alongside the existing `.filter()` counts, add:

```js
const inArrearsLoans = allLoans.filter(loan => loan.status === 'in_arrears').length;
const defaultedLoans = allLoans.filter(loan => loan.status === 'defaulted').length;
```

and include both in the `portfolioSummary` object of the response. Do **not** change the meaning of `activeLoans` (stays strictly `status === 'active'`) — the UI phase will decide how to present "performing vs in arrears"; this phase only stops the data from vanishing.

1b. `/hr-stats`: same two counts over `companyLoans`, added to that route's summary object.

1c. Tests (`server/tests/api/` — extend `reports.tenancy.test.js`'s dashboard describe blocks or add `dashboard.arrears.test.js`): seed a tenant-A loan, flip it to arrears **through the real path** (past-due installment + run `markOverdueInstallments()` from `server/jobs/markOverdueInstallments.js`, not by writing `status` directly — this also pins the job→dashboard integration), then assert `/lender-stats` as lenderAdminA shows `inArrearsLoans: 1` and the loan is absent from `activeLoans`; assert tenant-B's dashboard still shows `inArrearsLoans: 0` (tenancy holds on the new fields).

**Step 2 — `GET /api/loans` status-param validation.** In the list route, replace the bare assignment with an enum-validated one, sourcing values from the schema so there is no hardcoded list to drift:

```js
if (status !== undefined) {
  const validStatuses = Loan.schema.path('status').enumValues;
  if (typeof status !== 'string' || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status filter' });
  }
  filter.status = status;
}
```

This turns both the sanitized-operator case (`status` becomes `{}` → not a string → 400) and a plain typo (`?status=actve`) into a clean 400. Tests: `?status[$ne]=x` → 400 (not 500, and not all loans — pin both); `?status=active` → 200 filtered; `?status=nonsense` → 400. Put them in `loans.tenancy.test.js` or a small `loans.filters.test.js`.

**Step 3 — Finish the Phase 04 leftovers.** Same rules as Phase 04: `authorize` guards stay; only document/filter scoping moves to the module; behavior is preserved except where noted.

3a. `users.js` `PATCH /:id/reset-password`: replace the inline lender-admin `corporateCompanies` block with the existing local `canTouchUser(req.user, user)` helper (it implements exactly this rule). No behavior change intended.

3b. `reports.js` `GET /users`: replace the inline role-branched company filter (~line 846) with `mergeFilters(await userScopeFilter(req.user), <the route's own criteria>)`.

3c. `products.js` `/available`, `/category/:category`, `/stats/overview`: replace the inline role branches with the module helpers already used elsewhere in the file (`isPlatformAdmin`, `idsEqual`, `companyLenderId`) — `/available`'s employer-side/borrower path resolves the caller's lender via `companyLenderId(req.user.company)` exactly as the eligibility endpoints do. No behavior change intended.

3d. Regression: run the full suite after each file; `grep -rn "corporateCompanies" server/routes/` should return only sites that are *authorization* lists rather than scoping (justify any survivor in the changelog); add one API test per migrated route only where none exists (reset-password cross-tenant deny likely already lacks a pin — add: lenderAdminA resetting borrowerB's password → 403; lenderAdminA resetting borrowerA's (own client) password → 200, preserving the Phase 04 `canTouchUser` semantics).

**Session A gate:** suite green (251 + new tests), commit.

### Session B — owner ticket alert, housekeeping, hosting inventory (~1.5–2h)

**Step 4 — Owner-facing new-ticket alert (email + Telegram).**

4a. New `server/utils/telegram.js`, mirroring `email.js`'s contract exactly — never throws, no-ops with a single warn log when unconfigured:

```js
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] disabled (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID unset) — skipped:', text.slice(0, 80));
    return { skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!res.ok) console.error('[telegram] send failed:', res.status, await res.text());
    return { skipped: false, ok: res.ok };
  } catch (error) {
    console.error('[telegram] send failed:', error.message);
    return { skipped: false, ok: false };
  }
}
module.exports = { sendTelegramMessage };
```

Uses global `fetch` (Node ≥18 — the local env is Node 24 and the Coolify runbook already floors at ≥20.19). No new dependency.

4b. New template `ticketCreated({ticketNumber, subject, category, priority, creatorName, companyName})` in `emailTemplates.js` (same `layout()` wrapper, returns `{subject, html}`; subject like `New ticket ${ticketNumber}: ${subject}`).

4c. Wire in `tickets.js` `POST /` after the successful `ticket.save()`/populate: send the email to `process.env.OWNER_ALERT_EMAIL` (skip entirely, without warning noise, if unset) and `sendTelegramMessage()` with a short one-liner (`New ticket ${ticketNumber} [${priority}] from ${creatorName} (${companyName}): ${subject}`). Fire both **without letting failure affect the response** — both utils already never throw; do not make ticket creation await-fail on notification problems. **Deliberate scope decision: the alert fires for every new ticket regardless of handler side** (lender-handled and platform-handled alike) — at single-tenant scale William wants full visibility; revisit the filter when ticket volume makes it noise. If this is wrong, veto at review, not mid-execution.

4d. Env: add `OWNER_ALERT_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` to `server/.env.example` (all optional, comments only, no real values — the bot token is a secret). William supplies the real values in his local `.env` (create the bot via @BotFather; get the chat id by messaging the bot and reading `getUpdates`).

4e. Tests (extend `server/tests/api/tickets.test.js`, with `utils/email.js` and `utils/telegram.js` mocked per the Phase 09 convention — no real sends in the suite): creating a ticket calls the email util with the `ticketCreated` subject and `OWNER_ALERT_EMAIL`, and calls the telegram util once; creating a ticket with both channels unconfigured still returns 201.

**Step 5 — Housekeeping.**

5a. `git rm server/routes/loans.js.backup server/check_user_company.js server/debug_db.js`. Before deleting the two scripts, skim them to confirm they're the ad-hoc debug utilities they appear to be (they predate the phases); if either contains anything load-bearing, stop and flag.

5b. Remove `JWT_EXPIRE` from the local `server/.env` (manual, uncommitted) and delete the "JWT_EXPIRE … safe to delete whenever convenient" note from CLAUDE.md Section 4.

5c. `git mv docs/LOAN_ENGINE_DOCUMENTATION.md docs/FRONTEND_TEST_PLAN.md docs/ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE.md docs/archive/` and delete the now-satisfied "Live legacy docs" section of `docs/README.md` (replace with one line noting all three were archived in Phase 11). Do **not** rewrite `LOAN_ENGINE_DOCUMENTATION.md` — Phase 05's "archive or rewrite" resolves as archive; the loan engine's current source of truth is the code plus CLAUDE.md Section 3 and the Phase 05 doc.

**Step 6 — Hosting inventory (requires William).** Verify the actual current deployment: which service hosts the backend (Render or Railway — check both dashboards), which hosts the frontend (Vercel), the live URLs, and which database each points at. Record the result in CLAUDE.md Section 4, replacing the "believed to be… verify before assuming" hedge with facts (names and URLs only — no secrets). This is a blocker for the demo (the demo runs on this environment) and an input to the Coolify runbook. If William isn't available during the session, leave Section 4's hedge in place, note it in the changelog as the phase's one open item, and do not guess.

**Step 7 — Close out.** Update `CLAUDE.md`: Section 3 (new test count; add `telegram.js` to the email/notifications line; note the three new optional env vars), Section 4 (hosting facts from Step 6; JWT_EXPIRE note removed), Section 6 (mark the dashboard-blindness and `status[$ne]` items resolved in Phase 11), Section 7 (delete the "Not yet migrated" paragraph — it should now be empty), and the Last-updated line. **Sweep all of CLAUDE.md's phase-status references** (Sections 2, 3, 11 have each drifted before). `changelog.md` entry. `docs/README.md`: add the Phase 11 row. Commit; merge `phase/11-pre-demo-cleanup` green; **push `main` to origin** (pushing is part of close-out — phases 07–10 were each left unpushed).

## Acceptance criteria

1. Suite green with ~10–14 new tests, including as named musts: the arrears-count-via-real-job dashboard test (Step 1c), the `?status[$ne]=x` → 400-not-500 pin (Step 2), the reset-password cross-tenant 403 + own-client 200 pair (Step 3d), and the ticket-alert-fires + alert-unconfigured-doesn't-break-creation pair (Step 4e).
2. `git grep -n "corporateCompanies" server/routes/` → no scoping survivors (any hit justified in the changelog); CLAUDE.md Section 7's "Not yet migrated" list is gone.
3. A loan in `in_arrears` on the Atlas dev DB (there is at least one — `LN20260009` from Phase 07 verification, if still in that state) appears in `manager`'s `/lender-stats` response under `inArrearsLoans` — manual check.
4. Creating a ticket on the dev environment with real `OWNER_ALERT_EMAIL`/Telegram values configured delivers both notifications (one-time manual verification, artifacts left in place per Atlas precedent); with them unset, creation works with only warn logs.
5. The three stray files are gone; the three legacy docs live under `docs/archive/`; `docs/README.md` reflects it.
6. CLAUDE.md Section 4 states the verified hosting facts (or the changelog records Step 6 as the single open item).
7. Zero changes under `client/` (`git diff main -- client/` empty at merge).
8. Merged **and pushed** to origin/main.

## Session sizing

Two sessions as marked. If Session B runs long, Steps 4 (alert) and 5–7 (housekeeping/close-out) split cleanly — commit after Step 4 with the suite green.

## Rollback

Revert the merge commit. No data migrations, no schema changes; the new env vars are optional and their absence is a silent no-op, so a rollback needs no environment work.

## Flagged concerns

- The alert-on-every-ticket decision (Step 4c) is deliberately broad for the single-tenant era — expect to add a handler-side filter or per-user notification preferences (the Phase 09 deferred item) once more tenants exist.
- `fetch` in `telegram.js` sets the server's effective Node floor at 18 (the Coolify runbook already requires ≥20.19 for the ESM-uuid reason, so this adds no real constraint — noting it for completeness).
- If Step 6 reveals the dev environment is *not* actually deployed anywhere reachable (e.g., everything has been local all along), demo hosting becomes a real task — raise it immediately for the Coolify runbook's scope rather than absorbing it here.
