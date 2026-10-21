# CLAUDE.md — NdalamaHub

This file describes **current reality only**: what the app is, how to work in it, and the standing rules. It is loaded into every session, so keep it short.

- History, lessons and per-change detail go in `changelog.md`, not here.
- Locked decisions: `docs/DECISIONS.md` (source of truth if this file disagrees; fix this file).
- Area detail loads automatically from `.claude/rules/` when you touch matching files: `billing.md`, `auth.md`, `tenancy.md`, `frontend.md`.
- The full previous version of this file, including its dated state log, is preserved verbatim at `docs/history/CLAUDE-2026-10-21.md` (indexed in `docs/history/README.md`).

**Last updated:** 2026-10-21

---

## 1. Current state

- **Live**: Manifi Investments is the first lender tenant, in production on Coolify since late July 2026 (§4). Real customers arrive via the manifipay.com public intake.
- **Latest**: the subscription-billing build (manual payment ledger, append-only `BillingAuditLog`, 7-day reminders, role-restricted billing banners) is on `main`. Server 421/421, client 109/109. Detail: `.claude/rules/billing.md`.
- **Open**: backup restore test (daily Mongo/Postgres backups to Cloudflare at 03:00/04:00 run but were never restored as of 2026-07-29; confirm before relying on them). PWA deferred, plan in `docs/PWA_IMPLEMENTATION_PLAN.md`. UI backlog: `docs/18-post-demo-ui-punchlist.md`.
- **Accepted gaps**: forgot/reset-password pages have no automated tests (verified manually). NRC-only borrowers without email need admin-mediated password recovery. Reset links depend on `APP_URL` pointing at the client origin.

## 2. What NdalamaHub is

