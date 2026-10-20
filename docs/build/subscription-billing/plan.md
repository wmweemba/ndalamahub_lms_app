# Build: subscription-billing

**Goal:** Fix how NdalamaHub's manual billing reads and works, using what Chama360 and BazaBooks already do. Five outcomes, matching William's five approved recommendations (2026-10-20):

1. **Display fix.** The Billing table stops showing a stale trial date for a paying lender. It shows one "Access until" date plus an expiry badge.
2. **Record payment.** The platform admin records a payment (amount, method, reference, period) and the server works out the new period end, instead of the admin typing a date. Every payment is kept in a ledger and can be seen as payment history.
3. **Warn before the due date.** Lender admins get an in-app banner 7 days out and a reminder email 7 days out, and the admin table shows an "expiring soon" badge.
4. **Banner visibility.** Billing banners stop showing to borrowers and employer staff.
5. **Billing audit log.** Every change to a lender's subscription is recorded: who or what made it, when, and the before and after values. That covers manual adjustments, recorded payments and the daily job's automatic status changes. The log can be viewed per lender.

**Repo:** /Users/williammweemba/Dev_Projects/ndalamahub_lms_app · **Branch:** build/subscription-billing · **Base:** 76dceb8 (re-confirm `git rev-parse --short main` at approval)
**Status:** building (approved by William 2026-10-20 10:41; base 76dceb8)

## Context

Subagents read this section and their own unit only.

**Stack.** A monorepo with `server/` (Express 4.21, Mongoose 8, Jest 30 + Supertest + mongodb-memory-server) and `client/` (React 19, Vite 7, Tailwind v4.1, shadcn/ui, TanStack Query, Vitest + RTL). Use pnpm only. Read the repo's `CLAUDE.md` §3 (tests), §7 (tenancy) and §9 (frontend rules) before starting.

**How billing works today (read before changing it):**
- `server/models/Company.js` has a `subscription` subdocument on lender companies: `status` (enum `trialing|active|past_due|read_only|suspended|cancelled`), `plan`, `trialEndsAt`, `currentPeriodEnd`, `suspendedAt`, `notes`.
- `server/middleware/subscription.js` → `computeEffectiveStatus()` works out access **live from dates** on every request. Its anchor is `currentPeriodEnd || trialEndsAt`. 0 days past the anchor = full access, 1–7 = `past_due` (full access), 8–14 = `read_only`, 15+ = `suspended`. Manual `suspended`/`cancelled` always locks. **Do not change the gate.** Because `currentPeriodEnd` wins over the trial date, a stale `trialEndsAt` never affects access. Bug (1) is display only.
- `server/routes/subscriptions.js` has three routes. `GET /status` (any authenticated user, used by the banner). `GET /` (platform_admin, lists lenders). `PUT /:companyId` (platform_admin, edits any field by hand).
- `server/jobs/expireSubscriptions.js` is the daily 02:00 sweep. It moves the persisted status along and emails lender admins via `emailTemplates.subscriptionNotice(admin, company, kind)`, where kind is `trial_ended | renewal_due | read_only | suspended`. Every one of those emails goes out **after** the anchor date. Nothing warns in advance. Nothing records who changed what.
- `client/src/components/settings/SubscriptionManagement.jsx` is the platform_admin "Billing" tab: a table plus an `EditSubscriptionDialog` with hand-typed dates.
- `client/src/components/layout/SubscriptionBanner.jsx` is rendered by `AppLayout` for **every** role, borrowers included. Today it warns only for `past_due`, `read_only` and trial-ending-soon (7 days).

