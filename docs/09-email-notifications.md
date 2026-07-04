# Phase 09 — Email & Notification Integration

**Prerequisite:** Phases 01–08 merged; suite green. Branch: `phase/09-email-notifications` off `main`.

## Objective

Give the platform real outbound email. Today no email library is installed; password reset has a `// TODO: Send email` and returns the token in the API response in dev mode. This phase adds a single mail utility (Resend), wires the transactional sends that matter for go-live — password reset, loan lifecycle, repayment reminders, overdue notices, ticket updates — and rides on Phase 07's scheduler for the time-based ones.

**Provider decision:** Resend (simple API, good deliverability, free tier adequate for Manifi's volume). This is a swappable detail — the utility isolates it — but the plan assumes Resend; if William prefers SMTP/nodemailer, only Step 1 changes. **Confirm the sending domain and DNS access before this phase executes** — without a verified domain, emails land in spam or don't send.

## Scope

- New: `server/utils/email.js`, `server/utils/emailTemplates.js`, `server/jobs/sendPaymentReminders.js`, `server/utils/__tests__/email.test.js`
- `server/routes/auth.js` — send reset email; remove dev-mode token-in-response
- `server/routes/loans.js` — approve / reject / disburse notifications
- `server/routes/tickets.js` — new-message / status-change notifications
- `server/jobs/scheduler.js` — reminder job registration
- `server/package.json` — add `resend`
- `server/.env.example` — `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `APP_URL`

**Out of scope:** SMS/WhatsApp (future; Zambian-market comms live in the archived guide and need a product decision), user-configurable notification preferences, HTML template design beyond a clean shared layout, in-app notification center.

## Step-by-step instructions

### Step 1 — Mail utility

`pnpm add resend` (in `server/`). `server/utils/email.js`:

```js
const { Resend } = require('resend');

const enabled = !!process.env.RESEND_API_KEY;
const resend = enabled ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send an email. No-ops (with a warn log) when RESEND_API_KEY is unset,
 * so dev environments and tests never require credentials.
 * Never throws — callers must not fail their request because mail failed.
 */
async function sendEmail({ to, subject, html }) {
  if (!enabled) {
    console.warn(`[email] disabled (no RESEND_API_KEY) — would send "${subject}" to ${to}`);
    return { sent: false, reason: 'disabled' };
  }
  try {
    const from = `${process.env.FROM_NAME || 'NdalamaHub'} <${process.env.FROM_EMAIL}>`;
    const result = await resend.emails.send({ from, to, subject, html });
    return { sent: true, id: result.data && result.data.id };
  } catch (error) {
    console.error('[email] send failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendEmail };
```

The **never-throws / no-op without key** contract is the load-bearing design decision — every caller can fire-and-forget (`sendEmail(...).catch(() => {})` not even needed, but never `await`-block a response on it; use `void sendEmail(...)` or await without letting a failure change the HTTP result).

### Step 2 — Templates

`server/utils/emailTemplates.js`: plain functions returning `{subject, html}`; one shared `layout(title, bodyHtml)` wrapper (inline CSS, no external assets). Required templates and their data:

| Template | Trigger | Data |
|---|---|---|
| `passwordReset(user, resetUrl)` | forgot-password | link `${APP_URL}/reset-password?token=...` — valid 10 min (matches existing expiry) |
| `loanApproved(user, loan)` | approve route | loan number, amount, term |
| `loanRejected(user, loan, notes)` | reject route | notes = `approvalNotes` |
| `loanDisbursed(user, loan)` | disburse route | net disbursement, first due date, payment amount |
| `paymentReminder(user, loan, installment)` | cron, T-3 days | due date, amount, loan number |
| `paymentOverdue(user, loan, installment)` | cron (Phase 07 job emits events — see Step 4) | days late, amount |
| `ticketUpdate(user, ticket, message)` | ticket reply/status | ticket number, new status or message excerpt |

All money formatted `ZMW x,xxx.xx`; no PII beyond first name + the loan/ticket numbers.

### Step 3 — Wire transactional sends

3a. `auth.js` forgot-password: after saving the hashed token, `void sendEmail(emailTemplates.passwordReset(user, resetUrl))` and **delete** the dev-mode `resetToken` in the response (the Phase 02 TODO). The response body becomes the neutral success message only. Add `APP_URL` to `.env.example`.

3b. `loans.js`: at the success points of approve (~after `loan.save()`), reject, disburse — send to `loan.applicant.email` (populate is already done in those routes; orphan-guard per Phase 06).

3c. `tickets.js`: on `POST /:id/messages` notify the counterparty (creator if a handler wrote, assignee-or-handler-side if the creator wrote); on status change notify the creator.

### Step 4 — Scheduled sends

`server/jobs/sendPaymentReminders.js`, same shape as `markOverdueInstallments`:

- **Reminders:** active loans with a `pending` installment whose `dueDate` is exactly 3 days ahead (date-window match on the day, not a moving 72 h) → `paymentReminder` to the applicant. Stamp the installment with `reminderSentAt` (add this optional Date field to the installment subdocument schema) so reruns don't double-send.
- **Overdue notices:** installments the Phase 07 job just marked `overdue` and that have no `overdueNoticeSentAt` (second optional Date field) → `paymentOverdue`, stamp it.

Register in `scheduler.js` daily at 08:00 Africa/Lusaka (humane send hour), same `ENABLE_CRON` gate, plus a manual runner script `jobs/runSendReminders.js` and package script `job:reminders`.

### Step 5 — Tests

Because `sendEmail` no-ops without a key, tests exercise selection logic, not delivery: mock `utils/email.js` with `jest.mock` and assert — reminder selects exactly the T-3 installment (not T-2/T-4); `reminderSentAt` prevents re-send; overdue notice fires once; forgot-password response body contains no token; approve route calls the right template with the right recipient.

### Step 6 — Verify & close out

1. Suite green (+ email tests).
2. Manual with a real `RESEND_API_KEY` in local `.env` and your own address as recipient: forgot-password delivers a working reset link end-to-end; approve a seeded loan → email arrives; run `pnpm job:reminders` against a seeded T-3 loan → reminder arrives.
3. Boot without the key → warn logs, everything else functional.
4. `CLAUDE.md` (Section 6 email item; env vars); changelog (deploy steps: set env vars, verify domain DNS). Commit; merge green.

## Acceptance criteria

1. Suite green; all Step 5 assertions.
2. Reset flow works by email alone (no token in any API response — grep the route to prove it).
3. No request fails or slows because mail failed (kill the API key mid-test; approve still 200s).
4. Duplicate-suppression stamps work across reruns.

## Session sizing

**Two sessions.** A: Steps 1–3 (utility + templates + transactional wiring) — commit green. B: Steps 4–6 (cron sends + tests + live verification).

## Rollback

Revert the merge commit; unset `RESEND_API_KEY`. The two new installment stamp fields are additive/optional — safe under old code. Note: rolling back resurrects the no-reset-email state, and the dev token-in-response will be gone from history — a rollback leaves *no* password-reset path; roll forward preferred.

## Flagged concerns

- Sending domain + DNS (SPF/DKIM via Resend) must be set up by William — code can't verify a domain. Blocker to schedule before the phase runs.
- Ticket notification fan-out is deliberately minimal (single counterparty); if Manifi wants team inboxes/CC rules, that's config to design later.
- Borrower email quality is now operationally important (typo'd emails = silent non-delivery); consider an email-verification flow in the auth migration.
