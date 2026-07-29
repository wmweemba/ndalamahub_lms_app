# Production runbook — NdalamaHub (Manifi)

**Owner:** William (Nexus, platform owner). **Last updated:** 2026-07-29 (Phase 26/27 launch week).

This is the operational reference for the live Manifi production environment — not a build/architecture doc (see `CLAUDE.md` for that). Keep this file current whenever the production setup changes (new env var, new backup target, a second lender onboarded, etc.).

---

## 1. Environment map

- **Hosting**: Coolify-managed Hetzner VPS.
- **Client**: `https://ndalamahub.nxhub.online` (static build, Nixpacks/Node build via `pnpm build` in `client/`).
- **API**: `https://api.ndalamahub.nxhub.online` (Node/Express, `server/`). Client's `VITE_API_URL` must include the `/api` suffix: `https://api.ndalamahub.nxhub.online/api`.
- **Database**: MongoDB service running on the same Coolify instance. Fresh/empty at production cutover (2026-07-24) — no data migrated from the Atlas dev cluster.
- **Dev/staging/demo** (separate, permanent, untouched by production changes): Render (backend) + Netlify (frontend) + MongoDB Atlas (`ndalamahub-prod` cluster, despite the name — it's the dev/demo DB, not production).
- **Single-tenant today**: Manifi Investments Limited (`lendingModel: 'direct'`), one loan product, public intake live at slug `manifipay` (`https://manifipay.com` → `POST /api/public/manifipay/applications`).

---

## 2. Deploy procedure

1. Push to `main` on GitHub (`wmweemba/ndalamahub_lms_app`).
2. Coolify auto-deploys both services (`ndalamahub-server`, the client build) from `main` on push. Each rebuilds independently via Nixpacks (`pnpm install --frozen-lockfile` then `pnpm build`/`pnpm start` per service).
3. **Watch the deployment in Coolify's Logs tab** until it reports success. Known gotcha: a **first-ever cold build** (no cached Nix derivations yet) can fail or appear to hang for several minutes while Nix installs the Node/pnpm toolchain from scratch — if a deploy fails with no clear error at the end of the log, **retry the deploy first**; it usually succeeds once the toolchain is cached. If it fails again, search the log for `ERROR` or `exit code` (BuildKit only clearly marks the actually-failing step that way) rather than reading from the top.
4. After a successful deploy, spot-check the app (login, a known-working page) before considering it live — Coolify doesn't automatically roll back a "successful" deploy that's actually broken at the application level.

### Rolling back a bad deploy
- **Fastest**: in Coolify's deployment history for the affected service, pick the last known-good deployment and choose "Redeploy" (exact wording may vary by Coolify version) — this rebuilds and serves that earlier commit again.
- **Alternative**: `git revert <bad-commit>` on `main` and push — this is the safer choice if the rollback needs to persist (a straight Coolify redeploy of an old commit will be overwritten by the next push to `main`; a `git revert` keeps `main` itself correct).

---

## 3. Environment variables (names only — see `server/.env.example` / `client/.env.example` for the full annotated list; never commit real values anywhere)

**Server** (`ndalamahub-server` service):
- Required (server exits at boot if missing): `MONGODB_URI`, `SESSION_SECRET`
- `NODE_ENV=production`
- `PORT`
- `CORS_ORIGIN` — must be the exact client origin (`https://ndalamahub.nxhub.online`), not `*`, since sessions require `credentials: true`
- `APP_URL` — used in email templates (reset/invite links) and as a fallback origin-check value
- `ENABLE_CRON` — **leave unset, or explicitly `true`.** If this is ever set to the string `false`, the four scheduled jobs (see §5) stop running entirely.
- `CROSS_SITE_COOKIE` — **must stay unset in production.** This flag exists only for the dev Render/Netlify cross-domain cookie workaround (Phase 27); setting it in production would change the session cookie's `SameSite`/`Secure` behavior unnecessarily, since Coolify's client+API share a parent domain already.
- Email (Resend, optional — mail silently no-ops if unset): `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`
- Owner alerts (optional, silently no-op if unset): `OWNER_ALERT_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

**Client** (static build service):
- `VITE_API_URL` — must be `https://api.ndalamahub.nxhub.online/api` (with the `/api` suffix — every client call site assumes it's part of the base URL). `VITE_*` vars are baked in at build time; changing this requires a fresh deploy, not just an env var edit.

---

## 4. Scheduled jobs (cron)

Four daily jobs, Africa/Lusaka time, started automatically at boot by `server/server.js` (see `ENABLE_CRON` above):

| Job | Time | Purpose |
|---|---|---|
| `markOverdueInstallments` | 01:00 | Flips overdue installments, updates arrears status |
| `rolloverLoans` | 01:30 | **Business-critical** — capitalizes overdue balances on rollover-enabled products past their grace period |
| `expireSubscriptions` | 02:00 | Advances subscription status, emails affected lender admins |
| `sendPaymentReminders` | 08:00 | T-3-day reminders and overdue notices |

**Confirm they're running**: search the runtime (not build) logs for `[cron] scheduler started (...)` shortly after any deploy/restart.

**Single-instance constraint**: none of these jobs have a distributed lock. If the Coolify service is ever scaled to more than one replica, every job would double-run nightly (e.g. rolling a loan over twice in one night). Keep it at exactly one instance unless a locking mechanism is built first — that would be new work, not a config change.

**Manual triggers** (run from a shell in the server container, e.g. via Coolify's terminal/exec):
```bash
pnpm job:overdue        # markOverdueInstallments — safe to run anytime, idempotent
pnpm job:rollover       # rolloverLoans — idempotent, but don't run casually in production outside the schedule
pnpm job:subscriptions  # expireSubscriptions
pnpm job:reminders      # sendPaymentReminders
```

---

## 5. One-off maintenance scripts (`server/utils/`)

All follow the same pattern: env vars at runtime (never hardcoded secrets), run directly with `node utils/<script>.js` from a shell in the server container. None are registered as `pnpm` scripts (deliberately — they're one-offs, not routine operations).

- `seedSuperUser.js` — bootstrap the first `platform_admin` account. `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` env vars. Idempotent.
- `resetAdminPassword.js` — reset any user's password directly, with a full before/after diagnostic. `RESET_USERNAME`/`RESET_PASSWORD` env vars.
- `seedManifiProduct.js` — seed Manifi's single loan product. No env vars needed (hardcodes the confirmed product terms). Idempotent (skips if the product already exists).
- `fixStuckPrepaidLoan.js` — repairs a loan stuck `active` by the pre-2026-07-29 prepayment-completion bug (fixed going forward; this is only for loans that got stuck before the fix landed). `LOAN_NUMBER=...` env var. Refuses to act unless the loan's remaining balance is actually zero.
- `clearDummyBorrowerData.js` — removes test/dummy borrowers, their loans, collateral, and customer applications from a named lender company, without touching the company, its products, or staff accounts. **Dry-run by default** — run once without `CONFIRM=yes` to review what it found, then again with `CONFIRM=yes` to actually delete. `COMPANY_NAME=...` env var (defaults to `MANIFI INVESTMENT LIMITED`).

---

## 6. Backups

- **MongoDB**: scheduled dump, pushed to Cloudflare (off-VPS) daily at **03:00**. PostgreSQL (other, unrelated projects on the same VPS) backs up similarly at **04:00**. Both confirmed configured and running as of 2026-07-29.
- **Restore test**: ⚠️ **not yet performed as of 2026-07-29.** Before real Manifi customer data accumulates, do one full restore test: pull the latest dump from Cloudflare, `mongorestore` it into a throwaway database (not the live one), and confirm collection counts/spot-check a document match what's actually in production. Record the outcome (date, dump used, result) as an addendum to this section once done.

---

## 7. Common recovery procedures

### A lender/staff user is locked out (forgot password, or account deactivated)
There is currently **no self-service "forgot password" UI** on the login page (the server route `POST /auth/forgot-password` exists and works, but nothing in the client calls it — flagged, not built, as of this writing). Recovery today is always admin-mediated:
1. Any `lender_admin` (or `platform_admin`) for that tenant logs into NdalamaHub → **Settings → User Management** → find the user → **Reset password** (sets a new password directly, no email needed).
2. If literally no admin for that tenant can log in either, `platform_admin` (William) can do the same from his own account — platform admins can reach every tenant's User Management.
3. If even that's unavailable (e.g. a fresh env with no browser access), fall back to `resetAdminPassword.js` (§5) from a server shell.

### A lender's account shows "locked" (subscription gate)
This is a different lock — the tenant's subscription status, not a user credential. `platform_admin` → **Settings → Billing** (`SubscriptionManagement.jsx`) → find the lender → update/renew their subscription status and `currentPeriodEnd`.

### A deploy broke something
See §2 "Rolling back a bad deploy" above.

### The rollover/arrears/reminder jobs seem to have stopped running
See §4 — check `ENABLE_CRON`, confirm the `[cron] scheduler started` log line, confirm single-instance.

---

## 8. Support path

`POST /api/tickets` (Support page in the app) alerts the platform owner on every new ticket — email to `OWNER_ALERT_EMAIL` and a Telegram message, both silently no-op if their respective env vars are unset. There's no other monitoring/alerting wired up today (no uptime check, no error tracking service) — worth adding post-launch if ticket volume or incident frequency justifies it.

---

## 9. Known outstanding items (as of 2026-07-29, pre-handover)

- Restore test (§6) not yet performed.
- No uptime/health-check monitoring beyond manual observation.
- No self-service forgot-password UI (§7) — admin-mediated only.
- Dark platform-admin register, RHF+Zod adoption, and other UI punch-list items remain post-launch (see `docs/18-post-demo-ui-punchlist.md`).
