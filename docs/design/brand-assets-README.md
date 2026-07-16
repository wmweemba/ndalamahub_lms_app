# Brand assets — v2 (post-validation fixes)

Same locked mark and colors as the first round — nothing about the design changed. This pass fixed structural/sizing issues so the set is actually drop-in ready, and added the rasterized files no one had generated yet.

## What changed from round 1

1. **`NdalamaHub-lockup-stacked.svg` is now a true square** (`viewBox="0 0 320 320"`, was `320 280`). It was specified for square contexts (app icon, social profile photo) but shipped as an 8:7 rectangle — fixed by squaring the canvas and recentering, not by redesigning anything.
2. **Every SVG now has explicit `width`/`height` attributes matching its `viewBox`.** Previously viewBox-only, which is fine once inlined with CSS controlling size, but renders inconsistently if ever dropped in as a bare `<img src="...">`.
3. **The icon inside every lockup is now a flattened `<g transform="translate() scale()">`** instead of a nested `<svg>` element. Same pixels, more robust across tools/parsers/optimizers.
4. **New: actual deployable raster files**, derived directly from the locked source SVGs (never redrawn):
   - `favicon.ico` — 16/32/48px, multi-resolution, from `NdalamaHub-icon-favicon.svg`
   - `apple-touch-icon.png` — 180×180, from the full-detail icon (plenty of room at that size)
   - `pwa-icon-192.png`, `pwa-icon-512.png` — transparent background, "any" purpose
   - `pwa-icon-maskable-512.png` — solid charcoal (`#1C1C1C`) background, white/accent icon scaled to sit inside the safe zone. **This one made a stylistic call that wasn't in the original brief** — a dark tile rather than a light one, since maskable icons need a solid fill and this echoes the existing dark-mode/platform-admin register rather than inventing a new color. Swap the background if you'd rather it match the light register instead.

## Still outstanding (unchanged from round 1's README)

The `dalamaHub` portion of every lockup and the wordmark-only file is still live `<text>` (Inter, 500), not converted to path outlines. Fine anywhere Inter is loaded (this app). Needs outlining before any standalone/print/social use — no font-to-path tool available in this environment either; still a follow-up, not solved here.

## Drop-in snippets

**HTML head:**
```html
<link rel="icon" href="/brand/raster/favicon.ico" sizes="any">
<link rel="icon" href="/brand/svg/NdalamaHub-icon-favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/brand/raster/apple-touch-icon.png">
```

**PWA manifest.json:**
```json
"icons": [
  { "src": "/brand/raster/pwa-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/brand/raster/pwa-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/brand/raster/pwa-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
