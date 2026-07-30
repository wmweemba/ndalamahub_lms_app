# PWA Implementation Plan — NdalamaHub

**Status:** Phase A approved for implementation. **Phase B is BLOCKED** — do not start it
until the gate in §4 is satisfied.
**Written:** 2026-07-29, launch week (Manifi go-live ~1 Aug).
**Audience:** an implementing agent (Sonnet) or developer picking this up cold.

---

## 0. Read this before touching anything

This app is **days from its first commercial launch** with a real paying client (Manifi,
ZMW 300/mo) and real loan data in production. Production was deliberately cleared to
contain exactly Manifi + its product + zero test residue. Launch-smoke testing is
in progress and only the reports/exports check remains before go/no-go.

That context sets the rule for this whole document:

> **Nothing in Phase A may alter application behaviour, routing, auth, or the build
> pipeline. Phase B does alter runtime behaviour and must not ship during launch week.**

If you find yourself adding a dependency, changing `vite.config.js`, or touching anything
under `client/src/` during Phase A, stop — you have left the plan.

---

## 1. What was audited and what is actually true

Verified directly against the repo:

| Claim | Verified |
|---|---|
| React 19 + Vite 7 client-only SPA, build → `client/dist` | ✓ |
| `client/public/brand/raster/pwa-icon-192.png` — 192×192 | ✓ exists, correct |
| `pwa-icon-512.png` — 512×512 | ✓ exists, correct |
| `pwa-icon-maskable-512.png` — 512×512, art inside safe zone | ✓ exists, correct — full-bleed dark ground, mark occupies ~29–70% of canvas, comfortably inside the 80% safe circle |
| `apple-touch-icon.png` — 180×180, opaque | ✓ exists, correct, already linked at `client/index.html:6` |
| Safe-area inset handling on mobile tab bar | ✓ `client/src/components/layout/AppLayout.jsx:220` |
| No manifest, no `<link rel="manifest">`, no service worker, no `vite-plugin-pwa` | ✓ confirmed absent |
| `viewport` meta present but missing `viewport-fit=cover` | ✓ `client/index.html:5` |

**Someone prepped a complete, correct icon set and never wired it up.** Phase A is mostly
just connecting assets that already exist.

---

## 2. Four findings that change the plan

### 2.1 The API is on a different origin — "exclude `/api/*`" is a no-op

Production topology (`docs/PRODUCTION_RUNBOOK.md` §1):

- Client: `https://ndalamahub.nxhub.online`
- API: `https://api.ndalamahub.nxhub.online/api` (via `VITE_API_URL`, baked in at build)

There is **no `/api/*` path on the client origin.** A Workbox `runtimeCaching` rule
excluding `/api/*`, or a `navigateFallbackDenylist` of `[/^\/api/]`, matches nothing. It
would look like a safety measure in review while providing zero protection.

The correct control is the inverse: **the service worker must ignore every cross-origin
request outright**, and no `runtimeCaching` entry may reference the API host. See §5.

This matters because auth is a server-side httpOnly session cookie. Caching any
authenticated API response would leak one user's loan data to the next user of a shared
device — and shared phones are normal for this user base.

### 2.2 There is no way to set `Cache-Control` on `sw.js` in production — HARD BLOCKER

The client is served on Coolify as a **Nixpacks static build** (`pnpm build` in `client/`).
The repo contains **no** `Dockerfile`, `nginx.conf`, `Caddyfile`, `_headers`, or any other
header-control mechanism, and `client/package.json` has no `start` script. Header behaviour
is whatever the Nixpacks static provider defaults to, and it is not expressible in this repo.

`netlify.toml` likewise has no `[[headers]]` block — though Netlify at least *can* be fixed
from the repo.

A service worker whose `sw.js` is served with a long `Cache-Control` is **unrecoverable
from the server side**. The browser will not re-fetch it, so you cannot push a fix and you
cannot deploy the kill switch. Users stay on the broken version until the cache expires.

**This is the gate on Phase B.** Ship a service worker without solving this and you are
one bad deploy away from bricking the borrower app for its only paying client, with no
lever to pull.

### 2.3 The app cannot deliver meaningful offline value today — and shouldn't try

There is **no client-side persistence of API data**: no `persistQueryClient`, no
`localStorage` of query results, no IndexedDB. React Query is memory-only
(`client/src/main.jsx:21`, `staleTime: 30s`). On reload, every screen refetches from the network.

So a service worker would make the *shell* load offline, and every screen inside it would
show an empty or error state. "Check your loan balance offline" is not achievable without
building a data-caching layer.

**Do not build that layer.** Cached loan balances, repayment amounts, and due dates are
stale money data. A borrower acting on a stale balance — or disputing one — is a
materially worse outcome than an honest "you're offline" screen. The absence of
persistence here is a safety property, not a gap.

