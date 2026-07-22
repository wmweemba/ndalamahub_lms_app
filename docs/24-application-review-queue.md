# Phase 24 — Application review queue (client)

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/24-application-review-queue`, branched from `main` (Phase 23 merged).
**Session size:** one ~1.5h session (the server side already exists — Phase 22; this is UI over it).
**Read first:** Phase 22's routes (`server/routes/customerApplications.js` — list/detail/approve/reject shapes and the dedupe-flag payload) and `docs/INTEGRATION_CONTRACT_MANIFIPAY.md`; `docs/UI_SPEC.md` conventions.

## Objective

The staff-facing half of the website funnel: pending manifipay.com applications reviewed inside the Customers area, with dedupe warnings surfaced, and one-click conversion into customer + pending loan + declared collateral — feeding straight into the Phase 21 verification → approval → disbursement chain.

## Steps

### Step 1 — Applications queue in the Customers surface

`CustomersPage` gains a tab/segmented control: **Customers | Applications** (Applications shows a count badge of pending — accent-tinted per UI_SPEC's one-accent rule if it's the attention item on this page). Applications list: reference, received date, name, NRC (Plex Mono), requested amount, collateral type, status pill (`pending` warning / `approved` success / `rejected` gray-danger per §3.2 conventions). Default filter: pending. TanStack Query `['customer-applications']`.

### Step 2 — Review detail

Detail dialog: full applicant block (NRC-first), loan request (amount/purpose/term via format utils), collateral block, source + received date. **Dedupe banner** when the API returns match flags: warning-tinted, "Possible existing customer: {name} (matched on NRC)" linking to the customer's detail. Actions:

- **Approve** — the single primary. If dedupe matched: a choice presented plainly — "Create new customer" vs "Attach loan to {matched name}" (maps to the `attachToUserId` body). If the applicant has no email: the temp-password field appears (same pattern as Phase 23's walk-in create). Success toast summarizes what was created ("Customer + loan LN… created — collateral awaiting verification") and invalidates `['customer-applications']`, `['customers']`, `['loans']`.
- **Reject** — outline-destructive, reason required, confirm step.

### Step 3 — Dashboard visibility (small)

`LenderDashboard`: for direct-model lenders, the "Pending applications" KPI should include (or a sub-line should show) pending **website applications**, so the funnel is visible from the morning screen. Read what the lender-stats endpoint returns; **do not modify the server stats endpoint in this phase** — fetch the pending count via the existing `['customer-applications']` query with a status filter and render it as the KPI's `sub` line. Also add the Phase 20 note: loans with `rolloverCount ≥ 2` surface in the needs-attention area if the loans list response already carries the count (it does — model field); a small "Rolled over ×N" warning pill on the loans list rows where count ≥ 1.

### Step 4 — Tests + manual verification

- Vitest: queue renders fixtures with pills; dedupe banner renders on a matched fixture; approve-with-attach calls the right body; reject requires a reason; rollover pill renders on a fixture loan.
- Manual on dev Atlas: curl a fake application through the Phase 22 public endpoint → see it in the queue → approve (new customer, no email, temp password) → verify collateral → officer approves the loan → admin records letter of sale → disburses. That is **the complete Manifi operating loop**; record it step-by-step in the changelog — it becomes the launch smoke-test script for Phase 26.

## Acceptance criteria

1. The full loop in Step 4 passes end to end on dev.
2. Duplicate applications are visibly flagged and can be attached instead of duplicated.
3. Gates: server suite untouched-green this phase (client-only except reading), client lint/build/test green.

## Close-out

Update CLAUDE.md (§2; §3 counts) and `changelog.md`; merge → `main`, push, delete branch.
