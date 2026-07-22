# Phase 26 — Coolify production stand-up & Manifi launch

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** mostly **infrastructure, not code** — any code fixes ride a `phase/26-launch-prep` branch; the provisioning work happens in Coolify with William present (credentials, DNS, and billing decisions are his). **Plan for 2 sessions**: A = environment stand-up + seeding, B = launch smoke + cutover.
**Read first:** CLAUDE.md §4; `docs/DECISIONS.md` (fresh-DB cutover 2026-07-11 + Manifi launch decisions 2026-07-22); `MANIFI_PROJECT_MASTER.md` (manifipay repo) — hosting layout and env-var inventories it already specifies; `.env.example` files (post-Phase-25 state); `docs/INTEGRATION_CONTRACT_MANIFIPAY.md`.

## Objective

Production exists, is seeded fresh for Manifi as a **direct** lender, the website posts real applications into it, and the complete operating loop passes a scripted smoke test. Render/Netlify/Atlas remain the permanent dev/staging/demo environment, untouched.

## Locked launch decisions this phase implements

Fresh, empty production MongoDB (nothing migrated); Manifi created as `lendingModel: 'direct'`; single product (25% flat per term, 30-day, rollover enabled/14-day grace, collateral required); **only Clement's `lender_admin` account** is seeded — he creates his own team; website intake slug live; MFA and agreement-PDF generation are post-launch.

## Steps — Session A (environment + seed)

1. **Coolify project** on the Hetzner VPS, per the master doc's layout: `ndalamahub-server` (Node app), `ndalamahub-client` (static build), `manifipay-website` (static), MongoDB service (the existing Coolify Mongo). Domain layout: client + API under one parent domain so the Phase 25 session cookie is first-party — either single domain with `/api` proxied to the server app, or `app.` + `api.` subdomains with the cookie scoped to the parent domain. **Pick with William at provisioning time; record the choice.** TLS on everything (Coolify/Traefik).
2. **Env vars** (names per `.env.example`; values William's): `MONGODB_URI` (Coolify Mongo), `SESSION_SECRET` (freshly generated), `NODE_ENV=production`, `CORS_ORIGIN`/allowed app origin for the Phase 25 origin-check, `RESEND_API_KEY`/`FROM_EMAIL`/`FROM_NAME`/`APP_URL`, `OWNER_ALERT_EMAIL`, `TELEGRAM_*`, cron **enabled** (default — confirm `ENABLE_CRON` unset/true; **single server instance only**, per the documented no-lock constraint on the jobs).
3. **Backups + basics**: scheduled `mongodump` (Coolify scheduled task) to off-VPS storage, retention stated in the runbook; an uptime check on the API health endpoint; server logs accessible.
4. **Seed production** (fresh DB, in order, via the app itself wherever possible): bootstrap `platform_admin` (one-off script — document and delete pattern, no secrets committed); log in as platform_admin → create **Manifi Investments Limited** (lender, **direct**, subscription set `active` with a real `currentPeriodEnd` via the Billing tab, publicIntake enabled with slug + `https://manifipay.com` origin); create the product (exact confirmed terms above); create **Clement's `lender_admin` account** (real email from William) → send the account invite. Nothing else — no test data in production, ever.
5. Deploy the website app; **swap the form endpoint** in the manifipay repo to the production intake URL per the contract doc (this is the William-side change — coordinate, it can land the same day); DNS for manifipay.com + the app domain.

## Steps — Session B (verification + cutover)

6. **Pre-smoke code sweep** (on the branch, only if anything remains): confirm the three old demo quirks are dead — "Welcome, !" (structurally fixed by Phase 25 — verify), the payment-history "Total paid" header aggregation bug (**fix it now if still present** — it's a small client aggregation fix, and Clement's staff will use this dialog daily), and the department-required mismatch (resolved by Phase 19 — verify). Anything else found: fix cosmetic, flag functional.
7. **Scripted launch smoke on production** (the Phase 24 changelog loop, run for real): submit a test application through manifipay.com's live form → it appears in Clement's queue (use a clearly-marked test NRC) → approve as a walk-in (temp password) → verify collateral → approve loan (officer path once Clement has created an officer; else admin) → record letter of sale → disburse → record a repayment → confirm dashboards/reports/exports render → **delete/deactivate the test records** (or run the smoke before Clement's real data exists and reset — since the DB is fresh, running the smoke first and wiping is cleanest; state what was done). Verify the reminder/rollover crons are scheduled (log lines) — do **not** force a rollover in production; the rollover engine's correctness gate was Phase 20's dev verification.
8. **Runbook**: write `docs/PRODUCTION_RUNBOOK.md` — environment map, deploy procedure (push → Coolify redeploy), env-var inventory (names only), backup/restore procedure, job manual triggers, "lender locked out" and "roll back a deploy" procedures, and the support path (tickets → owner alerts).
9. **Handover to Clement**: his invite email, first-login walkthrough (create team accounts — his Q7 choice, change password, create officer), and the go-live confirmation with William present.

## Acceptance criteria

1. The full loop passes on production infrastructure end to end, including a real website submission.
2. Production contains exactly: Manifi (direct, active subscription, intake on), one product, Clement's account (+ his self-created team) — and zero test residue.
3. Backups verified by an actual restore test of a dump (not just "backup ran").
4. `docs/PRODUCTION_RUNBOOK.md` exists; CLAUDE.md §4 rewritten (Coolify is production; Render/Netlify/Atlas permanent dev/demo); DECISIONS.md launch entry marked executed.

## Close-out

Update CLAUDE.md (§2 — Manifi launched; §4 rewrite) and `changelog.md` (launch record, smoke checklist results); merge any code branch → `main`, push. Post-launch backlog now lives in `docs/18-post-demo-ui-punchlist.md` + the new items (MFA, agreement PDF, collateral uploads, SMS/WhatsApp, intake-config UI) — consolidate them into one backlog doc as the first post-launch planning act.
