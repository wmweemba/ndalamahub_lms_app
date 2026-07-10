# CLAUDE.md — NdalamaHub

**This is a living document.** It is the single file that explains the whole application — architecture, decisions, current state, and rules of engagement. Update it whenever a meaningful state change happens (a phase from `docs/` is completed, an architecture decision changes, auth is migrated, UI_SPEC lands, etc.). Do not let it drift out of sync with reality — a stale CLAUDE.md is worse than no CLAUDE.md, because it will be trusted.

**Last updated:** 2026-07-10 — Phase 03b (API test scaffold & tenant-isolation baseline) planned and documented at `docs/03b-api-test-scaffold.md`, inserted before Phase 04. During that planning, two critical authorization defects were found and hotfixed same day on `main` (cross-tenant loan approve/reject bypass; role-escalation via user update — see Section 6). Suite remains 133/133.

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
- A full pre-go-live audit has been completed and lives at `docs/AUDIT_REPORT.md`. It found several critical issues (see Section 6) that must be fixed before any client-facing use. **Do not treat the app as production-ready until those are resolved.** The audit's original baseline (133 server tests, 111 pass / 22 fail, all failures from the `canAcceptPrepayment` regression) is historical — that regression was fixed in Phase 01, and the suite has been 133/133 since the Phase 01 merge (`0ef9b50`). Phases 02 and 03 are also complete; suite remains 133/133. See `docs/AUDIT_REPORT.md` for the original pre-fix figures.
- Locked decisions from the planning session live at `docs/DECISIONS.md`. Treat that file as authoritative — this CLAUDE.md summarizes it, but `DECISIONS.md` is the source of truth if they ever disagree (and if they do, that's a bug in this file — fix it).
- Phased execution plans **have been generated**: `docs/01-security-critical-fixes.md` through `docs/10-subscription-gating.md`, indexed in `docs/README.md`, plus `docs/03b-api-test-scaffold.md` (generated 2026-07-10, inserted between 03 and 04 — an API/route-level test scaffold and tenant-isolation regression baseline that must run before the tenancy phase). Phases 01–03 are executed; 03b and 04–10 have not been. Claude Code executing a phase must follow that phase's document exactly — see Section 11 (Working Rules) before touching code.
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
- No cron/scheduler exists — arrears/overdue status never triggers, ever (still open; not part of Phase 01, 02, or 03)
- ~~Hardcoded JWT fallback secret, unused rate limiter, inconsistent token payload shapes breaking refresh~~ — **Fixed in Phase 02**: `server/utils/auth.js` and the `/refresh` route no longer fall back to `'your-secret-key'` (server now fails fast at boot if `JWT_SECRET`/`MONGODB_URI` are unset); access/refresh tokens now share a canonical `{id, username, role, company}` payload, fixing the previously-unusable refresh flow; the existing per-username login rate limiter is wired up (5/15min) alongside a broader `express-rate-limit` backstop on `/api/auth` (50/15min)
- ~~No `helmet`, `express-rate-limit`, or `express-mongo-sanitize`~~ — **Fixed in Phase 02**: all three added to `server/server.js`; `express-mongo-sanitize` closes the `?status[$ne]=x`-style operator-injection class on list endpoints
- ~~14 high-severity vulnerable server dependencies, 26 on the client~~ — **Server fixed in Phase 02**: `pnpm audit --prod` on the server now shows 0 vulnerabilities (via `pnpm update` + a `pnpm.overrides` pin on transitive `uuid`). Client: `axios`/`react-router-dom`/`vite` bumped within current majors, but several high/moderate findings remain — all transitive dev-build-tool dependencies (`rollup`, `picomatch`, `postcss`, `esbuild` via `@tailwindcss/vite`→`vite`, plus `form-data` via `axios`) not yet resolved; see `changelog.md` Phase 02 entry

Full detail, evidence, and file/line references are in `docs/AUDIT_REPORT.md` — don't duplicate that detail here, just be aware it exists and gates everything else. Phase 01 (register/RBAC/repayment/prepayment fixes plus the settlement-savings fix) and Phase 02 (auth/platform hardening, all items above) are both merged into `main`; suite is 133/133. All security-baseline items from the audit are now resolved except the role rename (Phase 03) and the cron/scheduler gap (unscheduled).

**Found during Phase 03b planning and hotfixed same day (2026-07-10, directly on `main` at William's direction, outside a numbered phase):** two critical authorization defects neither the audit nor phases 01–03 had caught: (1) `PUT /api/loans/:id/approve` and `/reject` skipped the tenancy check entirely for `lender_admin` callers, letting a lender admin of one tenant approve/reject another lender's pending loans — now requires `loan.lenderCompany` to match the caller's company (fail-closed if `lenderCompany` is missing); (2) `PUT /api/users/:id` had no role-escalation cap on its role-update branch (unlike `POST /api/users`, which got one in Phase 03), letting an `employer_admin` promote a same-company user to `lender_admin` or `platform_admin` — now enforces the same `hasMinRole(caller, targetRole)` rule with a 403. Loan *reads* were never affected (list/detail/summary/export already checked `lenderCompany`). Phase 03b adds API regression tests pinning both fixes; Phase 04's route migration must preserve these semantics.

**Newly noted in Phase 02 (not fixed, flagged for a future phase):** the `express-mongo-sanitize` fix correctly strips injected Mongo operators (e.g. `$ne`) from query params, but on `GET /api/loans` this leaves `filter.status` as an empty object, which Mongoose then fails to cast, producing a 500 instead of a graceful filtered/empty result. The security property holds (no operator injection, not all loans returned) but the endpoint doesn't validate the shape of the `status` query param.

**Noted but out of scope (Phase 05):** the prepayment endpoint's settlement-preview summary (`beforeInterest`/`afterInterest`) produced an implausible ~21 million interest figure during Step 8 verification — a distinct bug in the accrued-interest/settlement math, separate from the Addendum A fix, not investigated or fixed here.

---

## 7. Multi-tenancy (target architecture — not yet built)

Current state: ad hoc, per-route company-ObjectId comparisons repeated in ~30 places. No middleware, no schema-level enforcement.

Target: a proper middleware/plugin-based scoping layer that enforces tenant isolation consistently, designed so a second or third lender client can onboard without requiring changes to this layer. Shared-database multi-tenancy (not per-tenant deployment). No `TENANT_ID` env-var pattern unless a specific need emerges that the company-ObjectId model can't handle.

Until this phase lands, don't add new ad hoc scoping checks that follow the old pattern — flag the need in the relevant phase doc instead if you hit a gap.

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

The test suite (133 server tests; `docs/AUDIT_REPORT.md` Section 10 records the original pre-fix baseline of 111 passing, since fixed in Phase 01 — suite is currently 133/133) is the standing regression check. Treat "suite is green" as a gate before considering any phase complete, once the test-command issue in Section 3 is resolved.

---

## 12. Document maintenance

Update this file when:
- A phase document from `docs/` is completed and changes something described here (roles, tenancy, auth, security posture)
- A locked decision in `docs/DECISIONS.md` changes or a new one is added
- The auth migration decision is made
- `docs/UI_SPEC.md` is created and the frontend restriction in Section 9 lifts
- The Coolify/Hetzner migration happens (update Section 4)

When updating, edit the relevant section directly rather than appending a changelog at the bottom — this file should always describe current reality, not a history of it. (History belongs in `docs/DECISIONS.md`, `docs/AUDIT_REPORT.md`, and git history.) Do update the "Last updated" line at the top each time.
