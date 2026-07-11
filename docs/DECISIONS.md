# NdalamaHub — Manifi Go-Live Decisions Log

Locked during the pre-build analysis session, prior to any plan generation or code changes. These decisions are inputs to planning, not open questions — if a plan document needs to deviate from one, it must say so explicitly rather than silently doing something else.

## Branch strategy
`feature/phase-0-loan-engine` (36 commits ahead of `main`, contains the entire loan engine/product catalog/prepayment/export work) is merged into `main`. All planning and execution happens against `main` going forward. The feature branch is not treated as a parallel track.

## Roles (renamed for industry-standard clarity)

| Old name | New name |
|---|---|
| `super_user` | `platform_admin` |
| `lender_admin` | `lender_admin` (unchanged) |
| `lender_user` | `lender_officer` |
| `corporate_admin` | `employer_admin` |
| `corporate_hr` | `employer_hr` |
| `corporate_user` | `borrower` |

Ghost roles found in the audit (`client_admin`, `staff`) are removed entirely and replaced with correct real roles wherever referenced.

Structure: `platform_admin` (Nexus, owns the platform) → `lender_admin`/`lender_officer` (a lender tenant, e.g. Manifi) → `employer_admin`/`employer_hr` (an employer client of a lender) → `borrower` (an employee of that employer, the loan applicant).

## Repayment recording authority
Restricted to `lender_admin` and `lender_officer` only. Employer-side roles (`employer_admin`, `employer_hr`) have read-only visibility into repayment and schedule data — no write access to repayment recording.

## User deletion policy
Soft-delete (`isActive: false`) is permanent for any user who has ever had loan history — active, completed, or defaulted. This is enforced at the route level, not just hidden in the UI. Hard-delete is only permitted for users with zero loan history ever.

## Multi-tenancy architecture
The current ad-hoc per-route company-ObjectId scoping (~30 sites, no middleware, no schema plugin) is replaced with a proper middleware/plugin-based scoping layer. This must be designed for reuse — a second or third lender client should onboard without requiring changes to this layer. Shared-database multi-tenancy is the intended model (not per-instance deployment); a `TENANT_ID` env-var pattern is not adopted unless a specific need is identified that the existing company-ObjectId model can't handle.

## Loan rate engine
Rebuilt/extended to support configurable rate basis (annual, per-term, per-period) as product-level configuration rather than a hardcoded formula. This is a platform capability. Manifi's specific product terms (rate basis, term length, etc.) are pending confirmation from the client via Clement — once confirmed, they are configured as data, not built as bespoke code.

## Security baseline
Non-negotiable, treated as the first phase of execution regardless of other prioritization:
- Registration endpoint lockdown — no public role selection, no unauthenticated path to creating privileged accounts
- Fix both regressions introduced in commit `531d954` (dead repayment recording endpoint, dead prepayment engine)
- Fix `req.user.hasPermission()` crashes in user management routes
- Remove hardcoded JWT fallback secret
- Wire up the existing but unused login rate limiter
- Unify token payload shapes across login/register/refresh (fixes the broken refresh flow)
- Remove console-logged tokens and user data
- Add `helmet`, `express-rate-limit`, `express-mongo-sanitize`
- Bump vulnerable dependencies flagged in the audit (`pnpm audit`)

## Generalizability principle
Applies to every decision and every future plan document: the platform must remain usable by future lender clients without restructuring. Manifi's specific needs are configuration, not architecture. Any proposed fix or feature that only makes sense for Manifi specifically should be flagged as such rather than built into core logic.

## Manifi product terms (confirmed via Clement, locked 2026-07-04)
Flat rate, 25%, fixed **30-day** term per loan. Interest = principal × 0.25 per loan, exactly. This is real product data for Phase 05, entered as product configuration once the engine supports it.

**Term-unit modeling requirement:** the schema currently stores `term` in whole months and approximates day-based schedules as `term × 30 days`. A calendar month is not a fixed 30 days, so mapping this product to `term: 1 month` would cause due-date and interest-accrual drift depending on which month a loan lands in. Phase 05 must model term with an **explicit unit** (days/weeks/months) rather than assuming months for every product, so Manifi's actual 30-day product is represented exactly and future clients with different term units are not forced into the same approximation.

## Schedule anchor date & early-settlement bookkeeping (confirmed, locked 2026-07-04)
Both Phase 05 proposals confirmed as planned — no changes:
- Repayment schedules are anchored to the **disbursement date**; existing loans are not retroactively re-anchored.
- Early settlement uses a new `waived` installment status; the settlement amount is recorded once, on `earlySettlement.settlementAmount`, replacing the current paid-with-amount-0 hack.

## Role hierarchy correction (locked 2026-07-04)
The original hierarchy placing `lender_officer` below employer-side roles was an oversight. Lender roles sit **strictly above** employer roles — a lender-side loan officer handling real money movement never ranks below employer HR. Corrected numbering:

| Level | Role |
|---|---|
| 5 | `platform_admin` |
| 4 | `lender_admin` |
| 3 | `lender_officer` |
| 2 | `employer_admin` |
| 1 | `employer_hr` |
| 0 | `borrower` |

**Regression-check requirement:** `authorizeMinRole()` compares by this number, and the audit already found one bug caused by numeric drift (the `client_admin` ghost role resolving to level 0 and passing everyone). The renumbering must not silently change effective access anywhere except where the lender/employer reorder is the deliberate intent. Phase 03's acceptance criteria require enumerating every `authorizeMinRole()` call site and confirming its effective access list unchanged before/after — any unintended access change at any other site is a regression to be fixed before the phase completes, not noted and moved past.

## Production cutover: fresh database, no data migration (locked 2026-07-11)
Production on Coolify starts on a **fresh, empty MongoDB**. Nothing is migrated from the Atlas dev cluster — every loan, lender, employer, and user in it is dummy/verification data; the system has never had a live user. Consequences: the Phase 05 `counters` seed, the Phase 03 `renameRoles` migration, and the Phase 07/09 backfill runs are all unnecessary against production (the job runners may still be executed harmlessly); Manifi's production company + subscription state are created fresh via the platform-admin UI (Billing tab) rather than the Phase 10 backfill script. The Atlas cluster and the dev environment **remain in service indefinitely as the combined dev/staging/demo environment** — client demo sessions run against it, and its accumulated dummy data (loans in arrears, tickets, subscription states) is a feature for demos, not debt.

## Explicitly deferred (not decided yet, not blocking current planning)
- Where the demo environment is hosted for client-facing sessions (current Render/Vercel split vs. a Coolify staging instance pointed at Atlas) — decide when the migration runbook is written.
- Auth migration approach (see CLAUDE.md Section 8) vs. the per-request `isActive` stopgap — must be decided before real users exist.
- Penalty interest / late fees for Manifi's product — business decision, raise with Clement; affects go-live product terms.
