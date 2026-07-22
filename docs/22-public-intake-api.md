# Phase 22 — Public application intake API (server) + website contract

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning). **Executes on:** `phase/22-public-intake-api`, branched from `main` (Phase 21 merged).
**Session size:** one ~2h session.
**Read first:** `docs/DECISIONS.md` "Manifi launch decisions (2026-07-22)"; the manifipay website's existing form (external repo `manifipay_website`: `application-form.js` + the `id="form-*"` fields in `index.html` — the contract below was derived from them); `MANIFI_PROJECT_MASTER.md` §8 in that repo (the origin design: browser POSTs directly to an LMS endpoint, CORS-allowed, same URL from day one); `server/middleware/subscription.js` (exempt-prefix mechanics); `server/app.js` (mounting order).

## Objective

A public, unauthenticated-but-hardened intake endpoint that receives manifipay.com loan applications as **CustomerApplication (prospect) records** — no User account, no Loan, no tenant access is created at intake. Review/conversion routes for lender staff complete the server side; the UI queue is Phase 24. This phase also fixes the **field-mapping contract** so William can do the website-side swap (Sentinel URL → this endpoint) in parallel.

## Security design (locked)

Applications are open; accounts are gated. There is **no browser-holdable secret**, so the endpoint's protections are: strict validation, aggressive rate limiting, CORS pinned to the lender's registered origin, a honeypot field, and **server-side tenant binding** — the URL slug maps to a lender via that lender's own stored intake config; no client-supplied ids are ever trusted.

## Steps

### Step 1 — Intake config on the lender

`Company` (lender): `publicIntake: { enabled: Boolean default false, slug: String (unique sparse, lowercase), allowedOrigin: String }`. Editable by `platform_admin` only (route + minimal Billing-adjacent UI can wait — a script/API call is fine for now; flag in close-out that UI exposure is punch-listed). Manifi production values: slug `manifipay`, origin `https://manifipay.com`.

### Step 2 — CustomerApplication model

`server/models/CustomerApplication.js`: `lenderCompany` (req), `status: ['pending','approved','rejected'] default pending`, `applicant: { fullName, nrc, phone, email?, address, employmentStatus, employerName?, monthlyIncome? }`, `loanRequest: { amount, purpose, termDays }`, `collateral: { type, otherDescription?, description, estimatedValue? }` (subdocument at intake; becomes a real Collateral record at conversion), `source: 'website'`, `review: { by, at, notes }`, `createdUser?`/`createdLoan?` refs, timestamps. Index `{ lenderCompany: 1, status: 1 }`.

### Step 3 — The public endpoint

`POST /api/public/:slug/applications` (`server/routes/publicIntake.js`):

- Resolve slug → lender with `publicIntake.enabled`; 404 otherwise. If the lender's subscription `computeEffectiveStatus` is locked → 503-style refusal (intake off while unpaid; do not leak subscription detail in the message).
- **Mount/exemption:** this path must bypass `enforceSubscription`'s token flow — add `/api/public` to `EXEMPT_PREFIXES` (the manual lender check above replaces it) and mount before/compatibly with existing middleware order; keep `express-mongo-sanitize` and `helmet` applying.
- CORS: reflect only the lender's `allowedOrigin` for this route (per-route CORS, not a global loosening). Also accept no-Origin (server-to-server/curl) — origin is a hurdle, not the security boundary.
- Rate limit: dedicated `express-rate-limit` (e.g. 10/hour/IP, plus a burst limiter) — separate from the auth limiter.
- Validation: required per the contract below, amount within a sane bound (flag: consider clamping to the product's min/max by loading the lender's active product), phone/NRC loose-format checks. Honeypot field (`website` — a name bots fill) → silently accept-and-drop (200 with fake ref, no record).
- On success: create the CustomerApplication, return `{ success, reference }` (reference = a short human code, e.g. `APP-` + counter or id-suffix — follow the atomic counters pattern from Phase 05 if a counter is used). Email notification to the lender's `lender_admin`s (existing `sendEmail`, new `emailTemplates.applicationReceived()`), owner Telegram optional — follow the Phase 11 ticket-alert pattern.

