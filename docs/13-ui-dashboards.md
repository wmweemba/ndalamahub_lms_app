# Phase 13 — Role dashboards

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/13-ui-dashboards`, branched from `main` (Phase 12 merged).
**Session size:** one 1.5–2h session.
**Read first:** `docs/UI_SPEC.md` §§3, 6, 7, 11 (arrears decision), `docs/design/mockups/dashboard-lender-admin.html` (the layout to reproduce), `server/routes/dashboard.js` (read-only — the four stats endpoints' exact response shapes; do not trust the client's current default-state objects, some fields have drifted).

## Objective

Replace the 1,053-line legacy `DashboardPage.jsx` with four per-role dashboard components in the new design system, surface the Phase 11 arrears counts (`inArrearsLoans`/`defaultedLoans` — currently returned by the API and rendered nowhere), and remove the fake sample chart from the platform-admin view.

## Ground rules

Same as every UI phase (UI_SPEC §13): zero server changes (`git diff main -- server/` empty), server suite 261/261, client lint/build/test green, stop-and-flag over improvisation. **No fake/sample chart data anywhere** — this phase removes the existing offender; do not replace it with another. There is no trend endpoint; charts are post-demo (UI_SPEC §12.5).

## Steps

### Step 1 — Shared building blocks

Create in `src/components/dashboard/`:

- **`MetricCard.jsx`** (replaces `StatCard.jsx`): props `label`, `value`, `sub` (optional small line under the value), `tint` (`'default' | 'periwinkle' | 'accent'`), `mono` (default true). Per spec §6: tint background (`--muted` / `--color-status-info-bg` / `--tint-accent`), 14px radius, no border/shadow, 12px secondary label, Plex Mono value (`font-mono`, 22px, weight 500, tint-matched fg for periwinkle/accent tints).
- **`StatusBreakdownCard.jsx`**: props `title`, `rows: [{ label, count, pill }]` — a card (16px radius, `--muted` bg) listing loan statuses with the count in Plex Mono and a status pill per UI_SPEC §3.2. Replaces the hand-rolled progress-bar rows (drop the bars entirely — count + pill reads better at these volumes than 2px bars).
- **`StatusPill.jsx`** in `src/components/ui/` (or reuse `badge.jsx` with new variants — pick one and use it consistently from here on): maps the canonical loan/ticket status → tint/text tokens from UI_SPEC §3.2, full pill radius, always renders the status text. Export the mapping so tests can assert it. This component is reused by Phases 14–17.

### Step 2 — Split DashboardPage

`src/pages/dashboard/DashboardPage.jsx` becomes a thin role switch (using `getCurrentUser` + `roleUtils.ROLES`) rendering one of:

- `src/components/dashboard/LenderDashboard.jsx` — `lender_admin` **and** `lender_officer` (decision 2026-07-16; the Step 1 hotfix from Phase 12 already routes officers here).
- `EmployerDashboard.jsx` — `employer_admin`, `employer_hr` (heading differs by role as today).
- `PlatformDashboard.jsx` — `platform_admin` (light register for now; dark register is post-demo).
- `BorrowerDashboard.jsx` — `borrower` (structural port this phase; full consumer treatment in Phase 16).

Each component fetches its own endpoint with **TanStack Query** (`useQuery`, queryKey per endpoint, `api` from `@/utils/api`) — this removes the raw `useState`/`useEffect` block. Loading state: a simple centered spinner (consistent with SupportPage's); error state: danger-token message card. Delete `StatCard.jsx`, `ProgressBar.jsx`, `TrendChart.jsx` once unreferenced.

### Step 3 — LenderDashboard (`GET /api/dashboard/lender-stats`)

Layout per the lender mockup: page heading ("Good morning, {firstName}" or "Lender Portfolio Dashboard" — use `Welcome back, {firstName}` + subtitle `{lenderCompany.name} portfolio · {role label}`), then:

- **KPI grid (4, responsive):**
  1. "Active portfolio" — `formatCurrency(portfolioSummary.activeLoanAmount)`, default tint, sub: `Total: {formatCurrency(totalLoanAmount)}`.
  2. "Active loans" — `portfolioSummary.activeLoans`, **periwinkle tint**, sub: "performing" (activeLoans means strictly `status === 'active'` — locked decision, CLAUDE.md §6/Phase 11).
  3. "Overdue" — `inArrearsLoans + defaultedLoans`, default tint, sub: `{inArrearsLoans} in arrears · {defaultedLoans} defaulted`. Verify the exact field locations in the `/lender-stats` response by reading `server/routes/dashboard.js` before wiring.
  4. "Pending applications" — `portfolioSummary.pendingLoans`, **accent tint** (the one attention card), sub: `{readyForDisbursement} ready to disburse`.
- **Two-column row:** left = `StatusBreakdownCard` ("Portfolio overview": pending, approved, active, in arrears, defaulted, completed, rejected — each with StatusPill) plus the Outstanding Balance / Total Interest Earned figures (Plex Mono); right = Quick actions card — **one** primary button ("Disburse approved loans (N)" → `/loans`), the rest secondary/outline ("View portfolio loans", "Manage employers" → `/companies`, "Generate reports" → `/reports`). Verb-first sentence case.
- **Recent applications** table (if non-empty): spec §6 table treatment — hairline dividers, no zebra, numeric/loan-number columns Plex Mono right-aligned where numeric, StatusPill for status, `formatDate`/`formatCurrency`.

### Step 4 — EmployerDashboard (`GET /api/dashboard/hr-stats`)

Same structure, employer content: KPIs = Total employees (sub: `{employeesWithLoans} with loans`), Outstanding balance, Pending approvals (**accent tint**), Active loans. Breakdown card adds **in arrears** and **defaulted** rows (fields added in Phase 11 — verify names in `server/routes/dashboard.js`; no top-level overdue KPI on the employer side, locked decision UI_SPEC §11). Quick actions: primary "Review pending loans (N)", secondary "View company loans" / "Manage employees" (→ `/settings`) / "Generate reports". Recent applications table as in Step 3 (employee column instead of company).

### Step 5 — PlatformDashboard (`GET /api/dashboard/stats`)

Light-register minimal: KPI grid of the real figures only — Active companies (sub: `{activeCorporates} employer clients`), Active loans (sub: total amount), Active users. **Delete the "System Status: All services operational" card and the sample TrendChart** — no replacement (fake data in a demo is worse than no chart). Optionally a fourth MetricCard "Lender tenants" if the response distinguishes lender counts — read the endpoint; if it doesn't, leave three cards.

### Step 6 — BorrowerDashboard

Structural port only (Phase 16 does the consumer register properly): keep the existing two states (no loans → getting-started card with primary "Apply for a loan" button → `/loans`; has loans → cards for totals, active amount, next payment due). Restyle with MetricCard/tokens, `formatCurrency`/`formatDate`, next-payment card uses warning tint tokens rather than orange Tailwind classes. Remove gradient classes (spec: flat over decorative).

### Step 7 — Tests

With `@/utils/api` mocked per endpoint fixture:

- `LenderDashboard` renders the Overdue KPI as the sum, and the breakdown shows in-arrears/defaulted rows with the right pill classes.
- `EmployerDashboard` renders pending approvals and the arrears rows.
- `PlatformDashboard` contains no chart element and no "System Status" text.
- `StatusPill` mapping unit test: every status in UI_SPEC §3.2 → expected tint class; unknown status → gray neutral.
- Role-switch test: seeded `lender_officer` renders LenderDashboard.

## Acceptance criteria

1. `DashboardPage.jsx` is a thin switch; four role components exist; `StatCard`/`ProgressBar`/`TrendChart` deleted; no `useState`-based fetching remains in dashboard code.
2. Arrears are visible: lender Overdue KPI + breakdown rows; employer breakdown rows — with real numbers from the Atlas dev DB (it has loans in arrears; verify in the browser as `manager` or the current FirstBank lender_admin seed user).
3. No sample/fake data anywhere on any dashboard.
4. Every dashboard surface uses tokens (no `text-gray-*`/`bg-blue-*` legacy classes remain in the touched files), Plex Mono on all money/counts, one accent-tinted card and at most one primary button per view.
5. Gates: server 261/261 untouched, client lint/build/test green.

## Close-out

Update CLAUDE.md (Section 2 entry; Section 3 client test count) and `changelog.md`; merge → `main`, push, delete branch.
