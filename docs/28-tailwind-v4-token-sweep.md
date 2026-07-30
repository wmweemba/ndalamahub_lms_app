# Phase 28 — Tailwind v4 dead-token sweep

**Status: EXECUTED and verified 2026-07-30.** 38 occurrences converted across 5 files
(AppLayout 30, CustomersPage 3, SettingsPage 2, SystemSettings 2, ProtectedRoute 1). §4.1
gate empty, §4.2 confirms `var()`, lint 0 errors, build clean, client suite 77/77 across
20/20 files, sidebar nav visually confirmed. Every token had a `--color-*` entry, so no
`bg-(--token)` fallback was needed. Kept as the record of what was done and why.
*(Note: the per-file table in §1 below said AppLayout=31; the true count is 30. The §4.1
gate is what proves completeness, not the count.)*

**Original status:** ready to execute. Client-only. No server change.
**Written:** 2026-07-30. **Executor:** Sonnet.
**Scope:** 38 occurrences across 5 files. Mechanical class renames — no logic, no new deps.

---

## 0. What you are fixing and why it matters

Tailwind **v3** supported `bg-[--primary]` as shorthand for `bg-[var(--primary)]`.
Tailwind **v4 removed it.** It raises no error — it emits invalid CSS:

```css
.bg-\[--nh-sage\]{background-color:--nh-sage}   /* no var() — the browser drops this */
```

`pnpm lint` passes. `pnpm build` passes. Nothing reports a problem. The auth screens were
already converted on 2026-07-30 (commit `0ee6cfe`); these five files were deliberately left
out to keep that change scoped.

Full background: `docs/UI_SPEC.md` §13, `CLAUDE.md` §9, and second brain
`systems/NS-010-tailwind-v4-token-shorthand-gotcha.md`.

### The actual user-facing impact — read this, it is not what it looks like

Do **not** assume every dead rule is a visible bug. They were audited individually:

| Dead rule | Real impact |
|---|---|
| `bg-[--nh-sage]` on the **active** nav item (`AppLayout.jsx:84`) | **The real bug.** The active nav item loses its sage tint entirely. The only remaining active indicator is `font-medium`. |
| `text-[--sidebar-foreground]` on **inactive** nav items (×8) | Inactive items inherit `--foreground` `#1C1C1C` instead of `#5F5E5A`, so they render as dark as the active item — compounding the above. |
| `hover:bg-[--nh-sage]/40` on nav | No hover feedback on the primary navigation. |
| `bg-[--sidebar]` (×4) | **Effectively invisible.** `--sidebar` is `#FAFAF8`, the page `--background` it falls back to is `#F4F7F5`. A 4-unit difference. |
| `border-[--sidebar-border]` (×6) | **No impact at all.** `@layer base` applies `border-border` to every element, and `--border` and `--sidebar-border` are *both* `#E4E4E1`. It renders correctly by coincidence. |
| `bg-[--nh-sage]` / `bg-[--nh-accent]` in Customers + Settings | Missing tints on badges/status chips. Cosmetic but real. |
| `text-[--nh-periwinkle]` in SystemSettings | Text falls back to inherited colour. Cosmetic. |

**Net:** taken together, the active and inactive sidebar nav items are nearly
indistinguishable — a user cannot easily tell which page they are on, and gets no hover
feedback. That is a usability bug in the primary navigation, and it is the reason this is
being fixed during launch week. UI_SPEC §3.1 explicitly reserves sage for "active nav states".

The sidebar background and borders are *not* the problem, despite appearances. Do not
report them as fixed visual bugs — they were never visibly broken.

---

## 1. Files and occurrence counts

| File | Occurrences |
|---|---|
| `client/src/components/layout/AppLayout.jsx` | 31 |
| `client/src/pages/settings/SettingsPage.jsx` | 2 |
| `client/src/pages/customers/CustomersPage.jsx` | 3 |
| `client/src/components/settings/SystemSettings.jsx` | 2 |
| `client/src/components/ProtectedRoute.jsx` | 1 |

List them yourself before starting, don't trust this table blindly:

```bash
cd client && grep -rn -o '[a-z:-]*-\[--[a-z-]*\]' src | sort
```

---

## 2. The conversion

`client/src/index.css` has an `@theme inline` block mapping every token to a Tailwind
colour (`--color-nh-sage: var(--nh-sage)`, etc.). Where that mapping exists, the plain
utility name is the correct fix:

