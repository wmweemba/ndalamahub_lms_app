# CLAUDE.md — NdalamaHub

**This is a living document.** It is the single file that explains the whole application — architecture, decisions, current state, and rules of engagement. Update it whenever a meaningful state change happens (a phase from `docs/` is completed, an architecture decision changes, auth is migrated, UI_SPEC lands, etc.). Do not let it drift out of sync with reality — a stale CLAUDE.md is worse than no CLAUDE.md, because it will be trusted.

**Last updated:** 2026-07-04 — feature branch merged into `main`; phase plans generated in `docs/`; Phase 01 (security-critical fixes) fully executed, including Addendum A, on `phase/01-security-critical-fixes` — suite is 133/133, but the branch is **not yet merged** pending Step 8 manual verification, which is blocked by a `MONGODB_URI` DNS resolution failure (see Section 6).

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
- A full pre-go-live audit has been completed and lives at `docs/AUDIT_REPORT.md`. It found several critical issues (see Section 6) that must be fixed before any client-facing use. **Do not treat the app as production-ready until those are resolved.** Verified baseline: 133 server tests, 111 pass / 22 fail (all failures from the `canAcceptPrepayment` regression).
- Locked decisions from the planning session live at `docs/DECISIONS.md`. Treat that file as authoritative — this CLAUDE.md summarizes it, but `DECISIONS.md` is the source of truth if they ever disagree (and if they do, that's a bug in this file — fix it).
- Phased execution plans **have been generated**: `docs/01-security-critical-fixes.md` through `docs/10-subscription-gating.md`, indexed in `docs/README.md`. None have been executed yet. Claude Code executing a phase must follow that phase's document exactly — see Section 11 (Working Rules) before touching code.
- Pre-existing roadmap/planning documents (PRODUCTION_ROADMAP, WEEK_* summaries, etc.) were archived to `docs/archive/` and must not be used as planning input.

---

## 3. Tech stack

- **Monorepo**: root / `client` / `server`, pnpm workspaces-style (not formal pnpm workspaces — root `package.json` just runs `client` and `server` concurrently via `concurrently`)
- **Package manager**: pnpm (`pnpm@10.12.1` pinned in `packageManager` field — respect this, don't use npm/yarn)
- **Backend**: Node.js, Express 4.21.2 (do not upgrade to Express 5.x — this was previously tried and reverted due to a `path-to-regexp` compatibility issue), Mongoose 8.x, MongoDB (currently Atlas, migrating — see Section 4)
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod, React Router 7
- **Auth**: JWT (`jsonwebtoken`, `bcryptjs`) — see Section 8, this is planned to change
- **Testing**: Jest 30 + Supertest + `mongodb-memory-server` on the server (133 tests as of the audit). No client-side automated tests exist yet.
- **Exports**: PDFKit, ExcelJS — confirmed working end-to-end (not placeholders)

### Test command — resolved
The placeholder-test-script concern was based on a stale pre-merge snapshot. Post-merge, `server/package.json` has `"test": "jest"` (plus `test:watch`, `test:coverage`), and `cd server && pnpm test` was verified to run the real 133-test suite on 2026-07-04. Treat `pnpm test` in `server/` as the regression gate.

---

## 4. Environments & deployment

- **Current**: local development, with hosting believed to be split across Render/Railway (backend) and Vercel (frontend) — verify exact current setup before assuming, since William isn't fully certain of the current split.
- **Target**: migrating to a Coolify-managed Hetzner VPS, using a MongoDB service already running on Coolify. This migration is expected once the audit-fix phases are complete — not before.
- No secrets, connection strings, or credentials belong in this file, in commit messages, or in any doc committed to the repo. Reference environment variable **names** only (e.g. `MONGODB_URI`, `JWT_SECRET`). See `docs/AUDIT_REPORT.md` Section 9 for the current inventory of env vars actually used vs. documented.
- There is currently no `.env.example` in the repo — creating one is a reasonable, low-risk cleanup task.

---

## 5. Roles (target state — post role-rename phase)

| Role | Level | Scope |
|---|---|---|
| `platform_admin` | Platform | Nexus-level. Manages all lender tenants and platform-wide settings. |
| `lender_admin` | Lender tenant | Manages one lender's operation: products, staff, employer clients, disbursement. |
| `lender_officer` | Lender tenant | Loan officer. Processes applications, records repayments, manages assigned portfolios. |
| `employer_admin` | Employer client | Runs an employer account — manages that employer's users and settings. |
| `employer_hr` | Employer client | Reviews/approves employee loan applications. Read-only on repayment data. |
| `borrower` | Individual | Employee applying for and repaying loans. |

**Until the role-rename phase executes**, the actual codebase still uses the old names (`super_user`, `corporate_admin`, `corporate_hr`, `corporate_user`, `lender_user`), plus two ghost roles found in the audit (`client_admin`, `staff`) that don't exist in the schema but are referenced in dead code paths. Do not introduce new code using the old names or the ghost roles — use the target names going forward even before the formal migration, unless you're specifically working inside the migration phase itself.

**Repayment recording authority**: `lender_admin` and `lender_officer` only. Employer-side roles are read-only on repayment/schedule data — this must be enforced server-side, not just hidden in the UI.

---

## 6. Known critical issues (from `docs/AUDIT_REPORT.md`)

These are non-negotiable, phase-1 fixes — not up for reprioritization against feature work:

- ~~Public registration accepts an attacker-chosen role, including the top-level admin role (total RBAC bypass)~~ — **Fixed in Phase 01** (`server/routes/auth.js`: `/register` route removed; `server/routes/users.js`: lender-admin role-assignment guard added)
- ~~Repayment recording endpoint is dead (throws on every call)~~ — **Fixed in Phase 01** (`server/routes/loans.js`: validation block moved inside `try`, cross-tenant write hole closed via `loan.lenderCompany` check)
- ~~Prepayment/early-settlement engine is dead (regression from commit `531d954`)~~ — **Fixed in Phase 01**: `Loan.canAcceptPrepayment()` return statement restored, the three schedule-recalculator argument-order bugs fixed, and (via Addendum A) `calculateEarlySettlementAmount()`'s savings formula corrected to count all unpaid installments' interest, not just future-dated ones. Suite is 133/133.
- ~~Several admin user-management endpoints 500 due to a non-existent method being called on the JWT payload~~ — **Fixed in Phase 01** (`server/middleware/auth.js`: added `hasMinRole` helper; `server/routes/users.js`: replaced 5 `req.user.hasPermission()` call sites)
- No cron/scheduler exists — arrears/overdue status never triggers, ever
- Hardcoded JWT fallback secret, unused rate limiter, inconsistent token payload shapes breaking refresh
- No `helmet`, `express-rate-limit`, or `express-mongo-sanitize`
- 14 high-severity vulnerable server dependencies, 26 on the client

Full detail, evidence, and file/line references are in `docs/AUDIT_REPORT.md` — don't duplicate that detail here, just be aware it exists and gates everything else. Phase 01 changes are on `phase/01-security-critical-fixes`, unmerged as of this writing — see the Phase 01 flag above before treating these as live on `main`.

**Phase 01 Step 8 blocker:** `server/.env`'s `MONGODB_URI` hostname (`ndalamahub-lms-app.c3jl7cs.mongodb.net`) does not resolve (`NXDOMAIN` against both the local resolver and `8.8.8.8` directly) — the server cannot be started against it to run the demo-DB manual verification checks. This needs a corrected connection string (or an un-paused/un-deleted cluster) before Step 8 can be completed.

---

## 7. Multi-tenancy (target architecture — not yet built)

Current state: ad hoc, per-route company-ObjectId comparisons repeated in ~30 places. No middleware, no schema-level enforcement.

Target: a proper middleware/plugin-based scoping layer that enforces tenant isolation consistently, designed so a second or third lender client can onboard without requiring changes to this layer. Shared-database multi-tenancy (not per-tenant deployment). No `TENANT_ID` env-var pattern unless a specific need emerges that the company-ObjectId model can't handle.

Until this phase lands, don't add new ad hoc scoping checks that follow the old pattern — flag the need in the relevant phase doc instead if you hit a gap.

---

## 8. Auth

**Current**: custom JWT implementation (`jsonwebtoken` + `bcryptjs`). Has known critical issues (Section 6) that must be fixed as part of the security baseline regardless of future plans.

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

The test suite (`docs/AUDIT_REPORT.md` Section 10 notes 133 server tests, 111 passing pre-fix) is the standing regression check. Treat "suite is green" as a gate before considering any phase complete, once the test-command issue in Section 3 is resolved.

---

## 12. Document maintenance

Update this file when:
- A phase document from `docs/` is completed and changes something described here (roles, tenancy, auth, security posture)
- A locked decision in `docs/DECISIONS.md` changes or a new one is added
- The auth migration decision is made
- `docs/UI_SPEC.md` is created and the frontend restriction in Section 9 lifts
- The Coolify/Hetzner migration happens (update Section 4)

When updating, edit the relevant section directly rather than appending a changelog at the bottom — this file should always describe current reality, not a history of it. (History belongs in `docs/DECISIONS.md`, `docs/AUDIT_REPORT.md`, and git history.) Do update the "Last updated" line at the top each time.
