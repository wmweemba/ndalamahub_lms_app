# Auth Panel — Image Brief & Swap Instructions

**Purpose:** the auth screens' left panel is built as a **slot**. Today it holds a
code-generated SVG derived from the NdalamaHub mark. This document is what you need to
replace it with a photograph, marketing content, or per-tenant art — without touching the
layout.

**Written:** 2026-07-30, when the auth screens were redesigned.
**Slot location:** `client/src/components/auth/AuthLayout.jsx`, the block marked `── SLOT`.

---

## 1. What the slot is

```
<div className="auth-panel-wrap">      ← owns rounded corners (do not change)
  <section className="auth-panel">     ← owns the diagonal clip (do not change)
    <PanelArt />                       ← REPLACE THIS
    <div className="auth-panel-top">   ← lockup, keep
    <div className="auth-panel-bottom">← headline + copy, keep or replace
```

`auth-panel-wrap` and `auth-panel` must stay as they are: `clip-path` overrides
`border-radius`, so the rounded corners and the diagonal edge have to live on two separate
elements. Collapsing them into one breaks the shape.

Everything inside is free.

---

## 2. Image specification

| Property | Requirement |
|---|---|
| **Aspect ratio** | Portrait, roughly **3:4** (the panel is ~560×720 at desktop) |
| **Minimum size** | 1120×1440 (2× for retina) |
| **Format** | **WebP**, quality 80–85. AVIF is fine too if you also ship a WebP fallback |
| **File size** | **Under 180KB.** This is the login page — the first thing every user downloads, often on Zambian mobile data |
| **Tone** | Dark. The panel ground is `#1C1C1C`–`#2E2E2E`; a bright image will fight the white card and the lockup |
| **Safe zones** | Keep the **top-left** clear (lockup) and the **bottom-left third** clear (headline + copy). Both sit over the image |
| **Right edge** | The panel is clipped diagonally — the bottom-right ~12% is cut off. Put nothing important there |

### Subject guidance

**Good:** Lusaka architecture, textures, abstract macro detail, dusk/night cityscapes,
material close-ups (concrete, timber, fabric). Anything that reads as *considered* without
demanding attention.

**Avoid — and this matters more than it sounds:**

- **AI-generated people.** This is a licensed lender's login screen. Uncanny-valley faces
  on a financial product actively cost trust, and generic "African business people" stock
  reads as inauthentic to a Zambian client faster than to anyone else. If you want people,
  commission or license real photography.
- **Anything busy behind the text.** The headline and copy sit directly on the image.
- **Bright or high-contrast imagery.** The white lockup will disappear against it.

If using a photograph, add a scrim so the text stays legible:

```css
/* in index.css, inside the auth block */
.auth-panel::after{
  content:''; position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(18,18,18,.55) 0%, rgba(18,18,18,.15) 45%, rgba(18,18,18,.82) 100%);
}
```

Check contrast against UI_SPEC §8 once the scrim is in — the copy is
`rgba(204,218,209,.8)`, which needs a genuinely dark backdrop.

---

## 3. How to swap it

1. Put the file at `client/public/brand/auth/panel.webp`.
2. In `AuthLayout.jsx`, replace `<PanelArt />` with:
   ```jsx
   <img className="auth-panel-image" src="/brand/auth/panel.webp" alt="" aria-hidden="true" />
   ```
3. Add to `index.css` inside the auth block:
   ```css
   .auth-panel-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
   ```
4. Delete the `PanelArt` function if nothing else uses it.
5. Mobile already hides the panel art (`.auth-panel svg` is `display:none` under 860px) —
   **update that selector to also hide `.auth-panel-image`**, or the image will load on
   phones for nothing. This is the easiest step to forget and the most expensive to miss.

`BleedArt` (the page-wide background graph) is separate. Keep it, or remove it and let the
bleed be a flat dark region — it will still read correctly.

---

## 4. Using the slot for marketing content instead

The original intent was a marketing/landing panel. For that, replace the
`auth-panel-bottom` contents rather than the art, and consider raising the panel's share of
the card (`grid-template-columns` on `.auth-card`, currently `1fr 1fr`).

Constraint worth remembering: **below 860px the panel collapses to a 190px band and its
copy is hidden.** Any marketing message placed here is desktop and tablet-landscape only.
If the message must reach phone users, it belongs above the form, not in the panel.

---

## 5. Per-tenant branding

UI_SPEC §1.2 anticipates a tenant config layer, and punch-list item 14 tracks it. This slot
is the natural place for per-lender identity when lender #2 arrives.

Do it as **configuration, not a fork**: the panel image path and headline become tenant
fields, resolved at render. Do not create a second AuthLayout. The whole reason the panel
was built as a slot is so that day needs a data change, not a layout change.
