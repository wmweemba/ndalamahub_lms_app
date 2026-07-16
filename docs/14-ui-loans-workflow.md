# Phase 14 — Loans workflow (list, detail, lifecycle actions)

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/14-ui-loans-workflow`, branched from `main` (Phase 13 merged).
**Session size:** one 1.5–2h session. Stop point after Step 3 if needed.
**Read first:** `docs/UI_SPEC.md` §§3.2, 6, 13; `server/routes/loans.js` (read-only — response shapes and the authorize lists on approve/reject/disburse); `server/models/Loan.js` (read-only — status enum and term-unit field). This is the demo centerpiece: the approve → disburse flow Manifi will watch live.

## Objective

Restyle the loans list page and the loan detail dialog with its lifecycle actions (approve / reject / disburse) in the design system, fix the term-unit display, and convert the page's data fetching to TanStack Query with toast feedback on mutations.

## Ground rules

Zero server changes; server suite 261/261; client lint/build/test green; stop-and-flag. Server-side authority (verified during planning, do not widen or narrow in the UI): approve/reject = `employer_hr`, `employer_admin`, `lender_admin` (`server/routes/loans.js:511,586`); disburse = `lender_admin` only (`:668`); repayment recording = `lender_admin`, `lender_officer` (`:747`) — repayment UI itself is Phase 15. Keep `roleUtils.canApproveLoan`/`canDisburseLoan` as the client-side gates (they match; if you find a mismatch, flag it, don't "fix" either side silently).

## Steps

### Step 1 — LoansPage data layer

Convert `src/pages/loans/LoansPage.jsx` to TanStack Query: `useQuery(['loans'])` for `GET /api/loans`, `useQuery(['companies'])` for the filter dropdown (bare-array response — Phase 12 hotfix), `getCurrentUser()` from roleUtils instead of the extra `GET /auth/me` round-trip (drop `fetchCurrentUser` — the localStorage user has `role`, which is all this page uses; if any other field is needed, flag it). Keep filtering client-side exactly as it works today (status/company/search over the fetched list). Detail fetch (`GET /api/loans/:id`) becomes a `useQuery(['loans', id], { enabled: !!id })` keyed by the selected loan id; invalidate `['loans']` and `['loans', id]` after any lifecycle mutation.

### Step 2 — LoansPage restyle

- Header: page heading per type scale (22px/500 — `text-[22px] font-medium`), primary button "Apply for a loan" (borrower only, per the Phase 12 hotfix) — this is the page's single primary button.
- Filters card: shadcn `Input`/`Select` (auto-tokened), 16px-radius card, "Reset filters" as secondary. Results count in `--text-secondary`.
- Add `in_arrears` and `waived` to the status filter options and to the status display; **all status rendering goes through `StatusPill`** (Phase 13 component) — delete the local `getStatusColor`.
- Desktop table per spec §6: hairline dividers, no zebra, loan number + amount in Plex Mono (amount right-aligned), `formatCurrency`/`formatDate` from `@/lib/format`, **term via `formatTerm(loan.term, loan.<termUnitField>)`** — replacing the hardcoded `"{loan.term} months"` (Manifi's product is 30-day; "1 months" in the demo is unacceptable). Row click opens detail.
- Mobile card list: keep the existing structure, restyle with tokens/pills/format utils.
- Empty state: card with icon, "No loans yet" / "No loans match your filters" + secondary "Clear filters" — per spec (no fake content).

### Step 3 — LoanDetailsDialog restyle

`src/components/loans/LoanDetailsDialog.jsx` (627 lines — read it fully before editing; it contains the approve/reject/disburse action wiring and the schedule display):

- Header: loan number (Plex Mono) + StatusPill.
- Sections as bordered-divider groups (not nested cards): Applicant (name, email, company), Terms (amount, rate, term via `formatTerm`, product name/category), Dates (applied, approved, disbursed, end — `formatDate`), Repayment schedule (if rendered here): table per spec — installment #, due date, amount (Plex Mono right-aligned), installment StatusPill (`pending`/`partial` warning, `paid` success, `overdue` danger, `waived` gray — extend the StatusPill map if these aren't in it yet).
- Action buttons (footer, role-gated exactly as currently wired via `canApproveLoan`/`canDisburseLoan` + loan status): "Approve application" as the single primary; "Reject" as outline-destructive; "Disburse loan" primary when in approved state (approve and disburse never render simultaneously, so the one-primary rule holds per state). Rejection reason input (if present today) keeps its flow, restyled.
- Replace any `alert()`/inline-only feedback on these mutations with sonner toasts (`toast.success('Loan approved')` / `toast.error(message from response)`) — keep inline error display too where it already exists.

**⏸ Stop point** — commit and run gates here if the session is running long; Step 4–5 resume cleanly.

### Step 4 — Related read-only dialogs touched by the detail view

If `LoanDetailsDialog` opens `PaymentHistoryDialog`/`PrepaymentHistoryDialog` buttons, restyle only their trigger buttons this phase — the dialogs themselves are Phase 15 scope. Do not expand into RecordPayment/Prepayment dialogs.

### Step 5 — Tests

With `@/utils/api` mocked:

- LoansPage renders rows from fixture loans; a 30-day fixture loan shows "30 days", a legacy no-unit loan shows "6 months".
- Borrower sees "Apply for a loan"; lender_admin does not; lender_admin sees the company filter.
- Detail dialog: for a `pending` loan an `employer_hr` sees Approve/Reject, a `lender_officer` does not; for an `approved` loan a `lender_admin` sees "Disburse loan".
- Approve mutation success fires `queryClient` invalidation (assert the list refetches or the mock was called; keep it simple).

## Acceptance criteria

1. Loans list + detail fully tokened: pills via StatusPill everywhere (including `in_arrears` — verify against Atlas dev data, which has arrears loans), Plex Mono numerics, format utils, correct term units.
2. Live walkthrough against local dev (Atlas DB): approve a pending loan as an employer-side user, disburse it as `lender_admin`, watch toasts fire and the list update without a manual refresh.
3. No `getStatusColor` locals, no `alert()`, no `/auth/me` fetch on this page, no `useEffect` fetching.
4. Gates: server 261/261 untouched, client lint/build/test green.

## Close-out

Update CLAUDE.md (Section 2; Section 3 test count) and `changelog.md`; merge → `main`, push, delete branch.