**Locked decisions for this build** (William approved the direction on 2026-10-20; the details are the planner's, and William can veto them at Checkpoint A):
- **D1: How the new period end is worked out.** `base = max(today, currentPeriodEnd if set, trialEndsAt if status === 'trialing')`, then `newEnd = addMonths(base, periodMonths)`. Paying early never loses paid days or remaining trial days. This is the shared Chama360/BazaBooks `extendSubscription` rule, plus the trial clause. `customPeriodEnd` overrides it when given, and must be a valid date in the future.
- **D2: Safe month addition.** Clamp to the last day of the target month: 31 Jan + 1 month = 28/29 Feb, not 3 Mar. Native `setMonth` overflows, so don't use it bare.
- **D3: Keep `trialEndsAt` in the database and stop showing it once the lender has paid.** **Do not** copy Chama360's `trialExpiresAt = 2099-12-31` trick. It caused a real bug there (on 2026-10-13, groups marked unpaid kept full access).
- **D4: Recording a payment sets** `status = 'active'`, `currentPeriodEnd = newEnd`, unsets `suspendedAt`, and sets `plan` if one is given. It does **not** touch `trialEndsAt` or `notes`.
- **D5: The existing `PUT /:companyId` and its dialog stay unchanged in validation and field behaviour.** It's the manual escape hatch for suspending, cancelling and correcting dates. Two changes only: it now writes an audit entry (D13), and its button label changes to "Adjust".
- **D6: Payment ledger vs audit log.** The `SubscriptionPayment` ledger is the financial record (amount, method, reference). The `BillingAuditLog` (D13) is the change record for *every* subscription mutation, payments included. A recorded payment writes one row to each, linked by `meta.paymentId`.
- **D7: No Mongo transactions.** mongodb-memory-server's default topology doesn't support them (see CLAUDE.md, Phase 22). Use create-then-cleanup: create the payment, save the company, and delete the payment if the company save fails. The audit entry is written last, only after the company save succeeds.
- **D8: Duplicate guard.** If `reference` is non-empty and a payment with the same `lenderCompany` + `reference` already exists → 409. The client also disables Submit while the request is in flight.
- **D9: Lead times.** Banner and email go out 7 days before the anchor date. The admin table badge shows from 14 days out.
- **D10: The reminder email fires once per anchor date.** It's stamped as `subscription.reminderSentFor = <the anchor Date it was sent for>`. Extending the period changes the anchor, so the reminder re-arms automatically with no reset code.
- **D11: Who sees which banner.** Upcoming trial-end or renewal: `lender_admin` only. `past_due`/`read_only`: `lender_admin` + `lender_officer`. Employer-side roles and borrowers see **no** billing banner. Their 402/locked handling (`AccountLockedPage`) is unchanged.
- **D12: Payment fields.** Currency `ZMW` (default). Method enum `mobile_money | bank_transfer | cash | other`. Amount is a Number > 0. `periodMonths` is an integer 1–36, or null when `customPeriodEnd` is used. Exactly one of the two must be supplied.
- **D13: Audit log semantics.**
  - **What is logged.** One `BillingAuditLog` row per subscription mutation. `action` is one of:
    - `subscription.adjusted`: the PUT route.
    - `subscription.payment_recorded`: the POST payments route.
    - `subscription.status_changed`: the daily job's automatic transitions, with `source: 'system'`, `performedBy: null` and `meta.kind` set to the transition (`trial_ended`, `renewal_due`, `read_only`, `suspended`).
  - **What is not logged.** Reminder-email stamps (`reminderSentFor`) are bookkeeping, not changes, and get no row.
  - **Row contents.** Each row stores a `before` and `after` snapshot of the subscription fields `status, plan, trialEndsAt, currentPeriodEnd, suspendedAt, notes`, plus a computed `changedFields` array.
  - **Never break billing.** A failed audit write is non-fatal: `console.error` it and let the operation succeed, following the Chama360 `logAdminAction` pattern. It must never roll back or block a billing change.
  - **Read-only and append-only.** No update or delete routes exist for the log. Reading it is platform_admin only.

**Conventions:**
- Server: new routes keep `requireAuth` + `authorizeMinRole('platform_admin')`, the same as the existing `GET /` and `PUT /` in `routes/subscriptions.js`. Use the response shape `{ success, message?, data }`. Add no ad-hoc tenant comparisons (CLAUDE.md §7), though platform_admin-only routes don't need tenant scoping.
- Server tests: API tests go in `server/tests/api/`, using `server/tests/helpers/{db,fixtures,tokens}.js` (`seedTwoTenants()`, `authHeader(user)`). Model/utility tests go in `server/utils/__tests__/`. Mock `utils/email.js` in any test that might send mail (see `server/tests/api/email.test.js`).
- Run the full server suite with `cd server && npx jest --runInBand`. Parallel runs produce spurious mongodb-memory-server timeouts. The baseline is **346/346**.
- Standalone job runner scripts (`server/jobs/run*.js`) don't load `app.js`. Any model the job now uses (e.g. `BillingAuditLog`) must be `require()`d by the job module itself (CLAUDE.md §3).
- Client: **never** write `bg-[--token]`, `text-[--token]` or `border-[--token]`. Tailwind v4 drops them silently (CLAUDE.md §9, UI_SPEC §13). Use `@theme inline` utilities (`bg-status-warning-bg`, `text-muted-foreground`, …). Dates come from `formatDate` and money from `formatCurrency` (`client/src/lib/format.js`). Use the status tints from the existing `statusBadgeColor` map / UI_SPEC. Fire `sonner` toasts on mutation success and failure. Use TanStack Query for any new fetch. Client baseline: **80/80**.
- Commits: plain messages, **no Co-Authored-By line** (William's standing preference).

**Frontend rules: binding on U5, U6 and U7.** Every client change must conform to `docs/UI_SPEC.md` and match the conventions already in the files being touched. Read UI_SPEC §1, §3.2, §4, §5, §6, §8 and §13 before writing any client code. Where the spec is silent, copy the nearest existing pattern: `EditSubscriptionDialog` and the table in `SubscriptionManagement.jsx` for this tab, `RecordPaymentDialog.jsx` for a payment form, the Customers | Applications segmented control in `client/src/pages/customers/CustomersPage.jsx` for any two-view switch, and the existing `Banner` in `SubscriptionBanner.jsx`. Don't invent a new pattern. If the spec and an existing convention conflict, the spec wins: flag the conflict in the unit report and don't resolve it silently. The rules that apply most here:
- **Register:** this is the light admin register (§7). Platform-admin screens stay on the light register; the dark register is post-demo (§12.1). Flat: hairline borders, no shadows on in-flow cards (only on the dialog overlay itself), no gradients. The auth-screen exception (§1.5) must not appear here.
- **Buttons (§6):** at most **one primary (accent-fill) button per view**. Row actions in the Billing table ("Record payment", "View history", "Adjust") are all `variant="outline"`, matching the existing row "Edit" button. Inside a dialog, the submit button is that dialog's single primary. Labels are sentence case and verb-first.
- **Typography (§4):** Inter for UI text. **IBM Plex Mono (`font-mono`) for every amount, date and reference in tables and previews.** Weights 400/500 only (`font-medium`, never `font-bold`). Captions and labels are 12px (`text-xs`) in `text-muted-foreground`.
- **Tables (§6):** row-based, hairline dividers (`border-b border-border`), no zebra striping, and numeric columns (Amount) right-aligned in Plex Mono. Keep the existing `overflow-x-auto` wrapper used by this table.
- **Pills and badges (§3.2, §6, §8):** full pill radius (`rounded-full`), semantic tint utilities with their matching `-fg` text, always paired with words (never colour alone), and never brand-accent coloured. The expiry badge reuses the `status-warning`/`status-danger` tints, the same way `statusBadgeColor` does.
- **Radius and spacing (§5):** use the existing scale (8px controls, 16px containers, `rounded-2xl` for inline error/notice blocks, as the existing dialog does).
- **Forms (§6):** keep the existing controlled-input approach (`useState`) with shadcn `Input`/`Select`/`Label`/`Textarea` primitives. No RHF/Zod (post-demo, §12.6). Feedback goes through `sonner` toasts. No `alert()` or `window.confirm`.
- **Roles (§13):** role gating lives in `client/src/utils/roleUtils.js`. Don't add new inline role arrays in components. Add a helper there if one is needed, e.g. `canSeeBillingBanner(user)` / `canSeeUpcomingBillingNotice(user)` for D11. U7 owns that addition.
- **Formatting (§13):** `formatDate` and `formatCurrency` from `client/src/lib/format.js`. No ad-hoc `toLocaleDateString` or `toLocaleString` in touched code.
- **Stack (§13):** no new UI or component libraries. There's no shadcn `tabs` primitive in `components/ui/`; use the CustomersPage segmented-control pattern instead of adding one.
- **Tailwind v4 (§13):** no `bg-[--token]`-style classes. The compiled-CSS grep is the gate, not lint or build.
- Note: UI_SPEC §13's "zero server changes" rule applies to UI-only phases. This build is full-stack by design (U1–U4), so it doesn't apply. The client units themselves still must not touch `server/`.

## Units

| ID | Title | Recs | Model | Risk | Depends on | Owns (files) | Status |
|---|---|---|---|---|---|---|---|
| U1 | Payment ledger model + period-extension utility | 2 | sonnet | high | — | `server/models/SubscriptionPayment.js` (new), `server/utils/subscriptionBilling.js` (new), `server/utils/__tests__/subscriptionBilling.test.js` (new) | done |
| U2 | Billing audit log model + logging utility | 5 | sonnet | high | — | `server/models/BillingAuditLog.js` (new), `server/utils/billingAudit.js` (new), `server/utils/__tests__/billingAudit.test.js` (new) | done |
| U3 | Record-payment, payment-history and audit API routes; audit on PUT | 2, 5 | sonnet | high | U1, U2 | `server/routes/subscriptions.js`, `server/tests/api/subscriptionPayments.test.js` (new), `server/tests/api/billingAudit.test.js` (new) | done |
| U4 | Pre-expiry reminder email + audit of automatic transitions | 3, 5 | sonnet | high | U2 | `server/jobs/expireSubscriptions.js`, `server/utils/emailTemplates.js`, `server/models/Company.js` (subscription subdoc only), `server/tests/api/subscriptionReminders.test.js` (new) | done |
| U5 | Client expiry helper + Billing table display fix | 1, 3 | sonnet | low | — | `client/src/lib/subscription.js` (new), `client/src/lib/subscription.test.js` (new), `client/src/components/settings/SubscriptionManagement.jsx` (table section only) | done |
| U6 | Record-payment dialog + history dialog (Payments / Changes) | 2, 5 | sonnet | high | U3, U5 | `client/src/components/settings/RecordSubscriptionPaymentDialog.jsx` (new), `client/src/components/settings/SubscriptionHistoryDialog.jsx` (new), `client/src/components/settings/SubscriptionManagement.jsx` (wiring), `client/src/components/settings/SubscriptionManagement.test.jsx` (new) | todo |
| U7 | Banner: renewal warning + role visibility | 3, 4 | sonnet | low | U5 | `client/src/components/layout/SubscriptionBanner.jsx`, `client/src/components/layout/SubscriptionBanner.test.jsx`, `client/src/utils/roleUtils.js` (billing-banner helpers only) | todo |
| U3a | Fix-up from security review: reference type check, atomic period extension, per-lender try/catch in job, stamp reminder only on send, audit-failure count, `reminderSentFor` not request-settable | — | sonnet | high | U3, U4 | `server/routes/subscriptions.js`, `server/jobs/expireSubscriptions.js`, `server/routes/companies.js` (only if it lets `reminderSentFor` through), their tests | todo |
| U8 | Docs: CLAUDE.md, changelog, runbook | all | haiku | low | U1–U7 | `CLAUDE.md`, `changelog.md`, `docs/PRODUCTION_RUNBOOK.md` | todo |

**Recommendation coverage:**
- 1 (display fix): U5.
- 2 (record payment + ledger): U1, U3, U6.
- 3 (warn before due date): U4 (email), U5 (admin badge), U7 (banner).
- 4 (no banners for borrowers or employer staff): U7.
- 5 (audit log): U2, U3, U4, U6.

**Parallel pairs** (no shared files or dependencies; at most 2 at once, worktree isolation):
1. U1 ∥ U2.
2. U3 ∥ U4: both depend only on finished units and share no files.
3. U5 can pair with any server unit.
4. U6 ∥ U7: both depend on U5 and share no files.

Sequential is fine if worktrees misbehave.

### U1: Payment ledger model + period-extension utility
- **Brief:**
  - New `server/models/SubscriptionPayment.js` (Mongoose, timestamps on). Fields:
    - `lenderCompany` (ObjectId ref `Company`, required, indexed)
    - `amount` (Number, required, min 0.01)
    - `currency` (String, default `'ZMW'`)
    - `method` (String enum `mobile_money|bank_transfer|cash|other`, required)
    - `reference` (String, trimmed, optional)
    - `periodMonths` (Number, integer 1–36, or null)
    - `customPeriodEnd` (Boolean, default false)
    - `previousStatus` (String)
    - `previousPeriodEnd` (Date)
    - `periodStart` (Date, required: the `base` from D1)
    - `periodEnd` (Date, required: the new `currentPeriodEnd`)
    - `plan` (String)
    - `note` (String, max 500)
    - `recordedBy` (ObjectId ref `User`, required)

    Index `{ lenderCompany: 1, createdAt: -1 }`. Add a partial unique index on `{ lenderCompany: 1, reference: 1 }` where `reference` is a non-empty string. This backs D8 at the DB level, and the route also checks first so it can return a clean 409.
  - New `server/utils/subscriptionBilling.js` exporting pure functions with no DB access:
    - `addMonthsClamped(date, months) → Date` (D2).
    - `computePeriodExtension(subscription, { periodMonths, customPeriodEnd }, now = new Date()) → { periodStart, periodEnd }`. Implements D1. Throws an `Error` with `code = 'INVALID_PERIOD'` when neither or both inputs are given, when `periodMonths` is outside the integers 1–36, or when `customPeriodEnd` is invalid or not in the future.
    - `applyPayment(company, { periodEnd, plan }) → { previousStatus, previousPeriodEnd }`. Mutates `company.subscription` per D4 and returns the before-values. Does not save.
- **Contracts:** U3 imports `computePeriodExtension` and `applyPayment` with exactly these signatures, plus the model, which is registered as `'SubscriptionPayment'`.
- **Acceptance:**
  - `cd server && npx jest utils/__tests__/subscriptionBilling.test.js --runInBand` exits 0. The tests must cover:
    - 31 Jan + 1 → end of Feb (leap and non-leap years).
    - Active with a future `currentPeriodEnd` extends from that date, not from today.
    - Active and lapsed extends from today.
    - Trialing with a future `trialEndsAt` and no period end extends from `trialEndsAt`.
    - Trialing whose `trialEndsAt` has passed extends from today.
    - `customPeriodEnd` overrides the calculation.
    - Each `INVALID_PERIOD` case.
    - `applyPayment` sets active, unsets `suspendedAt`, leaves `trialEndsAt` and `notes` alone, and returns the previous values.
  - `cd server && npx jest --runInBand` is all green: 346 + the new tests.

### U2: Billing audit log model + logging utility
- **Brief:**
  - New `server/models/BillingAuditLog.js` (Mongoose, `timestamps: { createdAt: true, updatedAt: false }`). Fields:
    - `lenderCompany` (ObjectId ref `Company`, required)
    - `action` (String enum `subscription.adjusted | subscription.payment_recorded | subscription.status_changed`, required)
    - `source` (String enum `admin | system`, required)
    - `performedBy` (ObjectId ref `User`, null for system)
    - `before` and `after` (both plain sub-objects of `status, plan, trialEndsAt, currentPeriodEnd, suspendedAt, notes`)
    - `changedFields` ([String])
    - `meta` (Mixed, default `{}`)

    Index `{ lenderCompany: 1, createdAt: -1 }`. Make the model append-only in practice: add `pre` hooks on `updateOne`, `findOneAndUpdate`, `updateMany`, `deleteOne` and `deleteMany` that throw an error, so no code path can rewrite history. (The test helper `db.clear()` uses the raw driver's `collection.deleteMany`, which bypasses Mongoose hooks, so test cleanup still works. Don't change the helper.)
  - New `server/utils/billingAudit.js`:
    - `snapshotSubscription(subscription) → plain object` of the six fields. Dates are kept as Date or null. Works on a Mongoose subdoc or a plain object.
    - `diffSnapshots(before, after) → string[]`. Compares field names by value, and compares dates by `getTime()`.
    - `logBillingChange({ companyId, action, source, performedBy = null, before, after, meta = {} }) → Promise<doc|null>`. Computes `changedFields` and creates the row. **Never throws:** on error it does `console.error('[billingAudit] ...')` and returns `null` (D13). Skip writing (return `null`) when `changedFields` is empty **and** the action is `subscription.adjusted`. A no-op save isn't a change.
- **Contracts:** U3 and U4 import `snapshotSubscription` and `logBillingChange` with exactly these signatures. U3's GET route reads `BillingAuditLog`.
- **Acceptance:**
  - `cd server && npx jest utils/__tests__/billingAudit.test.js --runInBand` exits 0. The tests must cover (using `mongodb-memory-server` via `tests/helpers/db.js`):
    - The snapshot picks exactly the six fields.
    - The diff detects a date change and ignores a date that didn't change.
    - A row is created with the right `changedFields`.
    - A no-op adjusted is skipped.
    - A forced create failure (e.g. invalid action) returns `null` and doesn't throw.
    - `BillingAuditLog.updateOne(...)` and `.deleteOne(...)` reject.
  - `cd server && npx jest --runInBand` is all green.

### U3: Record-payment, payment-history and audit API routes; audit on PUT
- **Brief:** In `server/routes/subscriptions.js`, keep the existing three routes unchanged in validation and response:
  - `PUT /:companyId`: take `before = snapshotSubscription(company.subscription)` before mutating. After `company.save()` succeeds, call `logBillingChange({ action: 'subscription.adjusted', source: 'admin', performedBy: req.user.id, before, after: snapshot(after) })`. Await it, but it never throws.
  - `POST /:companyId/payments` (`requireAuth`, `authorizeMinRole('platform_admin')`). Body: `{ amount, method, reference?, periodMonths?, customPeriodEnd?, plan?, note? }`.
    - 404 if the company doesn't exist. 400 if it isn't `type: 'lender'`, using the same wording as the existing PUT.
    - 400 on an invalid amount or method, or on `INVALID_PERIOD` (use the util's message).
    - 409 on a duplicate reference (D8). Also catch Mongo error 11000 → 409.
    - Otherwise: snapshot `before`, compute the extension, create the `SubscriptionPayment` (`recordedBy: req.user.id`, plus the before-values and the period from the utils), then `applyPayment` + `company.save()`. If the save fails, delete the payment and return 500 (D7). After success, call `logBillingChange({ action: 'subscription.payment_recorded', source: 'admin', performedBy, before, after, meta: { paymentId, amount, currency, method, reference } })`.
    - Respond 201 `{ success: true, message: 'Payment recorded', data: { company, payment } }`.
    - Sending an email is out of scope.
  - `GET /:companyId/payments` (platform_admin). Responds `{ success: true, data: { payments } }`, newest first, with `recordedBy` populated to `firstName lastName username`. 404 on an unknown company.
  - `GET /:companyId/audit` (platform_admin). Responds `{ success: true, data: { entries } }`, newest first, limited to 200, with `performedBy` populated to `firstName lastName username`. 404 on an unknown company. There are no write routes for the log.
  - Route order: declare the `/:companyId/...` routes so they don't collide with `GET /status` or `GET /`.
- **Contracts:** U6 consumes `POST/GET /:companyId/payments` and `GET /:companyId/audit` with exactly these paths and response shapes.
- **Acceptance:**
  - `cd server && npx jest tests/api/subscriptionPayments.test.js --runInBand` exits 0. The tests must cover:
    - Platform admin records a 1-month payment on an active lender with a future period end, giving `periodEnd = old end + 1 month`, `status` active, and a ledger row with `previousPeriodEnd` set.
    - Recording on a `suspended` lender unlocks it: a subsequent `GET /api/loans` as that lender's admin returns 200 (it was 402 before).
    - A trialing lender extends from `trialEndsAt`.
    - Custom end date.
    - 400s: bad amount, bad method, neither or both period inputs, a past custom date, a non-lender company.
    - Duplicate reference → 409, and the period is not extended twice.
    - 403 for `lender_admin` on all new routes. 404 for an unknown company.
    - GET returns newest first.
  - `cd server && npx jest tests/api/billingAudit.test.js --runInBand` exits 0. The tests must cover:
    - A PUT that changes status writes one `subscription.adjusted` row, with `performedBy` set and `changedFields` containing `status`.
    - A PUT that changes nothing writes no row.
    - A recorded payment writes one `subscription.payment_recorded` row whose `meta.paymentId` matches the ledger row.
    - A rejected payment (400 or 409) writes **no** audit row.
    - When `logBillingChange` is forced to fail (`jest.spyOn(BillingAuditLog, 'create').mockRejectedValueOnce(...)`), the PUT and the POST still return success.
    - `GET /audit` returns rows newest first. `lender_admin` → 403.
  - The existing `server/tests/api/subscriptionGate.test.js` stays green. `cd server && npx jest --runInBand` is all green.

### U4: Pre-expiry reminder email + audit of automatic transitions
- **Brief:**
  - `server/models/Company.js`: add `reminderSentFor: Date` inside the `subscription` subdocument only.
  - `server/utils/emailTemplates.js`: add two entries to `SUBSCRIPTION_NOTICE_COPY`. `renewal_upcoming` has the subject `"<name>: your NdalamaHub subscription renews on <date>"` and a body saying the period ends on that date, payment keeps access uninterrupted, and they should contact Nexus support to arrange it. `trial_ending` is the same shape for a trial. `subscriptionNotice(adminUser, company, kind)` must be able to read the date: pass the anchor via the company's subscription and format it `en-GB`, e.g. `15 Nov 2026`.
  - `server/jobs/expireSubscriptions.js`:
    - **Audit.** `require('../models/BillingAuditLog')` and `snapshotSubscription`/`logBillingChange` from `../utils/billingAudit` at the top of the module. The standalone runner `runExpireSubscriptions.js` doesn't load `app.js`. In each existing transition branch, snapshot `before` before mutating. After `lender.save()`, call `logBillingChange({ companyId: lender._id, action: 'subscription.status_changed', source: 'system', before, after, meta: { kind: notifyKind } })`. Do **not** write an audit row for the reminder stamp (D13).
    - **Reminder.** Before the existing transition branches, for each lender:
      - Set `anchor = status === 'active' ? currentPeriodEnd : status === 'trialing' ? trialEndsAt : null`.
      - Compute `daysLeft = ceil((anchor - asOf) / DAY_MS)`.
      - If `1 <= daysLeft <= 7` **and** `reminderSentFor` isn't equal to `anchor` (compare `getTime()`): set `reminderSentFor = anchor`, save, and notify lender admins with kind `renewal_upcoming` (active) or `trial_ending` (trialing).
      - Export a constant `RENEWAL_REMINDER_DAYS = 7`.
      - Add `renewalReminders` to the result counts.
      - Never send the reminder and a transition email in the same run for the same lender. If a transition fires, skip the reminder.
  - Keep the existing transition logic, counts and emails byte-identical apart from those additions.
- **Contracts:** none consumed by other units. U8 documents the new email and the audit entries.
- **Acceptance:** `cd server && npx jest tests/api/subscriptionReminders.test.js --runInBand` exits 0. Mock `utils/email.js` and call `expireSubscriptions(asOf)` directly. The tests must cover:
  - Active lender 5 days out → 1 email, `reminderSentFor` stamped, and **no** audit row.
  - Second run the same day → 0 emails (idempotent).
  - After extending `currentPeriodEnd` and moving `asOf` to 5 days before the new end → emails again (re-arms).
  - 10 days out → none.
  - Trialing 3 days out → `trial_ending`.
  - `suspended`/`past_due` → no reminder.
  - Existing transitions still produce the same counts.
  - An active → past_due transition writes one `subscription.status_changed` row with `source: 'system'`, `performedBy: null`, `meta.kind: 'renewal_due'`, and `changedFields` containing `status`.
  - A second sweep on the same day writes no further audit rows.

  The existing `server/tests/api/subscriptionGate.test.js` stays green. `cd server && npx jest --runInBand` is all green.

### U5: Client expiry helper + Billing table display fix
- **Brief:**
  - New `client/src/lib/subscription.js`, client-safe, no imports beyond `format.js`.
    - `getAccessUntil(subscription) → { date, kind: 'trial' | 'paid' | null }`. Returns the trial date only when `status === 'trialing'`; otherwise `currentPeriodEnd` (D3).
    - `daysUntil(date, now = new Date()) → integer`, using `Math.ceil` over days.
    - `getExpiryStatus(subscription, { soonDays = 14 } = {}) → null | { tone: 'danger' | 'warning' | 'neutral', label }`. Labels: `Expired <date>` (danger) when days < 0; `Expires in Nd` (warning) when days ≤ soonDays; otherwise `null`. No badge for `suspended`/`cancelled`, since the status pill already says it.
  - In `SubscriptionManagement.jsx`'s **table only**:
    - Replace the "Trial ends" and "Period ends" columns with a single **"Access until"** column. It shows the date in `font-mono`, with a small muted caption `Trial` or `Paid` beneath, and the expiry badge next to it, using the `status-danger`/`status-warning` tint utilities.
    - Switch the local `formatDate` to the one in `@/lib/format`.
    - Rename the row's "Edit" button to **"Adjust"**. It still opens the existing dialog, unchanged.
    - Leave a clear spot in the actions cell for U6's buttons.
- **Contracts:** U6 and U7 import `getAccessUntil`, `daysUntil` and `getExpiryStatus` from `@/lib/subscription`.
- **Acceptance:**
  - `cd client && pnpm test -- src/lib/subscription.test.js` exits 0. The tests must cover: an active lender with a stale `trialEndsAt` gives kind 'paid' and the period date; trialing gives 'trial'; a 5-days-out badge is warning; a lapsed one is danger; a 30-day one is null.
  - `cd client && pnpm lint && pnpm build && pnpm test` exits 0.
  - The UI_SPEC §13 grep returns nothing: `grep -oE '\.[a-z-]+-\\\[--[a-z-]+\\\]\{[^}]*\}' client/dist/assets/*.css | grep -v 'var('`.
  - UI_SPEC conformance: the unit report confirms each Frontend rule in §Context was checked against the diff and lists any spec/convention conflict it found. `git diff --name-only` shows no `server/` path.

### U6: Record-payment dialog + history dialog (Payments / Changes)
- **Brief:**
  - New `RecordSubscriptionPaymentDialog.jsx`, built from shadcn `Dialog`/`Input`/`Select`/`Label`/`Textarea`, styled to match `EditSubscriptionDialog`. Fields:
    - Amount (K), required.
    - Method select (Mobile money / Bank transfer / Cash / Other).
    - Reference.
    - Period: a select of **1, 3, 6, 12 months** plus "Custom end date", which reveals a date input.
    - Plan, prefilled from the current plan.
    - Note.
  - Show a **live preview line**: "Access will run until <date>". It's computed client-side with the same D1 rule: add a small `previewPeriodEnd(subscription, periodMonths)` in `@/lib/subscription.js`, unit-tested. **Exception to U5's file ownership:** U6 may add this one function and its test to that file. The server's response is the source of truth, so show the returned `currentPeriodEnd` in the success toast.
  - Submit posts to `POST /subscriptions/:id/payments` via `useMutation`, disabled while pending. On success: toast, invalidate or refetch the lender list **and** that lender's history queries, close. On error: inline error plus toast, using the server message (the 409 duplicate in particular).
  - New `SubscriptionHistoryDialog.jsx`, with a two-view segmented control, **Payments | Changes**, copying the CustomersPage Customers | Applications pattern exactly.
    - **Payments** fetches `GET /subscriptions/:id/payments` with `useQuery(['subscription-payments', id])`. Table: Date recorded · Amount · Method · Reference · Period (start → end) · Recorded by.
    - **Changes** fetches `GET /subscriptions/:id/audit` with `useQuery(['subscription-audit', id])`. Table: When · Action (human labels: "Adjusted", "Payment recorded", "Automatic status change") · By (user name, or "System" for `source: 'system'`) · What changed. "What changed" is one line per `changedFields` entry, shaped `field: before → after`, with dates via `formatDate`, status values via the existing status pill, and an empty value shown as `—`.
    - Each view has its own empty state. The query only runs while its view is open.
  - Wire both into `SubscriptionManagement.jsx`'s actions cell as **"Record payment"** and **"View history"**, next to "Adjust". All three are `variant="outline"` (one-primary-per-view rule, UI_SPEC §6). In both history tables, Amount is right-aligned and every amount, date and reference is `font-mono`. It's fine to move the lender list onto `useQuery(['subscriptions'])` if that's the cleanest way to refetch. Keep the `/subscriptions` response handling identical. After a save, the "Adjust" dialog should also invalidate `['subscription-audit', id]`.
- **Contracts:** consumes the U3 routes and the U5 helpers.
- **Acceptance:**
  - `cd client && pnpm test -- src/components/settings/SubscriptionManagement.test.jsx` exits 0, with `@/utils/api` mocked. The tests must cover:
    - An active lender with a stale `trialEndsAt` does **not** render that trial date anywhere in the table.
    - "Record payment" opens the dialog. Choosing 3 months shows the right preview date. Submit posts the expected body.
    - A 409 response shows the server message.
    - The history Payments view renders the returned rows.
    - The Changes view renders "System" for a system entry and a `status: active → past due` line for a status change.
  - `cd client && pnpm lint && pnpm build && pnpm test` exits 0, and the §13 grep is clean.
  - UI_SPEC conformance: the unit report confirms each Frontend rule in §Context was checked against the diff (buttons, typography, pills, roles, formatting, the segmented control matching CustomersPage) and lists any spec/convention conflict it found. `git diff --name-only` shows no `server/` path.

### U7: Banner: renewal warning + role visibility
- **Brief:** In `SubscriptionBanner.jsx`, apply D11.
  - Return `null` for any role other than `lender_admin`/`lender_officer`.
  - `past_due`/`read_only` keep their current lender-side copy for both lender roles. Delete the employer/borrower copy branches.
  - Trial-ending-soon (existing) and a new **renewal-upcoming** banner show to `lender_admin` only. The renewal banner appears when `effectiveStatus === 'active'` and `daysUntil(currentPeriodEnd)` is between 0 and 7. It uses the info tint, titled "Subscription renews soon", with the body "Your subscription runs until <formatDate>. Arrange payment with Nexus before then to keep uninterrupted access."
  - The trial banner should also name its date.
  - Use the U5 helpers for day maths. Keep the `['subscription-status']` query and its 1h `staleTime`.
  - Replace the inline `LENDER_SIDE_ROLES` array with helpers added to `client/src/utils/roleUtils.js` (UI_SPEC §13), which is in U7's owned files. Keep the existing `Banner` component and its tint classes. The new banner reuses them and doesn't add a new style.
- **Contracts:** consumes the U5 helpers. `/subscriptions/status` already returns `currentPeriodEnd`, so no server change is needed.
- **Acceptance:** `cd client && pnpm test -- src/components/layout/SubscriptionBanner.test.jsx` exits 0.
  - **The existing test asserts a borrower sees the read_only banner. Rewrite it to assert that a borrower sees nothing.** This is an intended behaviour change.
  - New tests: `lender_admin` + active + 5 days → renewal banner with the date; `lender_officer` + active + 5 days → nothing; `lender_officer` + past_due → banner; `employer_hr` + read_only → nothing; `lender_admin` + active + 30 days → nothing.
  - `cd client && pnpm lint && pnpm build && pnpm test` exits 0, and the §13 grep is clean.
  - UI_SPEC conformance: the unit report confirms each Frontend rule in §Context was checked against the diff (buttons, typography, pills, roles, formatting) and lists any spec/convention conflict it found. `git diff --name-only` shows no `server/` path.

### U8: Docs
- **Brief:**
  - `CLAUDE.md`: update the "Last updated" line and the test counts in §3. Replace the Section 2/§6 billing description with the following, editing sections in place without appending a history:
    - The "record payment" ledger and the D1 extension rule.
    - The pre-expiry reminder (cron note in §3).
    - Banner visibility.
    - The billing audit log: what's logged, that it's append-only and non-fatal, and where to view it.
  - `changelog.md`: new top entry dated the build date, one bullet per unit, final suite counts.
  - `docs/PRODUCTION_RUNBOOK.md`: line ~108. Change the "locked" recovery step to **Settings → Billing → Record payment**, with "Adjust" only for suspensions and corrections. Add a line: to see why a lender's access changed, open **View history → Changes**.
- **Acceptance:** `git diff --stat` touches only those three files. The test counts quoted match the verifier's last full-suite output.

## Gates
| Gate | After | Opus reads | Note |
|---|---|---|---|
| G1 | U1–U3 | `server/utils/subscriptionBilling.js`, `server/utils/billingAudit.js`, `server/models/BillingAuditLog.js`, the PUT + POST handlers in `server/routes/subscriptions.js`, `server/models/SubscriptionPayment.js` | Money path. Check D1/D2/D4/D7/D8 against the code, not the tests. Check D13: an audit failure can never fail or roll back a billing change, an audit row is written only after a successful save, and the model has no update/delete path. Confirm the gate (`middleware/subscription.js`) is untouched. |
| G2 | U4 | `server/jobs/expireSubscriptions.js` diff | Idempotency (D10). No double email on a transition day. Existing transitions unchanged. A system audit row per transition, and none for reminders. The job `require`s the audit model itself. |
| G3 | U5–U7 | `RecordSubscriptionPaymentDialog.jsx`, `SubscriptionHistoryDialog.jsx`, `SubscriptionBanner.jsx`, `SubscriptionManagement.jsx` | Preview rule matches the server. The role matrix matches D11, via `roleUtils.js`. **UI_SPEC pass:** one primary per view, `font-mono` on amounts and dates, no `font-bold`, pills paired with text, no shadows on in-flow cards, the segmented control matches CustomersPage, no `bg-[--token]`, no inline role arrays. Then e2e + reviewer (model **opus**: U1, U2, U3, U4 and U6 are risk high). |

## E2E flows
Run on the local dev stack (`pnpm dev`, client on :5173 through the Vite proxy) against a **throwaway fixture**, the same approach as the 2026-08-12 verification: a scratch script creates a lender company and a platform_admin + lender_admin + borrower under it. Don't reuse Manifi or a production account. Never point this at production.
1. Log in as platform_admin → Settings → Billing. The fixture lender (status active, a stale `trialEndsAt`, period end 5 days out) shows **one** "Access until" date, a "Paid" caption and an "Expires in 5d" badge. No trial date is visible.
2. Record payment: K500, Mobile money, reference `E2E-001`, 1 month. The preview shows period end + 1 month. Submit → toast. The row now shows the new date and no badge. View history → Payments shows one row.
3. Record payment again with reference `E2E-001` → an inline "duplicate" error. The date is unchanged.
4. Set the fixture back to 5 days out with Adjust. Log in as lender_admin → "Subscription renews soon" banner with the date.
5. Log in as the borrower → no billing banner anywhere.
6. Adjust the fixture to `suspended` → lender_admin gets the locked page. As platform_admin, Record payment for 1 month → lender_admin reloads and has full access.
7. As platform_admin → View history → Changes. Shows, newest first: "Payment recorded" (status suspended → active, the period-end change), "Adjusted" (→ suspended), "Adjusted" (period end moved back), "Payment recorded" (from step 2), each with the platform admin's name. The failed duplicate in step 3 left no entry.
8. Run `cd server && pnpm job:subscriptions` against the local dev DB only, after setting the fixture's period end to 3 days ago with Adjust. Changes then shows an "Automatic status change" by "System" (active → past due).

## Log
- 2026-10-20 U3 done (22 tests) and U5 done (9 client tests; client gates + token grep clean). **G1 passed** (Opus read of routes, utils, models): D1/D2/D4 via U1 utils; D7 create → save → delete-on-fail; D8 pre-check + 11000; audit only after a successful save and never fatal; middleware/subscription.js untouched. Full server suite 397/398 (only the known rollover failure). Security review on U3/U4 produced the fix-up unit U3a. Fail-open audit (by D13) and no audit for `reminderSentFor` (by D13) were acknowledged, not changed.
- 2026-10-20 U4 done (7 tests). **G2 passed** (Opus read of job + template diff): transitions unchanged apart from the `before` snapshot; reminder stamp idempotent and re-arms on a new anchor; transition and reminder never in the same run (`continue`); no audit row for reminders; job `require`s BillingAuditLog. Cosmetic: the reminder body and the shared footer both say "contact Nexus support". Left as is.
- 2026-10-20 U1 done (17 tests; Opus diff read OK). Notes for U3: `computePeriodExtension` requires a real Number for `periodMonths` (coerce body strings first); month maths is UTC. U2 hardening commit 3e6df4f: also blocks `findOneAndReplace` and re-`save()` of an existing row (security-review finding). `bulkWrite`/raw-driver writes still bypass Mongoose hooks; DB-role enforcement is out of scope (noted for William). Worktrees are cut from `main`, not the build branch: implementers must `git merge --ff-only build/subscription-billing` first.
- 2026-10-20 U2 done (29e5da6, 6 tests; Opus diff read OK; also blocks findOneAndDelete/replaceOne). **Known pre-existing failure:** `utils/__tests__/loan.rollover.test.js` "quotes a settlement off the post-rollover schedule" fails on clean code too (date-dependent, interestBalance 312.5 vs 0). Effective baseline is 345/346; out of scope for this build, flagged for William.
- 2026-10-20 10:41 Checkpoint A approved by William. Base 76dceb8 confirmed. Build session started 10:41; branch build/subscription-billing created.
- 2026-10-20 plan amended (2): William's scope is all five recommendations, not three. Added the billing audit log (rec 5) as U2, plus audit wiring in U3/U4/U6. D6 was rewritten and D13 added. Units renumbered (old U2–U7 → U3–U8). Recommendation coverage table added.
- 2026-10-20 plan amended: explicit UI_SPEC/existing-convention rules added for the client units. Row buttons changed from primary to outline (§6, one primary per view). Banner role checks moved to `roleUtils.js` (§13).
- 2026-10-20 plan drafted in a planning session (comparison of Chama360 `mern_vb_app` and BazaBooks `payrush_saas_app` billing). Waiting for Checkpoint A approval in a fresh `/build subscription-billing` session.

## Next session
Run `/build subscription-billing` on **Opus** in a fresh session. Phase 0 finds this plan with status `planning`, so it goes straight to Checkpoint A. Re-confirm the base sha, show the units table and gates, and get William's approval before dispatching U1.
