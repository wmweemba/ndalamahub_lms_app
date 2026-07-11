# Phase 10 — Subscription & Trial Gating

**Prerequisite:** Phases 01–09 merged; suite green. Branch: `phase/10-subscription-gating` off `main`.

## Objective

Let Nexus commercially gate lender tenants: each **lender company** has a subscription (trial → active → suspended/expired), and when it lapses, that lender's entire tenant tree (lender staff, employer clients, borrowers) loses access to business routes — but **never** to auth or support routes, so they can still log in, see why they're locked out, and raise a ticket. Payment collection is **manual for now** (platform admin flips the state after an invoice is paid) — no Stripe/processor integration in this phase.

## Scope

- `server/models/Company.js` — subscription subdocument (lender companies only, by convention)
- New: `server/middleware/subscription.js`, `server/routes/subscriptions.js`, `server/utils/__tests__/subscriptionGate.test.js`
- `server/server.js` — apply gate middleware + mount admin routes
- `server/jobs/scheduler.js` + new `server/jobs/expireSubscriptions.js` — daily expiry sweep (+ reuse Phase 09 email for expiry warnings)
- Client (functional minimum): a lock-state banner/interstitial + a platform-admin subscription panel — see Step 6

**Out of scope:** payment processor integration, invoicing/receipts, plan/pricing tiers beyond a free-text `plan` label, per-seat billing, grace-period negotiation logic (fixed 7-day grace, below).

## Design decisions (flag to William before executing)

1. Subscription attaches to the **lender company** (the paying tenant). Employer companies and borrowers inherit their lender's state. Nexus's own platform admins are never gated.
2. **Amended with William before execution (2026-07-11):** the lifecycle has a fourth tier between the grace period and full lockout. `trialing` (default on lender creation, `trialEndsAt` = +30 days) → `active` (manual activation, `currentPeriodEnd` set) → `past_due` (period lapsed, 7-day grace, warning banner but fully functional) → `read_only` (a further 7-day grace: GET/HEAD only — dashboards, reports, exports all work; anything that creates/modifies is blocked with 402 — warning banner changes tone) → `suspended` (both graces exhausted, or manual — **fully locked out**) and `cancelled` (manual, terminal — fully locked out). All of this is *computed live from stored dates on every request* (see Step 3), not driven by the persisted `status` field, which the sweep (Step 5) merely keeps roughly in sync for the admin panel's benefit.
3. Locked-out scope: every `/api/*` route **except** `/api/auth/*`, `/api/tickets*`, `/api/health`, and the subscription-status read endpoint. This satisfies the roadmap's "trial gating must exclude support routes" requirement. During `read_only`, this same exempt list still fully applies, plus GET/HEAD is additionally allowed everywhere else.
4. **Banner wording is keyed off the logged-in user's own role, not the tenant**: `lender_admin`/`lender_officer` see payment-facing copy ("your organisation's subscription..."); `employer_admin`/`employer_hr`/`borrower` see a different message ("your lender's account...") since they aren't the ones who can pay the bill.

## Step-by-step instructions

### Step 1 — Schema

`server/models/Company.js`: add (top-level field):

```js
  subscription: {
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'suspended', 'cancelled'],
      default: 'trialing'
    },
    plan: { type: String, default: 'standard' },
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    suspendedAt: Date,
    notes: String // manual-billing bookkeeping, platform admin only
  },
```

