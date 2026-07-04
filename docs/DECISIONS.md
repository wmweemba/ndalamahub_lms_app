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

## Explicitly deferred (not decided yet, not blocking current planning)
- Exact schedule-anchor-date fix (disbursement vs. application date) — resolve using lending-industry best practice during the loan engine rebuild phase, flag the resolution for confirmation before that phase executes
- Early-settlement bookkeeping fix (currently marks remaining installments paid with amount 0, corrupting summary math) — same treatment as above
