# Phase 12 — UI foundation & app shell

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/12-ui-foundation-shell`, branched from `main`.
**Session size:** one 1.5–2h session. Explicit stop point after Step 7 if time runs out (Steps 8–10 resume cleanly).
**Read first:** `docs/UI_SPEC.md` (all of it — every later phase assumes it), CLAUDE.md Sections 5 and 9, `docs/design/mockups/dashboard-lender-admin.html` (sidebar reference).

## Objective

Lay the entire foundation the remaining UI phases build on: fix four functional bugs that predate this phase, install the design tokens/fonts/brand, replace the duplicated per-route layout blocks with one shared `AppLayout` (sidebar nav per the design system), restyle the login page, mount toasts, delete dead files, hide the Settings placeholder tabs, and stand up the client test harness.

## Ground rules (apply to this and every UI phase)

- **Zero server changes.** `git diff main -- server/` must be empty when this phase merges. If a step appears to require a server change, stop and flag — do not make it.
- Regression gates before merge: `cd server && pnpm test` → 261/261; `cd client && pnpm lint && pnpm build && pnpm test` all green.
- pnpm only (10.12.1). No new UI/component libraries; the dependencies added below are fonts and test tooling only.
- Follow this document exactly; stop and flag ambiguity rather than improvising (CLAUDE.md Section 11).

## Steps

### Step 1 — Functional hotfixes (own commit, before any styling work)

These are pre-existing functional bugs, legal under the old freeze and needed regardless of styling. Commit as `fix(client): stale role keys, companies response shape, lender_officer dashboard`.

1. **`client/src/pages/loans/LoansPage.jsx:169`** — the local `canApplyForLoan` checks `ROLES.CORPORATE_USER` / `ROLES.CORPORATE_ADMIN`, keys that stopped existing in Phase 03, so borrowers never see the Apply button. Delete the local function and use `canApplyForLoan` from `@/utils/roleUtils` (borrower-only — this matches the server: `POST /api/loans` is `authorize('borrower')`, `server/routes/loans.js:293`; do not widen it).
2. **`LoansPage.jsx:244`** — company filter gated on `ROLES.SUPER_USER` (nonexistent). Change to `[ROLES.PLATFORM_ADMIN, ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER].includes(currentUser.role)`.
3. **`LoansPage.jsx` `fetchCompanies`** — reads `response.data.data.companies`, but `GET /api/companies` returns a bare array (`server/routes/companies.js:20` does `res.json(companies)`). Change to `setCompanies(Array.isArray(response.data) ? response.data : [])`.
4. **`client/src/pages/dashboard/DashboardPage.jsx:93`** — `lender_officer` matches no dashboard branch and falls through to an empty borrower view. Rename `isLenderAdmin` to `isLenderSide` and include both roles: `[ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER].includes(currentUser.role)` (update the two usages at lines ~113 and ~219). The `/dashboard/lender-stats` endpoint already authorizes lender_officer via tenancy scoping — verify by reading `server/routes/dashboard.js` (read-only); if it turns out to 403 for lender_officer, stop and flag instead of changing the server.

### Step 2 — Fonts

```
cd client && pnpm add @fontsource-variable/inter @fontsource/ibm-plex-mono
```

In `src/main.jsx`, before `./index.css`:

```js
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
```

### Step 3 — Design tokens (`src/index.css`)

Replace the `:root` block's values and extend `@theme inline`. Keep the existing structure (shadcn variable names) so all `components/ui/*` primitives restyle automatically. Leave the `.dark` block untouched (post-demo register). Exact values:

```css
@theme inline {
  /* keep the existing --radius-* and --color-* mappings, and add: */
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --color-nh-charcoal: var(--nh-charcoal);
  --color-nh-sage: var(--nh-sage);
  --color-nh-periwinkle: var(--nh-periwinkle);
  --color-nh-mauve: var(--nh-mauve);
  --color-nh-accent: var(--nh-accent);
  --color-status-success-bg: var(--status-success-bg);
  --color-status-success-fg: var(--status-success-fg);
  --color-status-warning-bg: var(--status-warning-bg);
  --color-status-warning-fg: var(--status-warning-fg);
  --color-status-danger-bg: var(--status-danger-bg);
  --color-status-danger-fg: var(--status-danger-fg);
  --color-status-info-bg: var(--status-info-bg);
  --color-status-info-fg: var(--status-info-fg);
  --color-tint-accent: var(--tint-accent);
  --color-tint-accent-fg: var(--tint-accent-fg);
}