Phase B's real, honest benefit is narrower: instant repeat loads of the shell, and a
branded offline page instead of the browser's error page. That is worth having. It is not
worth rushing.

### 2.4 Route-level code splitting was added two commits ago — this raises SW update risk

Commit `8cb49ee` ("Route-level code splitting: lazy-load every page component") means the
app now fetches hashed JS chunks on navigation. Combined with a service worker this creates
the classic failure: a deploy replaces `dist/`, the old hashed chunks vanish from the
server, and a session holding the old shell requests a chunk that no longer exists →
`Failed to fetch dynamically imported module` → white screen mid-task.

Precaching actually *helps* here (the SW serves the old chunks from cache) — right up until
the new SW activates and purges the old precache under a running page. That is exactly what
`skipWaiting` does.

Therefore: **`registerType: 'prompt'` is mandatory, not a preference.** Never
`autoUpdate` on this app.

---

## 3. Phase A — safe now, including during launch week

Tier 1 installability only. No dependency, no build-config change, no `client/src/` change.
Static files and `<head>` tags only. Fully reversible by deleting two files' worth of diff.

**Deliberate divergence from the audit:** the audit proposed adding `vite-plugin-pwa`
up front. Do not. Tier 1 needs no plugin — a static manifest achieves the same result with
zero build-pipeline risk. Introduce the plugin only in Phase B, when a service worker is
actually being generated.

### A1 — Create `client/public/manifest.webmanifest`

```json
{
  "id": "/",
  "name": "NdalamaHub",
  "short_name": "NdalamaHub",
  "description": "Loan management for lenders and borrowers.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F4F7F5",
  "theme_color": "#F4F7F5",
  "prefer_related_applications": false,
  "icons": [
    { "src": "/brand/raster/pwa-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/brand/raster/pwa-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/brand/raster/pwa-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Notes:
- `id` is set explicitly and **must never change** — changing it later creates a second
  app identity and strands everyone who already installed.
- Relative icon paths keep one manifest working on both the Coolify and Netlify origins.
- `short_name` "NdalamaHub" is 10 characters — under the 12-char home-screen limit. ✓
- **`theme_color` is a design decision for William, not the implementer.** `#F4F7F5`
  matches `--background` (`client/src/index.css:63`) so the status bar blends with the app.
  The audit proposed `#1C1C1C`, which is `--foreground` and the maskable icon's ground —
  that would render a dark status bar above a light app. Defensible, but it is a visible
  choice; do not pick it silently. Ask.

### A2 — Update `client/index.html` `<head>`

Add the manifest link, theme-color metas, and Apple tags. **Modify** the existing viewport
line to add `viewport-fit=cover`; do not add a second viewport tag.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

<link rel="manifest" href="/manifest.webmanifest" />

<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F7F5" />
<meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#252525" />

<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="NdalamaHub" />
```

The dark value approximates `--background` in the dark theme
(`client/src/index.css:105`, `oklch(0.145 0 0)`). Convert it precisely if exactness matters.

**`viewport-fit=cover` is the one line in Phase A that can change visual layout.** It lets
content extend under the notch and home indicator. `AppLayout.jsx:220` already handles
`safe-area-inset-bottom`, so the bottom tab bar is covered — but check the **top** of the
app on a notched device. If any fixed header now sits under the status bar, add
`pt-[env(safe-area-inset-top)]` to it. If you cannot test on a notched device before
launch, **omit `viewport-fit=cover` from Phase A** and add it in Phase B; every other tag
above is inert and safe.

### A3 — Verify (see §6). Then stop.

Do not proceed to Phase B in the same change.

---

## 4. Phase B gate — all four must be true before writing any service worker code

1. **Manifi is live, launch-smoke is complete, and the app has been stable in production
   for at least one full week.** Not negotiable. Do not ship a service worker during or
   immediately after launch week.
2. **`Cache-Control: no-cache, no-store, must-revalidate` on `/sw.js` is confirmed on the
   Coolify production origin**, verified with `curl -sSI https://ndalamahub.nxhub.online/sw.js`.
   This requires solving §2.2 — likely a custom Caddyfile/start command for the Nixpacks
   static service, or moving the client to an explicit nginx container. **This is real
   infrastructure work and must be done first.** If it cannot be solved, Phase B is
   cancelled, not deferred — Phase A alone is a perfectly good outcome.
3. **The same header is configured for Netlify** via `[[headers]]` in `netlify.toml`.
4. **The kill switch is written, reviewed, and its deploy path rehearsed** before the real
   service worker ships.

---

## 5. Phase B — service worker (only after §4)

### B1 — Netlify headers (`netlify.toml`)

```toml
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
```

### B2 — Add `vite-plugin-pwa`

```bash
pnpm --filter ./client add -D vite-plugin-pwa
```

Move the manifest from the static file into the plugin config (delete
`client/public/manifest.webmanifest` to avoid two sources of truth), or keep the static
file and set `manifest: false`. Pick one and say which in the commit message.

