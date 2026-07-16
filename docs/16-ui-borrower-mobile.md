# Phase 16 — Borrower consumer register (mobile)

**Planned:** 2026-07-16 (Claude Code Fable). **Executes on:** `phase/16-ui-borrower-mobile`, branched from `main` (Phase 15 merged).
**Session size:** one 1.5–2h session.
**Read first:** `docs/UI_SPEC.md` §§2, 6 (consumer nav), 7 (consumer register), 8; `docs/design/mockups/borrower-mobile.html` — the reference render for everything in this phase.

## Objective

Give the borrower experience the full consumer-register treatment: hero-number dashboard, mobile-first loan views, apply-flow QA on a small viewport, and token alignment for the subscription banner and account-locked page. The demo shows a borrower applying for and tracking a loan — this phase is that story's screen.

## Ground rules

Zero server changes; server suite 261/261; client lint/build/test green; stop-and-flag. Everything verified at **375×812** (iPhone/small-Android class viewport) as well as desktop — the borrower register is mobile-first by principle (UI_SPEC §1.4). Tap targets ≥44×44px on all borrower-facing interactive elements.

## Steps

### Step 1 — BorrowerDashboard, consumer treatment

Rework `src/components/dashboard/BorrowerDashboard.jsx` (structurally ported in Phase 13) per the mockup:

- **Hero block** at top: the single most important number — next payment due (`userStats.nextPaymentDue.amount`) if one exists, else outstanding active amount — 32–40px Plex Mono weight 500, with a 12px label above ("Next payment · due {formatDate}") and the loan number below in `--text-muted`. Warning-tint background card if the due date is within 7 days, plain card otherwise.
- Below: single-column large-tap-target cards — Active loans summary (count + amount), most recent loan with StatusPill, and a "Apply for a loan" card (primary CTA — the view's one accent use) when eligible. Keep the existing no-loans welcome state, restyled flat (no gradients).
- Everything through `formatCurrency`/`formatDate`; generous whitespace (spec §7); no tables.

### Step 2 — Borrower loans experience on mobile

- The mobile card list on `/loans` (restyled in Phase 14) is the borrower's primary loans view — verify it at 375px: cards full-width, loan number Plex Mono, StatusPill, amount prominent; the filters card collapses sensibly (search + status stacked). Fix any overflow/cramping found.
- `LoanDetailsDialog` on mobile: ensure the dialog is scrollable and usable at 375px (max-height + internal scroll; shadcn dialog supports this — adjust classes only). Schedule table scrolls horizontally inside its own container rather than breaking the page.
- Apply flow (`ProductBasedLoanForm`, restyled Phase 15) at 375px: product cards stack, inputs and the submit button comfortably tappable, schedule preview scrolls. Fix layout issues found; no logic changes.

### Step 3 — Bottom nav polish

The borrower bottom tab bar shipped in Phase 12 — verify against the mockup and finish: 3 items (Dashboard, Loans, Support), icon + 12px label, active = `--nh-accent` icon/label color only, inactive `--text-muted`, `--surface-card` background with hairline top border, safe-area padding (`pb-[env(safe-area-inset-bottom)]`), content bottom padding so nothing is obscured. Desktop borrower keeps the reduced sidebar (Dashboard/Loans/Support) — verify Settings/Companies/Products/Reports never appear for a borrower.

### Step 4 — Subscription banner + account-locked page token alignment

- `SubscriptionBanner.jsx`: replace the default shadcn `Alert` variants with the semantic status tokens — `past_due` warning tint, `read_only` danger tint, trial-ending info tint. Copy and role-split logic unchanged (it's Phase 10 behavior, tested server-side).
- `AccountLockedPage.jsx`: token restyle (background, card radius, brand icon at top — `NdalamaHub-icon.svg`), primary "Contact support", secondary "Back to login". Copy unchanged.

### Step 5 — Tests

- BorrowerDashboard with a fixture `nextPaymentDue` renders the hero amount (Plex Mono class) and label; without loans renders the welcome state with one primary CTA.
- Bottom nav renders exactly Dashboard/Loans/Support for a seeded borrower; Settings absent.
- SubscriptionBanner fixture for `read_only` renders danger-token classes and the employer-side copy for a borrower user.

## Acceptance criteria

1. Borrower walkthrough at 375px against local dev (Atlas): log in as a seed borrower → hero dashboard → apply for a loan → view it in the loans list → open detail — no horizontal page scroll, no sub-44px targets, bottom nav present throughout.
2. Desktop borrower unaffected functionally; reduced sidebar verified.
3. Banner/lock page match the semantic tokens; no default-blue/orange Tailwind classes remain in the four touched surfaces.
4. Gates: server 261/261 untouched, client lint/build/test green.

## Close-out

Update CLAUDE.md (Section 2; Section 3 test count) and `changelog.md`; merge → `main`, push, delete branch.