| Broken | Correct |
|---|---|
| `bg-[--nh-sage]` | `bg-nh-sage` |
| `bg-[--nh-accent]` | `bg-nh-accent` |
| `bg-[--sidebar]` | `bg-sidebar` |
| `bg-[--background]` | `bg-background` |
| `text-[--sidebar-foreground]` | `text-sidebar-foreground` |
| `text-[--foreground]` | `text-foreground` |
| `text-[--muted-foreground]` | `text-muted-foreground` |
| `text-[--nh-accent]` | `text-nh-accent` |
| `text-[--nh-periwinkle]` | `text-nh-periwinkle` |
| `border-[--sidebar-border]` | `border-sidebar-border` |

Variant prefixes carry over unchanged: `hover:bg-[--nh-sage]` → `hover:bg-nh-sage`.
Opacity modifiers carry over too: `hover:bg-[--nh-sage]/40` → `hover:bg-nh-sage/40`.

### Mandatory check before converting each token

**Verify the token has a `--color-*` entry in `@theme inline`.** If it does not, the plain
utility will not exist and you will have swapped one dead class for another — a silent
regression identical to the one you are fixing.

```bash
grep -n 'color-' client/src/index.css
```

If a token has **no** `--color-*` entry, use `bg-(--token)` (v4's shorthand) or
`bg-[var(--token)]` instead. Both are valid v4. Say in your report which tokens, if any,
needed this.

A regex sweep is fine, but run the check above first and eyeball the diff afterwards.

---

## 3. Do not change anything else

- No logic changes, no refactors, no "while I'm here" tidying.
- Do not touch `client/src/components/auth/*` or `client/src/pages/auth/*` — already done.
- Do not touch the `@theme inline` block or any token value.
- No server changes. `git diff --stat main -- server/` must come back empty.
- Do not reformat files. The diff should be class strings only.

---

## 4. Verification — in this order

### 4.1 Objective: zero dead rules in the built CSS

This is the gate. It needs no login and cannot be fooled.

```bash
cd client && pnpm build
grep -oE '\.[a-z-]+-\\\[--[a-z-]+\\\]\{[^}]*\}' dist/assets/*.css | grep -v 'var('
```

**Must return nothing.** Before your change it returns 10 rules.

### 4.2 Confirm the fix actually took effect

```bash
grep -o '\.bg-nh-sage{[^}]*}' dist/assets/*.css
# expect: .bg-nh-sage{background-color:var(--nh-sage)}
```

A rule containing `var(` is correct. A rule without it is still broken.

### 4.3 Standard gates

```bash
cd client && pnpm lint     # 0 errors; 4 pre-existing warnings are expected and fine
pnpm build                 # clean
pnpm test                  # 77/77 across 20/20 files
```

Note: `pnpm lint` and `pnpm build` **passed while the bug was present**. They are
regression gates here, not evidence the fix worked. §4.1 is the evidence.

### 4.4 Visual — the sidebar nav

The whole point of this change is the sidebar active state, so confirm it visually.
This needs a logged-in session against the dev environment.

```bash
cd client && pnpm exec vite preview --port 8913
```

Check, on any authenticated page:
- The **active** nav item has a visible sage background tint
- **Inactive** nav items are visibly lighter/greyer than the active one
- Hovering an inactive nav item shows a soft sage tint
- Customers and Settings pages: badge/status tints render

If you cannot log in, say so plainly in your report and mark §4.4 as unverified rather
than assuming. §4.1 still proves the CSS is correct.

### 4.5 Dark mode

`--sidebar`, `--sidebar-foreground` and `--sidebar-border` all have `.dark` overrides
(`index.css` lines ~128–134). The theme utilities resolve `var()` at runtime, so dark mode
should follow automatically — but confirm nothing hardcoded slipped in.

---

## 5. Report back with

1. Occurrences converted, per file.
2. **Any token that had no `--color-*` entry** and what you used instead.
3. §4.1 output — must be empty. Paste it.
4. §4.2 output showing `var(` present.
5. Lint / build / test results.
6. §4.4 — verified with screenshots, or explicitly marked unverified and why.
7. Anything you chose **not** to change, and why.

Do **not** commit, push, or update documentation. Hand the report back — documentation
updates and the push are handled separately, and `UI_SPEC.md` §13, `CLAUDE.md` §9 and the
second brain's NS-010 all currently state that these files are still broken. Those
sentences need updating **after** the fix is confirmed, not by you.
