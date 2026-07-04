# NdalamaHub — Phased Plan Generation — Prompt for Claude Code Fable

## Before you start

1. Confirm `docs/AUDIT_REPORT.md` exists in this repo (the pre-go-live audit). Read it in full — it is ground truth for current codebase state. Do not re-derive findings from scratch; verify against it as needed but trust it as the baseline.
2. Confirm `docs/DECISIONS.md` exists (see below) — it contains locked decisions from the planning session. These are not open for reinterpretation. If anything in your investigation contradicts a decision, flag it explicitly in your output rather than silently overriding it.
3. Treat every other pre-existing planning/roadmap document in this repo (anything referencing `MANIFI_PROJECT_MASTER`, `NDALAMAHUB_MANIFI_ROADMAP`, `PRODUCTION_ROADMAP`, or similar) as **stale and irrelevant**. Do not use them as input. Move them to `docs/archive/` rather than deleting, in case something needs to be recovered later — but do not reference their content in your plan.

## Your role

You are the planning agent, not the execution agent. Your job is to produce a set of phased, sequential plan documents that a separate execution agent (Claude Code Sonnet, with no improvisation authority) will follow exactly. Precision matters more than speed — an execution agent following your plan cannot infer intent you didn't write down.

## Step zero (do this yourself, not as a plan document)

Merge `feature/phase-0-loan-engine` into `main`. This branch is 36 commits ahead and contains the entire loan engine, product catalog, prepayment, and export work — it is not optional or parallel work, it *is* the codebase going forward. Confirm the merge is clean, note any conflicts you had to resolve, and confirm which branch (`main`) all subsequent plan documents assume as their starting point. All planning documents you write should assume `main` post-merge as the baseline — do not write plans that assume the feature branch still exists separately.

## Locked decisions (non-negotiable — from `docs/DECISIONS.md`, summarized here for convenience)

- **Roles**: rename `super_user`→`platform_admin`, `lender_admin`→`lender_admin` (unchanged), `lender_user`→`lender_officer`, `corporate_admin`→`employer_admin`, `corporate_hr`→`employer_hr`, `corporate_user`→`borrower`. This touches the User schema enum, all middleware role checks, all frontend role-gating logic, and any hardcoded role strings in seed scripts/tests. Also remove the ghost roles `client_admin` and `staff` entirely — replace any logic keyed on them with the correct real role.
- **Repayment recording**: restricted to `lender_admin` and `lender_officer` only. Employer-side roles (`employer_admin`, `employer_hr`) get read-only visibility into repayment/schedule data, never write access.
- **User deletion**: soft-delete (`isActive: false`) is permanent for any user who has ever had loan history — active, completed, or defaulted. Hard-delete is only permitted for users with zero loan history ever. Implement this as an enforced check in the delete route, not just a UI convention.
- **Multi-tenancy**: design and implement a proper middleware/plugin-based company-scoping layer to replace the current ~30 ad-hoc per-route ObjectId comparisons. This must remain generic — built so a second and third lender client can be onboarded without touching this layer again. Shared-database multi-tenancy (not per-instance) is the intended model; do not introduce a `TENANT_ID` env-var pattern unless you can justify why it's necessary on top of the existing company-ObjectId model.
- **Loan rate engine**: rebuild/extend to support configurable rate basis — annual, per-term, per-period — as a product-level configuration, not a hardcoded formula. This is a platform capability, not a Manifi-specific feature; Manifi's actual product terms (still pending confirmation from the client) will be configured as data once known, not built as bespoke code.
- **Security baseline**: registration endpoint lockdown (no public role selection), fix both `531d954` regressions (repayment recording, prepayment engine), fix `req.user.hasPermission()` crashes, remove hardcoded JWT fallback secret, wire up the existing-but-unused rate limiter, unify token payload shapes (fixes refresh flow), strip console-logged tokens/user data, add `helmet` + `express-rate-limit` + `express-mongo-sanitize`, bump vulnerable dependencies. None of this is optional or deferrable — treat it as the first phase, before any new capability work.
- **Generalizability principle**: at every phase, ask "does this decision only make sense for Manifi, or does it hold for a hypothetical second lender client?" If a fix or feature only makes sense for Manifi, flag it as a configuration point, not core logic.

## What to produce

A set of numbered markdown files in `docs/` (e.g. `docs/01-security-baseline.md`, `docs/02-role-rename.md`, etc.), each a complete, standalone execution plan for one phase. Sequence them so each phase leaves the app in a working, testable state — no phase should depend on a later phase to not be broken.

Suggested phase grouping (adjust based on what you find, but keep phases small enough to execute and verify independently):
1. Security baseline fixes (the non-negotiable list above) — this should be phase 1, before anything else
2. Role rename migration (schema, middleware, frontend, seeds, tests)
3. Multi-tenancy scoping layer (design + migrate all ~30 existing check sites onto it)
4. Loan rate engine rebuild (configurable rate basis, fix the recalculation argument-order bugs, fix schedule-anchor-date-on-disbursement, fix early-settlement bookkeeping)
5. Dashboard/export orphan-safety fixes (guard against deleted/soft-deleted users breaking populate calls)
6. Arrears/cron infrastructure (the first scheduled job — needed for both overdue status transitions and, later, email reminders)
7. New capability builds in priority order: support tickets, email/notification integration, subscription/trial gating

You may reorder, split, or merge phases based on actual dependency chains you find in the code — this ordering is a starting hypothesis, not a requirement.

## Format for each plan document

Each phase document must include:
- **Objective** — one paragraph, plain language
- **Scope** — exact files/modules touched, and explicitly what's out of scope for this phase
- **Step-by-step instructions** — precise enough that an execution agent with no improvisation authority can follow them without guessing. Include exact function/variable names, exact file paths, and exact expected before/after behavior.
- **Acceptance criteria** — how to know the phase is done correctly. Reference specific tests that must pass (e.g. "all 133 server tests pass, 0 failures") or specific manual verification steps if no test exists yet.
- **Session sizing note** — flag whether this phase realistically fits a single ~1.5–2 hour focused session or needs to be split further, and if split, where the safe stopping/resume points are.
- **Rollback note** — what to do if this phase's changes need to be reverted.

## Constraints

- Do not write any code yourself. Plan documents only.
- Do not soften or reinterpret the locked decisions — if you think one is wrong, say so explicitly in a "flagged concerns" section rather than quietly planning around it.
- Where the audit report lists an "open question" that hasn't been resolved in `docs/DECISIONS.md` (schedule anchor date, early-settlement bookkeeping accounting), resolve it yourself using lending-industry best practice, state the resolution clearly in the relevant plan doc, and flag it as an assumption the human should confirm before that phase is executed.