Set `trialEndsAt` (+30 days) in the company-creation route **only when `type` is the lender type** (check the actual `Company.type` enum values in the model — the audit indicates `'corporate'` for employers; use the real lender value found there). Backfill existing lender companies via a one-off script `server/utils/migrations/backfillSubscriptions.js` (set Manifi to `active` with a far `currentPeriodEnd`, per William's instruction at deploy time).

### Step 2 — Resolve the paying lender for any user

In `server/middleware/subscription.js`, helper `payingLenderId(user)`: platform_admin → `null` (exempt); lender-side → `user.company`; employer-side/borrower → their company's `lenderCompany` (via the Phase 04 `companyLenderId`). Cache per-request only (no global cache in this phase — correctness first; note the extra query in the changelog as a known cost).

### Step 3 — Gate middleware

Same file:

```js
const EXEMPT_PREFIXES = ['/api/auth', '/api/tickets', '/api/health', '/api/subscriptions/status'];
const LOCKED_STATUSES = ['suspended', 'cancelled'];
```

`enforceSubscription` (mounted in `server.js` **after** `authenticateToken`-bearing routers can't work — so mount it as `app.use(enforceSubscription)` *before* the route mounts but have it skip when `req.path` matches an exempt prefix, and skip when there's no `Authorization` header at all, letting per-route auth 401 as usual; when a token is present, verify it with the same logic as `authenticateToken` and continue on verification failure — the route's own middleware will reject it). For an authenticated non-exempt request: resolve `payingLenderId`; load that company's `subscription`; if status ∈ `LOCKED_STATUSES` (or `trialing` with `trialEndsAt < now`, or `past_due` with `currentPeriodEnd + 7d < now` — compute, don't trust stale status), respond:

```js
    return res.status(402).json({
      success: false,
      code: 'SUBSCRIPTION_LOCKED',
      message: 'Your organisation\'s NdalamaHub subscription is inactive. Please contact support.',
      data: { status: effectiveStatus }
    });
```

(402 Payment Required — distinct from 401/403 so the client can render the lock screen specifically.)

### Step 4 — Admin + status routes (`server/routes/subscriptions.js`, mounted `/api/subscriptions`)

| Route | Who | Behavior |
|---|---|---|
| `GET /status` | any authenticated | own tenant's effective status + dates (exempt from the gate; this is what the client banner polls) |
| `GET /` | `platform_admin` | list lender companies + subscription fields |
| `PUT /:companyId` | `platform_admin` | set `{status, currentPeriodEnd?, trialEndsAt?, plan?, notes?}` with transition validation (e.g. anything → `active` requires `currentPeriodEnd`) |

### Step 5 — Expiry sweep + warnings

`server/jobs/expireSubscriptions.js` (daily 02:00, Phase 07 scheduler, `ENABLE_CRON` gate): move `trialing` past `trialEndsAt` → `past_due` (email lender_admins: trial ended, 7-day grace); `past_due` beyond grace → `suspended` + `suspendedAt` (email: suspended); `active` past `currentPeriodEnd` → `past_due` (email: renewal due). Reuse `sendEmail`/templates — add `subscriptionNotice(adminUser, company, kind)` to `emailTemplates.js`. Manual runner + `job:subscriptions` script, same pattern as before.

### Step 6 — Client functional minimum

- Axios/query layer: on any `402` with `code: 'SUBSCRIPTION_LOCKED'`, redirect to a new `/account-locked` page (plain Card: message + link to `/support`). Locate the shared axios instance/interceptor (grep `interceptors` in `client/src`) and add the handler there — one place.
- A slim `past_due` warning banner: `GET /api/subscriptions/status` once after login (TanStack Query, `staleTime` 1 h); render a dismissible alert strip using the existing `Alert` component when status is `past_due` or `trialing` within 7 days of end.
- Platform-admin panel: a table + edit dialog on the existing Settings page (visible only to `platform_admin` via `roleUtils`), driving `GET /api/subscriptions` and `PUT /api/subscriptions/:companyId`. Existing components only.

### Step 7 — Tests

`subscriptionGate.test.js`: suspended lender's `lender_admin` gets 402 on `GET /api/loans` but 200 on `GET /api/tickets` and `POST /api/auth/login`; a **borrower under that lender** also 402s on loans (inheritance); a second, active lender is unaffected; `trialing` past `trialEndsAt` locks even before the sweep runs (computed effective status); platform_admin never gated; sweep transitions statuses and is idempotent.

### Step 8 — Verify & close out

1. Suite green (+ gate tests).
2. Manual: suspend Manifi's seed company via the admin panel → lender admin sees lock page, can open a support ticket, platform admin reactivates → access restored without re-login.
3. `CLAUDE.md` (Sections 2/6; add a "Billing" line to Section 1 or 3); changelog (deploy step: run `backfillSubscriptions.js`, set Manifi `active`). Commit; merge green.

## Acceptance criteria

1. Suite green including the full Step 7 matrix.
2. Lock excludes exactly the exempt prefixes — probe each.
3. Effective status is computed from dates (a stale `trialing` doc past its date locks immediately, sweep or not).
4. Manifi is `active` post-backfill; platform flows unaffected.

## Session sizing

**Two sessions.** A: Steps 1–5 (schema, middleware, routes, sweep, tests) — server-complete. B: Step 6 client + Step 8 verification.

## Rollback

Revert the merge commit. The `subscription` subdocument is additive and inert to old code. If a bad deploy locks a paying tenant, the immediate mitigation is `PUT /api/subscriptions/:companyId` → `active` (no code change needed) — note this in the ops runbook line of the changelog.

## Flagged concerns

- **402 semantics:** some proxies/clients treat 402 oddly; if the deployed stack mishandles it, fall back to 403 + the `SUBSCRIPTION_LOCKED` code. Verify on the real deployment during the Coolify migration.
- Manual billing means a human must watch `past_due` states; the Step 5 emails to lender admins help, but Nexus-side visibility is just the admin panel — a weekly digest email to Nexus is a cheap follow-on if wanted.
- Trial length (30 d) and grace (7 d) are my defaults — confirm with William; they're constants in one place.

## Execution notes (added during execution, 2026-07-11)

- `Company.subscription.status` enum is `['trialing', 'active', 'past_due', 'read_only', 'suspended', 'cancelled']` — `read_only` added per the amended lifecycle above. `TRIAL_GRACE_DAYS` (7) and `READ_ONLY_GRACE_DAYS` (7) are both constants in `server/middleware/subscription.js`.
- Gate middleware and admin routes mounted in `server/app.js`, not `server/server.js` as the doc originally said — routes have lived in `app.js` since Phase 03b's thin-bootstrap split; every phase since (08, 09) has mounted new routers there instead, so this phase follows that established precedent rather than the doc's stale pointer.
- Gate test file placed at `server/tests/api/subscriptionGate.test.js`, not `server/utils/__tests__/subscriptionGate.test.js` as the doc said — these are Supertest/HTTP tests against the real gated routes, not unit tests, matching the Phase 03b/08 convention for that distinction.
- `expireSubscriptions.js`'s 4 transitions (`trialing`→`past_due`, `active`→`past_due`, `past_due`→`read_only`, `read_only`→`suspended`) are not the source of truth for enforcement — `computeEffectiveStatus()` in the middleware recomputes the effective tier from stored dates on every request regardless of what the sweep has or hasn't run, per acceptance criterion 3. The sweep exists to (a) keep the persisted `status` reasonably fresh for the admin panel and (b) fire the transition emails once per crossing, not to gate anything itself.
- The gate fails **open** on unexpected DB/lookup errors (a caught exception inside `enforceSubscription` calls `next()`, not a 402/500) — a billing-gate outage shouldn't take down the whole API. This is a deliberate deviation from the tenant-isolation modules' fail-closed convention (Section 7 of CLAUDE.md), which governs read/write access to specific documents; this gate governs a business/billing concern, not a security boundary.
- This dev/Atlas environment does not actually have a company named "Manifi" seeded (only FirstBank Lending / QuickCash Microfinance, the existing demo lenders every prior phase's Atlas verification has used) — acceptance criterion 4 was verified against FirstBank instead. `backfillSubscriptions.js` supports `--activate="<name>"` for whichever lender is meant to go live first; run it with the real lender's name at actual go-live.
- Client: no shared page-layout wrapper exists in this codebase (each route in `App.jsx` repeats its own `<Navbar /><main>...` block), so `<SubscriptionBanner />` was inserted into all 7 protected route blocks individually rather than in one shared place — mechanical duplication consistent with the existing pattern, not a new one.