A multi-tenant Loan Management System built and operated by **Nexus** (William's consulting entity, the platform owner). It serves **lender clients**, which lend either through **employer companies** (payroll deduction) or **directly** to borrowers.

It is a reusable platform, not a Manifi build. Every architectural decision must hold for a second or third lender. Manifi-specific behaviour belongs in configuration, not code.

```
Nexus (platform owner)
  └── Lender tenants (e.g. Manifi)
        └── Employer companies (employer-model lenders only)
              └── Borrowers
```

## 3. Tech stack and gates

- **Monorepo**: root / `client` / `server`, run together with `concurrently` (not formal pnpm workspaces). **pnpm only** (`pnpm@10.12.1` pinned), never npm or yarn.
- **Backend**: Node, Express **4.21.2** (do not upgrade to 5.x; tried and reverted over a `path-to-regexp` break), Mongoose 8, MongoDB. The Express app is `server/app.js` (what API tests import); `server/server.js` is a thin bootstrap.
- **Frontend**: React 19, Vite 7, Tailwind **4.1**, shadcn/ui, TanStack Query, React Hook Form + Zod, React Router 7. `docs/UI_SPEC.md` is the design source of truth.
- **Auth**: server-side sessions (`express-session` + `connect-mongo`). No JWT anywhere. Detail: `.claude/rules/auth.md`.
- **Email/alerts**: `server/utils/email.js` (Resend) and `server/utils/telegram.js`. Both never throw and no-op with a warning when unconfigured.
- **Exports**: PDFKit and ExcelJS, working end to end.
- **Scheduled jobs** (`server/jobs/scheduler.js`, node-cron, Africa/Lusaka; off when `NODE_ENV=test` or `ENABLE_CRON=false`): 01:00 `markOverdueInstallments`, 01:30 `rolloverLoans`, 02:00 `expireSubscriptions`, 08:00 `sendPaymentReminders`. Manual triggers: `pnpm job:overdue | job:rollover | job:subscriptions | job:reminders`. Standalone runner scripts don't load `app.js`, so they must `require()` every model they populate. Single-process assumption: running more than one server instance needs a job lock first.

**Gates**
- Server: `cd server && pnpm test` (Jest 30, Supertest, `mongodb-memory-server`). Model/utility tests in `server/utils/__tests__/`; every HTTP-level test in `server/tests/api/`, even if a phase doc names another path. On spurious memory-server timeouts, rerun with `--runInBand`.
- `server/tests/api/hotfix-regressions.test.js` pins the 2026-07-10 authorization fixes and must stay green.
- A `test.failing` entry marks a known, deliberately unfixed defect.
- Client: `cd client && pnpm lint && pnpm build && pnpm test` (Vitest + RTL, deliberately minimal, UI_SPEC §14).
- "Suite is green" gates every phase. Don't record test counts here; put them in `changelog.md`.

## 4. Environments & deployment

- **Production** (Coolify on Hetzner, fresh database, no data migrated): client `https://ndalamahub.nxhub.online`, API `https://api.ndalamahub.nxhub.online`. The client's `VITE_API_URL` must include `/api`. Same parent domain keeps the session cookie first-party. `app.set('trust proxy', 1)` is required behind Coolify's TLS proxy (without it rate limiters bucket every client together). pnpm lockfiles must stay committed. The `uuid` override stays bounded `<12.0.0` (12+ is ESM-only and breaks `exceljs`). Ops: `docs/PRODUCTION_RUNBOOK.md`.
- **Dev/demo** (permanent): backend on Render (`https://ndalamahub-lms-app.onrender.com`), frontend on Netlify (`https://ndalamahublms.netlify.app/`), both on the Atlas `ndalamahub-prod` cluster, which holds dummy data only and may be written to for verification without asking. The cross-site cookie needs `CROSS_SITE_COOKIE=true` on Render (unset in production). Config was applied and dev confirmed working on 2026-07-29. Locally, `pnpm dev` uses a Vite proxy so no `VITE_API_URL` is needed.
- **Netlify** `NODE_VERSION` must stay at `20.19.0` or higher (Vite 7 and `@tailwindcss/oxide` fail on older Node).
- **No secrets** in this file, commits or docs. Use env var names only. Server requires `MONGODB_URI` and `SESSION_SECRET` (boot fails without them). Optional: `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `ENABLE_CRON`, `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `APP_URL`, `OWNER_ALERT_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. See `server/.env.example` and `client/.env.example`.
- **Deploy notes for any environment with existing loan data** (not production, which started empty): seed the `counters` collection to the current max loan number before first deploy, and run `pnpm job:overdue` once after deploy.

## 5. Roles

| Role | Level | Scope |
|---|---|---|
| `platform_admin` | 5 | Nexus-level. All lender tenants and platform settings. |
| `lender_admin` | 4 | One lender: products, staff, employer clients, disbursement. |
| `lender_officer` | 3 | Processes applications, records repayments. Approves **direct** loans only. |
| `employer_admin` | 2 | Runs an employer account. |
| `employer_hr` | 1 | Reviews employee loan applications. Read-only on repayment data. |
| `borrower` | 0 | Applies for and repays loans. NRC required, unique per company; email optional. |

Lender roles sit strictly above employer roles. Old role names (`super_user`, `corporate_*`, `lender_user`, `client_admin`, `staff`) must never return. Repayment recording is lender-side only, enforced server-side. Approval, disbursement and default authority: `.claude/rules/tenancy.md`.

## 6. Security posture

All findings from `docs/AUDIT_REPORT.md` are fixed (Phases 01–11). The last NS-002 audit (2026-07-29) found 0 P0. Standing rules that came out of that work:

- Tenancy and access checks **fail closed**: a missing ref means deny, never throw.
- `PUT /api/companies/:id` strips `subscription`, `lendingModel` and `publicIntake` for `lender_admin`. Every billing change goes through `/api/subscriptions` and is audited.
- Users with any loan history are **deactivated, never hard-deleted**. Login rejects inactive users with the generic failure message.
- List endpoints validate filter values (e.g. `status` against the schema enum) and return 400, not a cast 500.
- Ticket creation alerts the platform owner by email and Telegram.

## 7. Multi-tenancy

Shared database, scoped by company ObjectId. Onboarding a lender is inserting a `Company` document. **All scoping goes through `server/utils/tenantScope.js`.** Never add ad-hoc company-id comparisons in `server/routes/`. Route guards (`authorize`/`authorizeMinRole`) say who may call a route; `tenantScope.js` says which documents they may touch. Lenders are `lendingModel: 'employer' | 'direct'` (platform_admin-only to change). Full detail: `.claude/rules/tenancy.md`. Billing gating composes with this layer: `.claude/rules/billing.md`.

## 8. Frontend

`docs/UI_SPEC.md` governs all UI. UI-only changes make zero server changes; if one needs a server change, stop and flag it. **Never write `bg-[--token]`** (or `text-`/`border-` variants): Tailwind v4 drops it silently and lint and build both pass. Full rules: `.claude/rules/frontend.md`.

## 9. Working rules

- Two-agent workflow: a **planning agent** (Fable or Opus) writes numbered phase docs in `docs/` and writes no production code. An **execution agent** (Sonnet) follows a phase doc exactly and stops to flag anything ambiguous or wrong rather than improvising. Larger builds use `/build` plans in `docs/build/<name>/plan.md`.
- No phase doc driving the task? Ask which doc applies, or whether this is new, undocumented work.
- One phase per ~1.5–2 hour session. Don't compress phases.
- Explain the root cause and propose a fix before patching.
- Follow phase-doc specifics exactly (names, file layout) rather than substituting a "better" pattern.
- Infer conventions from consistent existing code; flag inconsistencies rather than silently picking one. Respect `client/eslint.config.js`. There is no server lint config; don't add one without discussing it first.

## 10. Maintaining this file

- Edit sections in place so the file always describes current reality. Change the single "Last updated" date; never add "Previously…" paragraphs.
- Put what happened, the test counts and the lessons in `changelog.md`. Put durable rules here only if they apply to every session; otherwise put them in a path-scoped file in `.claude/rules/`.
- Keep this file under about 200 lines.
