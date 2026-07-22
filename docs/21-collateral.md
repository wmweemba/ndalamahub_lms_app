# Phase 21 — Collateral register & enforcement (full-stack)

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/21-collateral`, branched from `main` (Phase 20 merged).
**Session size:** one ~2h session. Stop point after Step 3 (server) — Step 4–5 (client) resume cleanly.
**Read first:** `docs/DECISIONS.md` "Manifi launch decisions (2026-07-22)" (collateral rules); `server/models/LoanProduct.js`'s existing dormant collateral section (~line 211: enum `['property','vehicle','equipment','inventory','securities','guarantor','other']` and whatever required-flag exists around it — read it fully; reuse the product-level required flag if present rather than adding a duplicate); `server/routes/loans.js` approve (`:511`) and disburse (`:668`) routes; `docs/UI_SPEC.md` §§3.2, 6 for all client styling.

## Objective

Collateral as a first-class record: captured with a declared value, **verified by lender staff before a loan can be approved** (Clement: "blocked until verification"), with a **letter-of-sale-on-file flag that blocks disbursement** (paper process at launch — no file uploads, locked decision), and a lender-wide **Collateral Register** page.

## Steps

### Step 1 — Model

New `server/models/Collateral.js` (separate collection — the register must be a cheap query):

- `lenderCompany` (req), `loan` (ref, optional — an intake application's collateral is attached at conversion in Phase 22), `application` (ref CustomerApplication, optional; exactly one of loan/application set),
- `type`: enum `['vehicle', 'business_equipment', 'title_deed', 'other']` (Clement's list; note it deliberately differs from the product schema's dormant enum — this is the collateral *record* type), `otherDescription` (required when type `other`),
- `description` (req), `estimatedValue` (req, Number ≥ 0),
- `status`: `['declared', 'verified', 'rejected']` default `declared`; `vettedBy`/`vettedAt`/`vettingNotes`,
- `letterOfSale: { onFile: Boolean default false, reference: String, recordedBy, recordedAt }`,
- timestamps. Indexes: `{ lenderCompany: 1, status: 1 }`, `{ loan: 1 }`.

### Step 2 — Routes + tenancy

`server/routes/collateral.js` (mount `/api/collateral`):

- `GET /` — the register: lender-side roles only, scoped to own `lenderCompany` (platform_admin unscoped); filters `status`, `type`; returns loan number + applicant via populate (orphan-guarded per the Phase 06 pattern).
- `POST /loans/:loanId` (or nested under loans — follow whichever mounting pattern is cleaner with the existing router structure; flag if ambiguous), `PUT /:id`, plus `PUT /:id/verify` and `PUT /:id/reject` (sets status + vettedBy/At/notes) and `PUT /:id/letter-of-sale` (sets onFile + reference + recordedBy/At). All lender-side only (`lender_officer`+), own-tenant only via `loan.lenderCompany`/`collateral.lenderCompany` checks — borrowers/employers are read-only on their own loan's collateral via the loan detail response (extend `GET /loans/:id` to populate collateral).
- Editing a `verified` collateral's `type/description/estimatedValue` resets status to `declared` (re-verification required) — pin with a test.

### Step 3 — Enforcement on the loan lifecycle

- Product: `requiresCollateral` flag (reuse the existing product collateral-required field if one exists — read first). Manifi's product will have it on.
- `PUT /loans/:id/approve`: if the loan's product requires collateral → at least one collateral record exists AND **every** non-rejected record is `verified`, else 422 with an explicit message ("collateral pending verification"). Loans on non-requiring products unaffected.
- `PUT /loans/:id/disburse`: same gate plus **every verified collateral has `letterOfSale.onFile`**, else 422 ("letter of sale not on file").
- API tests (`server/tests/api/collateral.test.js`): CRUD + tenancy matrix (cross-tenant 403s, borrower read-own only), approve blocked→verify→approve passes, disburse blocked→letter flag→passes, edit-resets-verification, register scoping.

**⏸ Stop point** — server complete, suite green.

### Step 4 — Client: loan detail + apply flow

- `LoanDetailsDialog`: "Collateral" section — records with type, description, value (`formatCurrency`, Plex Mono), `StatusPill` (`declared` warning, `verified` success, `rejected` danger), letter-of-sale flag. Lender staff get "Add collateral", "Verify"/"Reject" (with notes), "Record letter of sale" actions (toasts + invalidation). Approve/disburse buttons show their blocker state as an inline notice when gated (not just a failed request).
- Borrower apply flow (`ProductBasedLoanForm`): when the product requires collateral, a collateral step (type select incl. "Other — specify", description, estimated value) creating the record with the application. Keep payload contract additive.

### Step 5 — Client: Collateral Register + tests

- New `CollateralRegisterPage` at `/collateral`, nav item "Collateral" for lender-side roles (per UI_SPEC conventions; sidebar + mobile). Table/cards: loan number (link opens detail), borrower, type, description, value, status pill, letter-of-sale flag; filters by status/type; a total-estimated-value figure for `verified` records (Plex Mono).
- Vitest: register renders fixtures with correct pills; verify action gated to lender roles; apply-flow collateral step renders for a requiring product.

## Acceptance criteria

1. End-to-end on dev Atlas (direct test lender from Phase 19): apply with collateral → approve blocked → verify → approve OK → disburse blocked → record letter of sale → disburse OK. Recorded in changelog.
2. Register shows the book's collateral, tenancy-scoped, with working filters.
3. Non-collateral products and the employer model completely unaffected; full suites green (expect ~12–15 new server tests, ~4–6 client).

## Close-out

Update CLAUDE.md (§2, §3 counts) and `changelog.md`; merge → `main`, push, delete branch.
