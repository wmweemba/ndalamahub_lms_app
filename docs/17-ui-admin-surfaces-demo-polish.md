# Phase 17 — Remaining admin surfaces & demo dress rehearsal

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/17-ui-admin-surfaces-demo-polish`, branched from `main` (Phase 16 merged).
**Session size:** one 1.5–2h session. Stop point after Step 4 (Step 5's rehearsal can run as its own short session).
**Read first:** `docs/UI_SPEC.md` §§10–12; `server/routes/reports.js` (read-only — report response shapes).

## Objective

Bring the last demo-visible surfaces into the design system (Companies, Settings, Reports, Support), remove the orphaned `/users` page, sweep loading/empty states for consistency, and run a scripted end-to-end dress rehearsal of the exact Manifi demo flow.

## Ground rules

Zero server changes; server suite 261/261; client lint/build/test green; stop-and-flag. `window.confirm` stays (punch list); do not rebuild the hidden Settings stub tabs (post-demo, UI_SPEC §12.2).

## Steps

### Step 1 — Companies

`src/pages/companies/CompaniesPage.jsx` + `CreateCompanyDialog.jsx` + `EditCompanyDialog.jsx` (450/454 lines — read before editing):

- Convert page fetch to TanStack Query (`['companies']`, bare-array response). Restyle: heading + single primary create button (label stays role-aware: "Create employer client" for lender_admin — sentence case), table per spec (type pill: `lender` info tint / `corporate` gray; Active/Inactive pill per UI_SPEC §3.2), mobile card list, empty state.
- Dialogs: token restyle only — field names and payload shapes frozen; toasts on success/error; invalidate `['companies']`. Delete keeps `window.confirm` but gets a destructive-outline button.

### Step 2 — Settings

`src/pages/settings/SettingsPage.jsx` (stub tabs already removed in Phase 12) + the four remaining tab components:

- Tab nav restyle: desktop keeps the left rail inside the page (rail items = sage active pill, consistent with the app sidebar); mobile keeps the card-grid → drill-in pattern, tokened.
- `UserManagement.jsx` + `CreateUserDialog.jsx` + `EditUserDialog.jsx`: this is the **borrower-setup surface in the demo** — restyle carefully: user table (role pills: map each role to a tint — platform info, lender-side periwinkle/info, employer success-muted, borrower gray; pick once, document in the component, reuse), search/filter via shadcn primitives, dialogs tokened, toasts + invalidation. **No changes to role-assignment logic** — the create/edit role dropdowns' option filtering is security-adjacent (Phase 01/03b hotfix territory); restyle the controls, never the option lists. If an option list looks wrong, flag it.
- `CompanySettings.jsx`, `SystemSettings.jsx`: token restyle, no behavior changes.
- `SubscriptionManagement.jsx` (Billing, platform_admin only): restyle table + edit dialog; subscription status pills: `trialing` info, `active` success, `past_due` warning, `read_only` warning, `suspended`/`cancelled` danger.

### Step 3 — Reports

`src/pages/reports/ReportsPage.jsx` + `ReportModal.jsx` (509 lines — read first):

- **Strip all debug artifacts**: the emoji `console.log`s and the `<pre>{JSON.stringify(stats)}</pre>` debug block in the error state. Error state becomes a danger-token message card.
- Convert fetch to TanStack Query (keep the existing employer_hr → `/dashboard/hr-stats` branch and its data transform exactly as-is).
- KPI cards → `MetricCard` (Overdue = in_arrears + defaulted stays, plain tint); "Loans by status" breakdown → StatusPill rows (reuse `StatusBreakdownCard` if it fits, else same treatment inline); companies-by-type likewise.
- Report cards (Active loans / Overdue loans / Upcoming payments): tokened, "View" secondary + "Export" secondary. **Check how export actually behaves** (both buttons currently call the same JSON `generateReport`): read `ReportModal.jsx` and `server/routes/reports.js` to see whether a real file-download path (PDF/Excel) is wired from the client. Restyle whatever exists; if export is view-only from the client while the server has PDFKit/ExcelJS endpoints, **flag it in the close-out notes** (server-capable, client-unwired) rather than wiring new endpoints ad hoc — William decides whether that's demo-blocking.
- `ReportModal`: spec table treatment, Plex Mono numerics, StatusPills.

### Step 4 — Support touch-up, `/users` removal, consistency sweep

- `SupportPage.jsx`: already the cleanest page — align ticket status pills to StatusPill, heading scale, primary "New ticket" as the single primary; nothing structural.
- **Remove the orphaned `/users` route**: delete `src/pages/users/UsersPage.jsx` and its route from `App.jsx` (decision 2026-07-16, UI_SPEC §12.7 — Settings → User Management is canonical; no nav link ever pointed here).
- Consistency sweep across all restyled pages: one spinner pattern (the centered `animate-spin` treatment) for loading, one empty-state pattern (icon + 16px/500 title + secondary text + optional secondary action), page headings all 22px/500, `font-bold` replaced by `font-medium` in touched files. Sweep for leftover legacy palette classes in `src/pages/` and `src/components/` (`grep -rn "bg-blue-\|text-gray-9\|bg-orange-\|shadow-lg" src/pages src/components --include="*.jsx"`) — files owned by earlier phases should already be clean; fix stragglers.

**⏸ Stop point** — commit + gates. Step 5 can be its own short session.

### Step 5 — Demo dress rehearsal (scripted, against local dev + Atlas dev DB)

Run the exact Manifi walkthrough end-to-end in the browser, in order, fixing only cosmetic/UI issues found (anything functional → flag, don't hotfix silently):

1. Log in as the FirstBank `lender_admin` seed user → lender dashboard (KPIs, arrears, recent applications all real data).
2. Settings → User Management → create a new borrower under an employer client.
3. Log in as that borrower (mobile viewport) → apply for a loan against the 30-day flat-rate product.
4. Log in as an `employer_hr` seed user → dashboard shows the pending approval → approve it from loan detail.
5. Back as `lender_admin` → disburse → record a repayment → open payment history.
6. Show an in-arrears loan (Atlas has them) → its pill on list/detail/dashboard.
7. Reports → view each of the three reports → export behavior as found in Step 3.
8. Raise a support ticket as the borrower; view it as the lender.
9. Log in as `platform_admin` → light dashboard + Billing tab render correctly.

Record the rehearsal as a checklist in the changelog entry (pass/fail per step + screenshots optional). Also `pnpm build && pnpm preview` once to confirm the production bundle renders (fonts/assets resolve).

## Acceptance criteria

1. Every demo-visible surface is in the design system; the grep sweep in Step 4 returns clean; no `console.log` debug output on Reports; `/users` gone.
2. Dress-rehearsal checklist passes 1–9, or every failure is explicitly flagged with a decision needed.
3. Gates: server 261/261 untouched, client lint/build/test green, production build renders.

## Close-out

- Update CLAUDE.md: Section 2 (Phase 17 entry — the pre-demo UI build is complete), Section 3 (client test count), **Section 9 rewritten**: freeze language replaced with "design system live per `docs/UI_SPEC.md`; UI changes must conform to it; server suite untouched by UI work". Update `changelog.md` with the rehearsal checklist.
- Merge → `main`, push, delete branch.
- **Deploy note:** after pushing, get the Netlify frontend redeployed (auto-deploy from `main` if wired, otherwise ask William to trigger it) and verify the demo flow once against `https://ndalamahublms.netlify.app/` (Render backend) — the demo runs there, not on localhost.