### Step 4 — Review/conversion routes (server side of Phase 24's UI)

`server/routes/customerApplications.js` (mount `/api/customer-applications`, authenticated, lender-side of the owning tenant only):

- `GET /` (status filter, pending default) and `GET /:id` — each response includes **dedupe flags** computed live: existing borrower in this lender's scope matching NRC or phone (and email if present) → `{ matchType, userId, name }`.
- `PUT /:id/reject` — reason required.
- `PUT /:id/approve` — atomic conversion: create the borrower User (company = lender, NRC-first per Phase 19 rules; username = email || NRC; if email present → send set-password invite using the Phase 23-specified invite mechanism — if Phase 23 hasn't run yet, generate the reset token via the existing forgot-password infra and send; if no email → create with a staff-set temporary password passed in the approve body), create the Loan (`pending`, product = the lender's matching product, amount/purpose from the request), create the Collateral record (`declared`) attached to the loan, stamp `review` + refs, status `approved`. **Alternative path**: `attachToUserId` in the body attaches the loan to an existing matched customer instead of creating a duplicate. All-or-nothing: on any failure, no partial records (use a transaction if the test Mongo supports it, else create-then-cleanup with care — flag your choice).
- API tests (`server/tests/api/publicIntake.test.js`): happy path, honeypot, rate limit, bad slug, disabled intake, locked lender, validation 400s, tenancy on review routes (other lender's staff 403), conversion creates user+loan+collateral with correct linkage, attach-to-existing path, duplicate-NRC conversion surfaces the dedupe rather than 500ing.

### Step 5 — The website contract (write it into this repo)

Add a section to this doc's close-out — or better, create `docs/INTEGRATION_CONTRACT_MANIFIPAY.md` — specifying: endpoint URL pattern (dev + prod), method POST, `Content-Type: application/json` (the site currently sends FormData to Sentinel; the swap to JSON is the website-side change), and the exact field mapping:

| Website field (`index.html` id) | API field |
|---|---|
| `form-full-name` | `applicant.fullName` |
| `form-nrc` | `applicant.nrc` |
| `form-phone` | `applicant.phone` |
| `form-email` | `applicant.email` (optional) |
| `form-address` | `applicant.address` |
| `form-employment-status` | `applicant.employmentStatus` |
| `form-employer-name` | `applicant.employerName` (conditional) |
| `form-monthly-income` | `applicant.monthlyIncome` |
| `form-loan-amount` | `loanRequest.amount` |
| `form-loan-purpose` (+ `-other`) | `loanRequest.purpose` |
| `form-repayment-term` | `loanRequest.termDays` (always 30 today) |
| `form-collateral-type` | `collateral.type` (map website labels → enum; "other" carries `otherDescription`) |
| `form-collateral-description` | `collateral.description` |
| (honeypot) | `website` — must be empty |

Response contract: `201 { success: true, reference }`; `4xx { success: false, message }`. The website change itself (swap `SUBMIT_SENTINEL_URL`, JSON body, show `reference` in the existing confirmation UI) is **William's, in the manifipay repo — not this phase's code**.

## Acceptance criteria

1. A curl-simulated website submission creates a pending application; staff review shows dedupe flags; approve produces user + pending loan + declared collateral, correctly linked, ready for the Phase 21 verify→approve→letter→disburse flow (verify this full chain once on dev Atlas and record it).
2. Abuse posture holds: rate limit fires, honeypot drops silently, wrong slug/origin refused, locked lender refused.
3. Full suites green (expect ~15 new server tests).

## Close-out

Update CLAUDE.md (§2; §4 env note if any new env var; §3 counts), `changelog.md`, and commit `docs/INTEGRATION_CONTRACT_MANIFIPAY.md`; merge → `main`, push, delete branch.
