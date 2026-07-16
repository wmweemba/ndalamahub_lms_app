# UI_SPEC.md — NdalamaHub UI specification

**Status:** adopted, 2026-07-16. This file's existence lifts the CLAUDE.md Section 9 frontend freeze.
**Source:** Part A is the NdalamaHub design system (`UI_UX_SPEC.md`, direction locked 2026-07-11, adopted here with William's sign-off), reconciled where it had gone stale (the logo now exists — see §9). Part B is the build specification produced in the 2026-07-16 UI planning session: screen inventory, demo scope, conventions, testing, and the decisions log.
**Authority:** for any visual/UX question during a UI phase, this document is the source of truth. If a phase document contradicts it, stop and flag (standing rule).

**Reference assets in this repo:**

- Brand assets (final, v2): `client/public/brand/svg/` (icon, mono icon, favicon SVG, horizontal lockups light/dark/mono, stacked lockup, wordmark) and `client/public/brand/raster/` (favicon.ico, apple-touch-icon, PWA icons). Provenance notes: `docs/design/brand-assets-README.md`.
- Register mockups (concrete renders of the three registers): `docs/design/mockups/dashboard-lender-admin.html`, `dashboard-platform-admin-dark.html`, `borrower-mobile.html`.
- Palette swatch: `docs/design/NdalamaHub_Colour_Palette_v2.png`.

---

# Part A — Design system

## 1. Design principles

1. **Shared DNA, distinct registers.** Every screen is recognizably NdalamaHub — same palette, type, corner radii, spacing rhythm — but the three audiences below get different densities and moods. Don't force one visual treatment across all of them.
2. **Platform reusability.** Nothing in this system references Manifi specifically. Tenant branding (if ever supported) is a future config layer, not a fork of these tokens.
3. **Not a template.** The accent color was deliberately chosen to avoid the red-orange (~hue 0–20°) band that most AI-generated dashboards default to. Don't drift back toward it when generating new assets — see Section 3.
4. **Zambia-aware.** Borrower-facing screens assume mobile, variable connectivity, and mobile money familiarity. Favor big legible numbers, minimal chrome, and layouts that survive a small Android screen over desktop-first patterns.
5. **Flat over decorative.** No gradients, no heavy shadows, no glow. Corner radius and color tinting carry the personality, not effects.

## 2. The three registers

| Register | Who | Devices | Reference |
|---|---|---|---|
| **Admin (light)** | `lender_admin`, `lender_officer`, `employer_admin`, `employer_hr` | Desktop-first, responsive | `docs/design/mockups/dashboard-lender-admin.html` — sidebar nav, tinted KPI cards, dense but approachable |
| **Platform (dark)** | `platform_admin` | Desktop-first | `docs/design/mockups/dashboard-platform-admin-dark.html` — charcoal control-room, restrained, no glow. **Post-demo** (see §12); platform_admin uses the light admin register until then. |
| **Consumer (mobile)** | `borrower` | Mobile-first | `docs/design/mockups/borrower-mobile.html` — big numbers, minimal chrome, bottom nav, large tap targets |

All three consume the same token set — only surface, density, and component choices differ.

## 3. Color

### 3.1 Brand palette

| Token | Hex | Role |
|---|---|---|
| `--nh-charcoal` | `#1C1C1C` | Primary text (light mode), primary surface (dark mode) |
| `--nh-sage` | `#CCDAD1` | Neutral tint — active nav states, quiet secondary surfaces |
| `--nh-periwinkle` | `#7E78D2` | Secondary data-viz color, secondary accent |
| `--nh-mauve` | `#C492B1` | Tertiary accent — avatars, borrower-facing warmth |
| `--nh-accent` | `#D6295E` | **Primary accent.** Brand mark, primary CTA, single chart highlight, "new/attention" indicators. Magenta-crimson — deliberately not the orange-red cliché band. |

**Accent usage rule:** `--nh-accent` is reserved for one thing per view — the brand mark, or the one CTA that matters, or one highlighted data point. Never more than one large accent surface per screen; a needed second warm tint comes from a lighter accent stop or `--nh-mauve`, not a new hue.

### 3.2 Semantic status colors

Separate from the brand palette on purpose — status meaning must stay legible independent of brand refreshes, and `--nh-accent` must never be confused with an error state. Danger (`#A32D2D`, hue ~0°) is intentionally a different hue from the accent (`#D6295E`, hue ~345°).

| Role | Tint background | Text/icon |
|---|---|---|
| Success | `#EAF3DE` | `#3B6D11` |
| Warning | `#FAEEDA` | `#854F0B` |
| Danger | `#FCEBEB` | `#A32D2D` |
| Neutral/info | `#EFEDFB` (periwinkle tint) | `#26215C` |

**Loan status → pill mapping (canonical, use everywhere):**

| Status | Pill |
|---|---|
| `pending`, `pending_approval` | Warning |
| `approved` | Neutral/info |
| `disbursed`, `active` | Success |
| `in_arrears` | Warning |
| `defaulted` | Danger |
| `rejected` | Danger |
| `completed`, `waived`, `closed` | Gray neutral (`#F0F0EE` / `#5F5E5A`) |

Ticket statuses: `open` Neutral/info, `in_progress` Warning, `resolved` Success, `closed` gray. Company/user `Active` Success, `Inactive` gray (not danger — inactive is a state, not an alarm).

### 3.3 Light mode surfaces (admin + consumer registers)

| Token | Hex | Use |
|---|---|---|
| `--surface-page` | `#F4F7F5` | Page background |
| `--surface-card` | `#FFFFFF` / `#FAFAF8` | Cards / sidebar |
| `--surface-tint` | `#F4F7F5` | Metric card fill |
| `--text-primary` | `#1C1C1C` | Headings, primary values |
| `--text-secondary` | `#5F5E5A` | Labels, supporting text |
| `--text-muted` | `#8A8A88` | Placeholders, timestamps |
| `--border` | `#E4E4E1` | Hairline dividers |

KPI card tints (from the lender mockup): accent tint `#FCEAF0` (text `#7A1638`), periwinkle tint `#EFEDFB` (text `#26215C` / label `#3C3489`).

### 3.4 Dark mode surfaces (platform register — post-demo)

| Token | Hex | Use |
|---|---|---|
| `--surface-page` | `#1C1C1C` | Page background |
| `--surface-card` | `#242422` | Cards |
| `--surface-card-alt` | `#2E2320` | Flagged/critical card fill |
| `--text-primary` | `#FFFFFF` | Headings, primary values |
| `--text-secondary` | `#8A8A88` | Labels |
| `--border` | `#333331` | Hairline dividers |

Dark-mode data viz: `--nh-periwinkle`/`--nh-sage` for neutral series, `--nh-accent` only for the flagged/critical series.

## 4. Typography

- **UI text:** Inter — all chrome, labels, nav, body copy, buttons. Self-hosted via `@fontsource-variable/inter` (decision 2026-07-16: self-hosted over CDN, for performance and offline-safe demos).
- **Numeric/financial data:** IBM Plex Mono (`@fontsource/ibm-plex-mono`, weights 400/500), tabular figures — loan amounts, percentages, loan IDs, dates in tables. The system's signature move.
- No serif anywhere.

| Style | Size | Weight |
|---|---|---|
| Page heading | 22px | 500 |
| Card heading | 16px | 500 |
| Body | 14px | 400 |
| Label / caption | 12px | 400 |
| Metric value (large) | 19–28px | 500, Plex Mono |
| Metric value (mobile, borrower) | 32–40px | 500, Plex Mono |

Two weights only: 400 and 500. **No bold (700)** — it reads heavy against this palette. (The existing client uses `font-bold` everywhere; UI phases replace it with `font-medium` as they touch each surface.)

## 5. Spacing, radius, elevation

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40px.
- **Corner radius:** 8px small controls, 12–14px metric cards, 16px containers/panels, full pill (20px+) for status badges and nav highlights. No sharp corners.
- **Elevation:** flat by default — 0.5px hairline borders instead of shadows. Shadow only for true overlays (modals, popovers), never for in-flow cards. Remove existing `shadow-lg` from cards as surfaces are restyled.
- No single-sided border accents with rounded corners.

## 6. Components

- **Buttons:** Primary = `--nh-accent` fill, white text, **one per view maximum**. Secondary = transparent fill, `--border` outline, `--text-primary`. Sentence case, verb-first labels ("Approve application", "Record repayment").
- **Metric cards:** `--surface-tint` or brand-tint background, 12–14px radius, no border, no shadow. 12px label above (`--text-secondary`), Plex Mono value below. Tint signals *category*, not status; accent tint at most once per grid for the one metric that should draw the eye.
- **Status badges/pills:** full pill radius, semantic tint + matching dark text (§3.2). Never brand-accent colored. Never color-only — always paired with the status word.
- **Nav (admin light):** left sidebar ~200–220px, `#FAFAF8`, hairline right border. Active item: `--nh-sage` fill, 10px radius pill, weight 500. Brand lockup at top.
- **Nav (consumer mobile):** bottom tab bar, 3–5 items, icon + label, ≥44×44px targets, active state = `--nh-accent` icon/label color only (no filled background).
- **Charts:** bar/line only, flat fills. **No fake/sample data ever** (decision 2026-07-16: a chart renders real API data or doesn't render).
- **Tables/lists:** row-based, hairline dividers, no zebra striping. Numeric columns right-aligned, Plex Mono. On mobile, tables collapse to card lists (existing pattern, kept).
- **Forms:** existing controlled-input approach retained for the demo runway; new inputs use the shadcn primitives (`input`, `select`, `label`, `textarea`) so tokens apply. RHF+Zod adoption is post-demo (§12).
- **Feedback:** `sonner` toasts (mounted once in the app layout) for mutation success/error. No `alert()`; `window.confirm` survives the demo runway but is on the punch list.

## 7. Register specifics

- **Admin (light):** sidebar + content, 4-column KPI grid, two-column card row below (breakdown + list/actions), 12–16px minimum padding inside cards. Content area max-width ~1180px.
- **Platform (dark):** same structural grid, charcoal surfaces, accent reserved for flags/alerts. Post-demo.
- **Consumer (mobile):** single column, one hero number at top (large Plex Mono), a few large-tap-target cards, bottom nav, no dense tables — repayment history is a scrollable list.

## 8. Accessibility

- Status is never color-only — always pair the pill with its text.
- Minimum 44×44px tap targets on borrower/mobile screens.
- Text on a tint background uses the darkest matching stop from the same family — never plain black/gray on a tint.
- `--nh-accent` is tuned for large text, icons, and fills; verify 4.5:1 before using it for body-sized text.

## 9. Brand assets (supersedes the old "logo doesn't exist" note)

The logo exists — final v2 set, validated 2026-07-12, vendored at `client/public/brand/`. Usage:

- **Sidebar/app header:** `svg/NdalamaHub-lockup-horizontal-light.svg` (dark variant reserved for the post-demo dark register).
- **Login page:** stacked lockup or horizontal lockup, centered.
- **Favicon/tab:** `raster/favicon.ico` + `svg/NdalamaHub-icon-favicon.svg`; `raster/apple-touch-icon.png`. PWA icons exist but a manifest is post-demo.
- **Known limitation:** lockup text is live Inter `<text>`, fine in-app once Inter is loaded (Phase 12 does this); outlining is only needed for standalone/print/social use (punch list).

---

# Part B — Build specification (2026-07-16 planning session)

## 10. Screen inventory and target state

Roles: `platform_admin` (PA), `lender_admin` (LA), `lender_officer` (LO), `employer_admin` (EA), `employer_hr` (HR), `borrower` (B).

| Route | Screen | Visible to (nav) | Demo-critical | Restyle phase |
|---|---|---|---|---|
| `/login` | Login | public | **Yes** (demo opens here) | 12 |
| `/dashboard` | Role dashboards (PA/LA+LO/EA+HR/B variants) | all | **Yes** (LA, EA/HR, B variants) | 13 (B polished further in 16) |
| `/loans` | Loans list + detail + lifecycle actions | all | **Yes** — demo centerpiece | 14 |
| — | Apply flow (ProductBasedLoanForm), repayment/prepayment/history dialogs | B applies; LA/LO record | **Yes** | 15 |
| `/products` | Products + create/edit | PA, LA, LO | **Yes** | 15 |
| `/companies` | Companies + create/edit | PA, LA, EA | Yes (borrower-setup flow starts here) | 17 |
| `/reports` | Reports + report modal | PA, LA, EA, HR | **Yes** | 17 |
| `/settings` | Settings (User Mgmt, Company, System, Billing) | PA, LA, LO, EA, HR | Yes (User Management = borrower setup) | 17 |
| `/support` | Support tickets | all | Yes (brief) | 17 (light touch — already clean) |
| `/account-locked` | Subscription lock page | public | No (not shown in demo) | 16 (token alignment only) |
| `/users` | Orphaned read-only users list (no nav link) | — | No | **Removed in 17** (Settings → User Management is canonical) |

Nav structure (AppLayout, Phase 12): Dashboard, Loans, Companies (PA/LA/EA), Products (PA/LA/LO), Reports (PA/LA/EA/HR), Settings (all but B), Support. Borrower mobile bottom nav: Dashboard, Loans, Support.

## 11. Demo scope and phase plan

Demo: end-to-end lender walkthrough for Manifi — create a borrower, receive a loan application, approve (employer side), disburse, record repayment, show arrears visibility, generate reports, raise a ticket. Runway: **6 sessions**, one phase each.

| Phase | Document | One-line scope |
|---|---|---|
| 12 | `docs/12-ui-foundation-shell.md` | Functional hotfixes; tokens, fonts, brand; AppLayout + sidebar + borrower bottom nav (kills the 8-block duplication); login restyle; toasts; dead-file cleanup; hide Settings stubs; Vitest setup |
| 13 | `docs/13-ui-dashboards.md` | Dashboard split into per-role components; MetricCard; arrears presentation; lender_officer gets the lender dashboard; sample chart removed |
| 14 | `docs/14-ui-loans-workflow.md` | Loans list, filters, loan detail, approve/reject/disburse — the demo centerpiece |
| 15 | `docs/15-ui-loan-forms-repayments-products.md` | Apply flow, repayment/prepayment/history dialogs, Products page + dialogs, term-unit display |
| 16 | `docs/16-ui-borrower-mobile.md` | Consumer register: borrower dashboard hero, mobile loans, apply-on-mobile QA, banner/lock page alignment |
| 17 | `docs/17-ui-admin-surfaces-demo-polish.md` | Companies, Settings, Reports, Support restyle; `/users` removal; empty/loading states; scripted demo dress rehearsal |
| 18 | `docs/18-post-demo-ui-punchlist.md` | Post-demo backlog (not a build session; see §12) |

**Arrears presentation (locked):** `activeLoans` stays strictly `status === 'active'`. Lender dashboard gets an "Overdue" KPI (in_arrears + defaulted counts) and `in_arrears`/`defaulted` rows in the status breakdown; employer/HR dashboard gets the breakdown rows (no top-level KPI). Pills per §3.2.

## 12. Deferred / post-demo decisions log (fix after demo — do not lose these)

1. **Dark platform register** — full `platform_admin` control-room theme (mockup exists). PA uses light register until then.
2. **Settings stub tabs** (Security, Notifications, Integrations) — removed in Phase 12; they were local-state placeholders with dead Save buttons. Rebuild only with real server backing (server work → its own phase).
3. **Client dep-audit leftovers** — transitive dev-build-tool findings (`rollup`, `picomatch`, `postcss`, `esbuild`, `form-data`); don't ship to the browser. Deferred to the Coolify migration runbook.
4. **Auth screens** — no forgot-password/refresh UI is built; auth migration (CLAUDE.md §8) is pending. UI phases must not design auth UI beyond restyling the existing login form.
5. **Charts** — no trend endpoints exist; charts return when a real endpoint does (server work → flag, don't build).
6. **`window.confirm` → styled confirm dialogs**; **RHF+Zod adoption**; **sonner everywhere** (adopted progressively from Phase 12, sweep later); **PWA manifest** (icons ready); **wordmark text→outline conversion**; **accessibility audit** (§8 spot-checks happen per phase; a full pass is post-demo).
7. **`/users` page removed** (Phase 17) — revisit only if a dedicated cross-company user directory is wanted later.

## 13. Engineering conventions for UI phases

- **Zero server changes.** `git diff --stat main -- server/` must be empty at every phase merge. A UI phase that needs a server change stops and flags it. Gate: `cd server && pnpm test` → **261/261** before merge.
- **Client gates per phase:** `pnpm lint`, `pnpm build`, `pnpm test` (from Phase 12 onward) all green.
- **Stack is fixed:** React 19, Vite 7, Tailwind 4, shadcn/ui, TanStack Query, React Router 7, pnpm 10.12.1. No new UI/component libraries. New shadcn-style primitives may be added under `components/ui/` following the existing file conventions.
- **Data fetching:** surfaces being restyled convert to TanStack Query *when their phase doc says so* (dashboards and loans do); untouched surfaces keep raw axios until their phase.
- **Formatting utilities** (`client/src/lib/format.js`, built Phase 12): `formatCurrency` (K-prefixed Kwacha), `formatDate`, `formatTerm(term, termUnit)` — no more hardcoded "months" or ad-hoc `toLocaleString` calls in restyled code.
- **Role gating stays in `roleUtils.js`** — no new inline role arrays in components; extend roleUtils if a new check is needed.
- **Follow the mockups for layout questions** the spec text doesn't answer; if mockup and spec text conflict, spec text wins, flag the conflict.

## 14. Testing approach (deliberately minimal for the demo runway)

- **Framework:** Vitest + React Testing Library + jsdom, set up once in Phase 12 (`pnpm test` = `vitest run`). Vite-native; respects the `@` alias.
- **Scope:** smoke/behavior tests only — the shared layout renders the right nav per role, unauthenticated users redirect, format utilities, status-pill mapping, and per-phase render tests for touched surfaces with the API module mocked (`vi.mock('@/utils/api')`). No coverage targets, no visual regression, no E2E until post-demo.
- **Auth in tests:** `getCurrentUser()` decodes a JWT from localStorage (checks `exp`), so tests use a `makeFakeToken(user)` helper (base64 header/payload with a future `exp`) plus a seeded `ndalamahub-user` — provided in `src/test/utils.jsx` (Phase 12).
- The server suite (261 tests) remains the primary regression gate and is never touched by UI phases.

## 15. Change log

- **2026-07-16** — adopted as `docs/UI_SPEC.md`: design system (2026-07-11, direction locked) + logo reconciliation + Part B build spec. Decisions locked with William: self-hosted fonts; dark register post-demo; 6-session demo runway; arrears presentation; lender_officer shares the lender dashboard; no fake charts; stubs hidden; dead files deleted; minimal Vitest testing; dep findings deferred to Coolify runbook; sidebar layout lands with the Phase 12 shell.
- **2026-07-11** — original design system: direction locked (warm rounded light admin + dark control-room + consumer mobile); accent finalized `#D6295E` after rejecting terracotta and acid-lime.
