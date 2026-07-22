# Phase 23 — Customers surface (client, + invite endpoint)

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/23-customers-surface`, branched from `main` (Phase 22 merged).
**Session size:** one ~2h session.
**Read first:** `docs/UI_SPEC.md` (all conventions apply — tokens, StatusPill, format utils, single-primary rule); Phase 19's close-out notes (the extended `/auth/me` payload with `company.lendingModel`); `server/routes/users.js` (creation validation as it stands after Phase 19).

## Objective

Give direct-model lenders their operating surface: a **Customers** nav item replacing Companies, with customer list/detail/create built NRC-first, and both credential flows (email invite / walk-in temp password) working end to end. Employer-model lenders and platform_admin see no change.

## Steps

### Step 1 — Model-aware navigation

`AppLayout.jsx`: the current user's `company.lendingModel` (from the Phase 19 `/auth/me` extension — cache it alongside the existing current-user handling; do not add a new fetch per render) drives nav: **direct lender staff** see "Customers" (`/customers`) and **do not** see "Companies"; employer-model lenders and platform_admin keep "Companies" exactly as-is. Borrower nav untouched. Route added in `App.jsx` under the protected layout.

### Step 2 — Server: invite + creation polish (small, listed exhaustively)

- `POST /api/users/:id/invite` — lender-side (own tenant, target borrower must have an email): generates a set-password token via the **existing** forgot-password token infrastructure (Phase 09 — reuse the token fields/expiry; do not invent a parallel mechanism) and sends a new `emailTemplates.accountInvite()` ("set your password") email. Never returns the token in the response (same contract as forgot-password). API tests: authority, tenancy, no-email 400, token round-trip sets a password.
- Confirm a borrower **self-service change-password** path exists (`/api/auth/...`); if none, add `POST /api/auth/change-password` (authenticated, current-password required) with tests — walk-ins given a temp password must be able to change it.
- Creation route: confirm Phase 19's validations produce friendly per-field 400s the form can render (department **not** required, email optional, NRC required + per-company-unique).

### Step 3 — CustomersPage

`src/pages/customers/CustomersPage.jsx` (+ components under `src/components/customers/`):

- List: the lender's borrowers (`GET /api/users?role=borrower` — verify the existing scoping returns direct borrowers; flag if the route needs a role query param added). Columns/cards: name, **NRC (Plex Mono)**, phone, email-or-"—", active loans count if cheaply available (skip rather than N+1 — flag if tempting), Active/Inactive pill. Search across name/NRC/phone. UI_SPEC table treatment; mobile card list.
- Single primary button: "Add customer".
- Detail (dialog or drill-in page — pick the pattern LoansPage set: dialog): profile fields, their loans (loan number, status pill, amount — links into the existing LoanDetailsDialog), account status, actions: "Send password invite" (email present), "Reset password" (existing staff mechanism), Deactivate/Activate (existing soft-delete semantics).

### Step 4 — Create-customer flow (NRC-first)

`CreateCustomerDialog`: first/last name, **NRC (required)**, phone (required), email (optional, labeled "for account invite + reminders"), address; then a credentials block that switches on email presence: **with email** → "an invite to set their password will be emailed" (calls create then invite); **without** → temp password field (staff hands it over in person; helper text says the customer should change it after first login) and username auto-set to the NRC (shown read-only). Duplicate-NRC 400 renders inline on the NRC field. Toasts + `['customers']` invalidation throughout.

### Step 5 — Tests + manual verification

- Vitest: nav switches on lendingModel (direct → Customers, employer → Companies); create dialog requires NRC but not email; with-email path calls invite; without-email path requires temp password.
- Manual on dev Atlas (direct test lender from Phase 19): create a walk-in customer (NRC-only) → log in as them with NRC + temp password → change password; create an emailed customer → confirm the invite sends (or the no-op warn logs cleanly if Resend is unconfigured in dev — state which happened in the changelog). Record both in the changelog.

## Acceptance criteria

1. A direct lender's staff can run the walk-in flow start to finish without touching email; the emailed flow works where email exists; nobody is turned away.
2. Employer-model lenders see zero change (test-pinned nav case).
3. Gates: full server suite green (invite/change-password tests added), client lint/build/test green.

## Close-out

Update CLAUDE.md (§2; §3 counts) and `changelog.md`; merge → `main`, push, delete branch.
