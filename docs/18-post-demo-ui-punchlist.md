# Phase 18 — Post-demo UI punch list

**Planned:** 2026-07-16 (Claude Code Fable). **Status: backlog, not a build session.** Nothing here blocks the Manifi demo. After the demo, William prioritizes this list with the planning agent and items get promoted into properly-scoped phase docs (some need server work and therefore cannot be UI-phase items).

This file exists so the deliberate scope cuts made during the demo runway (2026-07-16 planning session, recorded in `docs/UI_SPEC.md` §12) are never silently forgotten.

## Items

1. **Dark platform register** (`platform_admin` control room) — mockup exists (`docs/design/mockups/dashboard-platform-admin-dark.html`), tokens defined (UI_SPEC §3.4), `.dark` CSS block reserved. Scope: dark token values into `index.css`, register switch for platform_admin, dashboard + Billing surfaces first. Client-only.
2. **Settings stub tabs rebuilt for real** — Security, Notifications, Integrations were removed in Phase 12 (they were local-state fakes with dead Save buttons). Rebuilding any of them requires server-side settings storage and routes → needs its own full-stack phase doc; decide first whether they're even wanted (notification prefs may be the only real one — reminder emails exist since Phase 09).
3. **Report export wiring** — Phase 17 Step 3 determines whether client "Export" actually downloads the server's PDFKit/ExcelJS output or just re-views JSON. If unwired, wire real file downloads (likely client-only; server export endpoints exist per CLAUDE.md §3).
4. **`window.confirm` → styled confirm dialogs** (companies delete, products delete). Client-only, small.
5. **RHF + Zod adoption** for the big forms (product dialogs, user dialogs, apply flow) — deps already installed. Client-only, do per-form.
6. **Sonner sweep** — toasts adopted progressively from Phase 12; audit remaining silent `console.error` failure paths.
7. **Charts with real data** — no trend endpoints exist (the old sample chart was removed in Phase 13). Needs server aggregation endpoints → full-stack phase; follow UI_SPEC §6 chart rules when built.
8. **Auth screens** — forgot-password/reset UI (server endpoints exist since Phase 09), token refresh handling, and whatever the auth migration (CLAUDE.md §8) brings. Blocked on the auth-migration decision; do not build ahead of it.
9. **Accessibility pass** — full audit per UI_SPEC §8 (per-phase spot checks happened; contrast verification for accent-on-white body text, keyboard traversal of dialogs, focus states).
10. **PWA manifest** — icons are already in `client/public/brand/raster/`; add `manifest.json` + meta tags if an installable borrower experience is wanted.
11. **Wordmark outlining** — lockup SVGs use live Inter `<text>`; convert to paths before any standalone/print/social use (see `docs/design/brand-assets-README.md`).
12. **Client dep-audit leftovers** — transitive dev-build-tool findings (`rollup`, `picomatch`, `postcss`, `esbuild` via vite; `form-data` via axios). Deferred to the Coolify migration runbook (locked 2026-07-16); revisit with `pnpm audit` + `pnpm update` there.
13. **`/users` directory view** — removed in Phase 17 as an orphaned duplicate of Settings → User Management; revisit only if a cross-company user directory becomes a real need.
14. **Tenant branding config layer** — UI_SPEC §1.2's "future config layer" (per-lender logo/accent). Only when a second lender client makes it worth designing; must be configuration, not a token fork.
