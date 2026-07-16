# Phase 15 — Apply flow, repayment dialogs, products

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/15-ui-loan-forms-repayments-products`, branched from `main` (Phase 14 merged).
**Session size:** one 1.5–2h session. Stop point after Step 2.
**Read first:** `docs/UI_SPEC.md` §§3.2, 6, 13; `server/routes/loans.js` repayment/prepayment/settlement routes (read-only, `:747` onward); `server/models/LoanProduct.js` (read-only — rate basis / term unit fields as configured in Phase 05).

## Objective

Bring the money-movement surfaces into the design system: the borrower apply flow (`ProductBasedLoanForm`), the repayment/prepayment/history dialogs, and the Products page with its create/edit dialogs — including unit-aware term and rate-basis display.

## Ground rules

Zero server changes; server suite 261/261; client lint/build/test green; stop-and-flag. Repayment/prepayment recording is lender-side only (`lender_admin`, `lender_officer`) — server-enforced; the client gates must continue to match. Forms stay controlled-input (no RHF migration — UI_SPEC §12.6). All calculation/quote logic stays exactly as wired (these dialogs call server endpoints for fees/schedules/settlement quotes — restyle, don't re-derive any math client-side).

## Steps

### Step 1 — Apply flow (`src/components/loans/ProductBasedLoanForm.jsx`, 691 lines — read fully first)

The borrower's loan application dialog, also exercised in the demo and on mobile in Phase 16:

- Restyle to tokens: dialog per spec (radius 16px, shadow allowed — true overlay), section headings 16px/500, inputs via shadcn primitives.
- `ProductSelector.jsx`: product options as selectable cards (border → sage-tinted when selected, no accent fill), showing name, category pill, rate **with its basis** (e.g. "25% flat per term" — read the exact rate-basis/term-unit field names and enums from `server/models/LoanProduct.js` and render them faithfully; do not assume per-annum), amount range and term range via `formatCurrency`/`formatTerm`.
- Amount/term inputs: Plex Mono values, validation messages in danger tokens. Any fee/schedule preview the form fetches (check-eligibility / calculate-fees / calculate-schedule endpoints): schedule preview table per spec §6, totals in Plex Mono.
- Submit: single primary button ("Submit application"); success → sonner toast + close + list invalidation (`['loans']`).

### Step 2 — Repayment & prepayment dialogs

`RecordPaymentDialog.jsx`, `PrepaymentDialog.jsx`, `PaymentHistoryDialog.jsx`, `PrepaymentHistoryDialog.jsx`:

- Restyle to tokens; all amounts/dates via format utils, Plex Mono; installment statuses via StatusPill (ensure `partial`, `overdue`, `waived` are in the map from Phase 14).
- `RecordPaymentDialog`: primary "Record repayment"; show remaining-balance figures as returned by the server; success/error toasts; invalidate `['loans']` + `['loans', id]`.
- `PrepaymentDialog`: quote figures (settlement amount, interest saved) in a highlighted summary block — **periwinkle info tint, not accent** (money summary, not a CTA); confirm button primary ("Record prepayment" / "Settle loan" as currently labeled, verb-first).
- History dialogs: spec table/list treatment, hairline dividers.
- Replace any `alert()`/`console.error`-only failure paths in these dialogs with toasts (keep inline messages where they exist).

**⏸ Stop point** — commit + gates if running long.

### Step 3 — Products page + dialogs

- `src/pages/products/ProductsPage.jsx`: convert fetching to TanStack Query (products + lenders queries; note `GET /api/companies` returns a bare array). Restyle: heading + single primary "Create product" (role-gated via `canManageProducts`, unchanged); filter selects via shadcn `Select`; product cards per spec (16px radius, hairline border, white card): name 16px/500, category pill, lender pill (info tint), rate **with basis**, amount range (Plex Mono), **term range via `formatTerm(min/max, termUnit)`** — replacing the hardcoded "months"; calculation-method pill via a small local map onto the semantic tints. Edit/delete icon buttons keep `window.confirm` (punch list).
- `CreateProductDialog.jsx` / `EditProductDialog.jsx` (682/382 lines — read before editing): restyle inputs/sections to tokens; **do not change any field names, options, or payload shapes** — these forms already carry Phase 05's `rateBasis`/term-unit fields and the server contract is frozen. Success/error toasts + `['products']` invalidation.

### Step 4 — Tests

With `@/utils/api` mocked:

- ProductsPage renders a fixture product with a 30-day term as "30 days" and shows its rate basis text.
- ProductBasedLoanForm: product selection renders rate-with-basis; submit calls `POST /api/loans` with the same payload shape as before the restyle (snapshot the mock call args against a fixture).
- RecordPaymentDialog success path fires a toast and invalidates queries (assert mutation called; keep it light).

## Acceptance criteria

1. Apply → repayment surfaces fully tokened; no raw Tailwind-gray/blue legacy classes in touched files; no hardcoded "months" anywhere in the client (`grep -rn '"months"\|months\x27\| months' src/` shows only `format.js` and legitimate prose).
2. Live check against local dev (Atlas): as borrower, submit an application through the restyled form; as lender_admin, record a repayment through the restyled dialog — both succeed with toasts.
3. Product cards show Manifi-style products faithfully: 25% flat, 30-day term rendered exactly.
4. Gates: server 261/261 untouched, client lint/build/test green.

## Close-out

Update CLAUDE.md (Section 2; Section 3 test count) and `changelog.md`; merge → `main`, push, delete branch.