:root {
  --radius: 0.75rem;                    /* 12px: sm=8, md=10, lg=12, xl=16 — matches spec §5 */
  --background: #F4F7F5;
  --foreground: #1C1C1C;
  --card: #FFFFFF;
  --card-foreground: #1C1C1C;
  --popover: #FFFFFF;
  --popover-foreground: #1C1C1C;
  --primary: #D6295E;                   /* accent = primary CTA */
  --primary-foreground: #FFFFFF;
  --secondary: #CCDAD1;                 /* sage */
  --secondary-foreground: #1C1C1C;
  --muted: #F4F7F5;
  --muted-foreground: #8A8A88;
  --accent: #CCDAD1;                    /* hover/selected surfaces = sage */
  --accent-foreground: #1C1C1C;
  --destructive: #A32D2D;
  --border: #E4E4E1;
  --input: #E4E4E1;
  --ring: #D6295E;
  --sidebar: #FAFAF8;
  --sidebar-foreground: #5F5E5A;
  --sidebar-accent: #CCDAD1;
  --sidebar-accent-foreground: #1C1C1C;
  --sidebar-border: #E4E4E1;
  /* brand + status (spec §3) */
  --nh-charcoal: #1C1C1C; --nh-sage: #CCDAD1; --nh-periwinkle: #7E78D2;
  --nh-mauve: #C492B1; --nh-accent: #D6295E;
  --status-success-bg: #EAF3DE; --status-success-fg: #3B6D11;
  --status-warning-bg: #FAEEDA; --status-warning-fg: #854F0B;
  --status-danger-bg: #FCEBEB; --status-danger-fg: #A32D2D;
  --status-info-bg: #EFEDFB;  --status-info-fg: #26215C;
  --tint-accent: #FCEAF0;     --tint-accent-fg: #7A1638;
}
```

Leave the remaining `--chart-*`/`--sidebar-primary*` values as they are (unused for now). Do not chase every hardcoded `text-gray-*` in pages this phase — pages get restyled in their own phases; this step only makes the token layer correct.

### Step 4 — Brand wiring

Assets are already vendored at `client/public/brand/` (done during planning — verify they exist, don't re-copy). In `client/index.html`:

- `<title>NdalamaHub</title>`
- Replace the favicon link with:
  ```html
  <link rel="icon" href="/brand/raster/favicon.ico" sizes="any">
  <link rel="icon" href="/brand/svg/NdalamaHub-icon-favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/brand/raster/apple-touch-icon.png">
  ```
- Delete `client/public/favicon.ico` and `client/public/vite.svg` (superseded). Keep `client/public/_redirects` (Netlify SPA config).

### Step 5 — AppLayout (the duplication killer)

Create `src/components/layout/AppLayout.jsx`:

- **Desktop (`md:`+), non-borrower:** left sidebar per spec §6 / the lender mockup — `w-[220px]`, `bg-[--sidebar]`, hairline right border, brand lockup at top (`<img src="/brand/svg/NdalamaHub-lockup-horizontal-light.svg" alt="NdalamaHub" className="h-8" />`), nav links with lucide icons (`LayoutDashboard`, `Banknote`, `Building2`, `Package`, `BarChart3`, `Settings`, `LifeBuoy`), active link = sage pill (`bg-[--nh-sage] text-[--foreground] font-medium rounded-[10px]`), inactive = `text-[--sidebar-foreground]`. Bottom of sidebar: user name + role label + "Log out" (reuse `authService.logout()` + navigate). Use `NavLink` from react-router for active state.
- **Mobile (<`md`), non-borrower:** top bar (brand icon `NdalamaHub-icon.svg` + wordmark, hamburger) toggling a full-width menu panel — port the existing Navbar mobile-menu behavior, restyled with tokens.
- **Borrower:** desktop gets the same sidebar (items: Dashboard, Loans, Support only); mobile gets a **bottom tab bar** instead of the hamburger — fixed bottom, 3 items (Dashboard, Loans, Support), icon + 12px label, ≥44px targets, active = `text-[--nh-accent]` (icon+label color only, no fill), content gets bottom padding so nothing hides behind it.
- Nav visibility rules come from `roleUtils` exactly as the current `Navbar.jsx` does (`canAccessCompanies`, `canAccessReports`, `canAccessSettings`, products = PA/LA/LO). Do not change who sees what.
- Body: `<main>` with `max-w-7xl mx-auto` padding per spec, containing `<SubscriptionBanner />` once, then `<Outlet />`.
- Mount `<Toaster richColors position="top-right" />` from `@/components/ui/sonner` here (once, inside the layout so it exists on all protected pages).

Rewrite `src/App.jsx` routes to:

```jsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/account-locked" element={<AccountLockedPage />} />
  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/loans" element={<LoansPage />} />
    <Route path="/companies" element={<CompaniesPage />} />
    <Route path="/products" element={<ProductsPage />} />
    <Route path="/users" element={<UsersPage />} />   {/* removed in Phase 17 */}
    <Route path="/reports" element={<ReportsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/support" element={<SupportPage />} />
  </Route>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

Delete `src/components/layout/Navbar.jsx` once nothing imports it.

### Step 6 — Login restyle

`AuthLayout.jsx` + `LoginForm.jsx`, minimal but on-brand: page background `--background`; card per spec §5 (16px radius, hairline border, white); replace the padlock circle with the stacked lockup (`/brand/svg/NdalamaHub-lockup-stacked.svg`, ~96px) or horizontal lockup if the stacked renders poorly at that size; inputs restyled with tokens (keep them as plain controlled inputs — no RHF); submit button = primary accent fill ("Sign in"); error message uses the danger status tokens. No new functionality (no forgot-password link — see UI_SPEC §12.4).

### Step 7 — Format utilities

Create `src/lib/format.js`:

- `formatCurrency(amount)` → `"K" + Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })` (K-prefixed Kwacha, matching current app convention).
- `formatDate(date)` → `en-GB`-style short date (`12 Jul 2026`); returns `'—'` for falsy input.
- `formatTerm(term, termUnit)` → `"${term} ${unit}"` with singular/plural handling (`1 day`, `30 days`, `6 months`); `termUnit` defaults to `'months'` when absent (legacy loans). Read `server/models/Loan.js` / `server/models/LoanProduct.js` (read-only) to confirm the exact term-unit field name and enum values before writing this; use those values.

Used by Phases 13–17; nothing else needs converting this phase.

**⏸ Stop point.** If the session is running long: commit, run all gates, and stop here. Steps 8–10 are independent and resume cleanly next session (note the resume point in the phase-close commit message and changelog entry).

### Step 8 — Housekeeping deletions

Delete (verified unimported during planning — re-verify with `grep -rn "<name>" src/` before each deletion; if anything imports one, stop and flag):

- `src/components/loans/LoanApplicationForm.jsx` and `LoanApplicationForm_new.jsx`
- `src/components/reports/ReportModal_new.jsx`
- `src/pages/loans/ProductComparison.jsx`
- `src/components/loans/LoanApprovalActions.jsx`
- `src/store/authStore.js` (zero bytes), and the `store/` dir if now empty
- `src/App.css`, `src/assets/react.svg` (and `assets/` if empty)

### Step 9 — Hide Settings placeholder tabs

In `src/pages/settings/SettingsPage.jsx`: remove the `security`, `notifications`, and `integrations` entries from the `tabs` array, their switch cases, the `SecuritySettings`/`NotificationSettings`/`IntegrationSettings` components, and now-unused lucide imports. These were local-state stubs with dead Save buttons (decision 2026-07-16, UI_SPEC §12.2 — rebuild post-demo with real server backing; git history preserves the code). Don't restyle the rest of SettingsPage — that's Phase 17.

### Step 10 — Test harness

```
cd client && pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- `vite.config.js`: add `test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js' }`.
- `src/test/setup.js`: `import '@testing-library/jest-dom/vitest';` plus a `beforeEach` clearing localStorage.
- `src/test/utils.jsx`: `makeFakeToken(payloadOverrides)` building `header.payload.sig` with base64url-encoded JSON and `exp: Math.floor(Date.now()/1000) + 3600` (required — `getCurrentUser()` decodes and checks `exp`), and `seedUser(user)` writing `ndalamahub-token` + `ndalamahub-user` to localStorage. Include a router/QueryClient render wrapper.
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- Tests to write:
  - `src/lib/format.test.js` — currency, date, and term-unit cases (incl. legacy no-unit default).
  - `src/components/layout/AppLayout.test.jsx` — renders sidebar nav for a seeded `lender_admin` (Companies/Products/Reports visible), hides Companies/Products/Settings for a seeded `borrower`, and `<ProtectedRoute>` redirects to `/login` with no seeded user. Mock `@/utils/api` (`vi.mock`) so SubscriptionBanner's query is inert.
- Check `eslint.config.js` passes over test files (vitest globals — add a `globals: {...globals.vitest}`-style override for `**/*.test.*` and `src/test/**` if lint complains).

## Acceptance criteria

1. One `AppLayout`; `App.jsx` contains **zero** repeated Navbar/SubscriptionBanner blocks; every protected page renders inside the sidebar shell; borrower on mobile gets the bottom tab bar.
2. Sidebar, login, buttons, and shadcn primitives visibly use the new palette/fonts (Inter renders; a Plex Mono sample is visible somewhere touched, e.g. login is exempt — verify via the format util tests instead).
3. Hotfix verification against the local dev servers (`pnpm dev` at root, Atlas dev DB): a borrower login sees "Apply for Loan"; a lender_admin sees the company filter on Loans with real company names; a lender_officer login sees the lender dashboard, not an empty borrower view.
4. Dead files gone; Settings shows only User Management / Company / System / Billing tabs; browser tab shows the NdalamaHub icon + title.
5. All gates green: server 261/261 untouched (`git diff main -- server/` empty), client lint/build/test pass.

## Close-out

- Update `CLAUDE.md`: Section 2 (Last-updated entry for Phase 12), Section 3 (client test command now exists: `cd client && pnpm test`, N tests), Section 9 (note Phase 12 complete; freeze remains lifted per UI_SPEC).
- Update `changelog.md` (Phase 12 entry: hotfixes, shell, tokens, deletions, test harness).
- Merge `phase/12-ui-foundation-shell` → `main`, push `origin/main`, delete the branch (local + remote if pushed).