```js
// client/vite.config.js
VitePWA({
  registerType: 'prompt',          // MANDATORY — see §2.4. Never 'autoUpdate'.
  injectRegister: 'auto',
  manifest: { /* contents of §A1 */ },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    // No runtimeCaching entry may reference api.ndalamahub.nxhub.online.
    // The API is cross-origin (§2.1); leaving runtimeCaching empty is correct
    // and is the safe default. Do not add rules "just in case".
    runtimeCaching: [],
  },
  devOptions: { enabled: false },   // never register a SW in dev
})
```

### B3 — Cross-origin guard

Workbox's generated SW will not intercept cross-origin requests it has no rule for, but
make the guarantee explicit rather than implicit. If a custom SW section is used, the first
lines of the `fetch` handler must be:

```js
if (request.method !== 'GET') return;
if (new URL(request.url).origin !== self.location.origin) return;   // never touch the API
```

**Never cache any response from `api.ndalamahub.nxhub.online`.** Session-cookie auth +
shared devices = one borrower's loan data served to the next.

### B4 — Update prompt

Use `virtual:pwa-register` with `onNeedRefresh` wired to a visible toast the user must
accept. Do not auto-reload. Reference: `scaffold/skills/skills/pwa/references/frameworks.md`
in the second brain.

### B5 — Offline fallback

A branded offline page. Given §2.3, its copy must be honest — "You're offline. NdalamaHub
needs a connection to show your loan details." Do not imply cached data is available.

### B6 — Kill switch, committed alongside

```js
// Emergency replacement for client/public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
```

Document the deploy procedure for it in `docs/PRODUCTION_RUNBOOK.md` §"Recovery procedures"
in the same PR. It only works if §4.2 is genuinely satisfied.

---

## 6. Verification

### After Phase A
```bash
# Local build serves the manifest
cd client && pnpm build && pnpm preview
curl -sSI http://localhost:4173/manifest.webmanifest
curl -o /dev/null -s -w '%{http_code}\n' http://localhost:4173/brand/raster/pwa-icon-192.png
curl -o /dev/null -s -w '%{http_code}\n' http://localhost:4173/brand/raster/pwa-icon-512.png
curl -o /dev/null -s -w '%{http_code}\n' http://localhost:4173/brand/raster/pwa-icon-maskable-512.png
```

```
□ DevTools → Application → Manifest: parses, no Installability errors
□ Maskable icon preview shows the mark fully inside the mask
□ Chrome desktop shows the address-bar install icon
□ Installed app opens at "/" with correct name and icon
□ Android: home screen icon is masked correctly, "NdalamaHub" not truncated
□ iOS: Share → Add to Home Screen; icon opaque; standalone launch correct
□ Login, borrower dashboard, and one loan flow still work exactly as before
□ If viewport-fit=cover was included: no header sits under the status bar on a notched device
```

Note: `client/` has a 77-test suite. Run `pnpm test` in `client/` — Phase A should not
change a single test result. If it does, something is wrong.

### After Phase B — additionally
```
□ curl -sSI <prod>/sw.js  → Cache-Control: no-cache present   ← blocking check
□ DevTools → Application → Service Workers: activated, no errors
□ Cache Storage contains ONLY build assets — zero entries from api.ndalamahub.nxhub.online
□ Offline: shell renders; a data screen shows the honest offline state, not stale figures
□ Deploy a visible change → update toast appears → accept → new version, no reload loop
□ Log out, then inspect Cache Storage — no authenticated payloads present
□ Navigate a lazy-loaded route after a deploy without accepting the update → no white screen
```

---

## 7. Explicitly not recommended

Web Push / VAPID, Badging, `share_target`, `file_handlers`, `protocol_handlers`,
Background Sync, Periodic Sync, `shortcuts`, and any client-side caching of loan data.

Push in particular would need its own design pass against the server-side session model,
and on iOS only works after home-screen install — a two-step funnel with heavy drop-off.
None of these serve a concrete NdalamaHub need today.

Screenshots for the richer install dialog are genuinely nice-to-have and can be added to
the manifest any time after launch, with no risk. They are the best next increment after
Phase A if you want more polish without touching a service worker.

---

## 8. Summary

| Phase | Contents | Risk | When |
|---|---|---|---|
| **A** | Manifest + `<head>` tags, using icons that already exist | Very low — no deps, no build change, no `src/` change | Safe now, launch week included |
| **B** | Service worker, offline page, update prompt, kill switch | High — can break the app for every returning user | **Blocked** until §4 is satisfied; not before Manifi is stable in production for a week |

Phase A gets NdalamaHub the home-screen icon, the splash screen, and the standalone launch —
which is what "make it an app" actually means to a borrower. Phase B adds fast repeat loads
and a proper offline page. Phase A carries almost none of the risk and delivers most of the
visible value. Ship it first, on its own.
