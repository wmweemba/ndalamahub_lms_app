# Phase 08 — Support Ticket System

**Prerequisite:** Phases 01–07 merged; suite green. Branch: `phase/08-support-tickets` off `main`.

> **Flagged up front:** the roadmap assumed porting this from Chama360, but Chama360's source is not in this repo or workspace. This plan therefore specifies a **fresh, minimal build**. If William can provide the Chama360 ticket module before this phase executes, stop and ask whether to port instead — otherwise build exactly what's below.

## Objective

A tenant-scoped support ticket system: any user can raise a ticket; it routes up the hierarchy (borrower/employer users → their lender's staff; lender staff → platform admin), supports a threaded conversation, and tracks status. This is also a prerequisite for Phase 10, whose trial-gating must exempt support routes.

## Scope

- New: `server/models/Ticket.js`, `server/routes/tickets.js`, `server/utils/__tests__/tickets.test.js`
- `server/server.js` — mount `/api/tickets`
- Client (functional minimum): new `client/src/pages/support/SupportPage.jsx` + route in `App.jsx` + a Navbar link, using **existing** UI components (Card, Dialog, Badge, Select, Textarea — all already in `components/ui/`). No new design language; match the plainest existing page (e.g. `UsersPage.jsx`) structurally.

**Out of scope:** email notifications on ticket events (Phase 09 adds them by calling into this model), file attachments, SLAs/escalation timers, canned responses.

## Step-by-step instructions

### Step 1 — Model

`server/models/Ticket.js`:

```js
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true }, // TK<year><seq>, atomic counter like loanNumber
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  category: {
    type: String,
    enum: ['loan_inquiry', 'repayment_issue', 'account_access', 'technical', 'other'],
    default: 'other'
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },       // creator's company
  handlerCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },                 // lender handling it; null => platform-level
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedLoan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
  messages: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
```

`ticketNumber` uses the same atomic-counter pattern as Phase 05's loan numbers (`counters` collection, key `ticketNumber-<year>`), in a pre-save hook.

Routing rule (set once at creation, in the route): creator is borrower/employer-side → `handlerCompany` = the creator company's `lenderCompany`; creator is lender-side → `handlerCompany = null` (platform-level, handled by Nexus). The first message is the ticket description (there is no separate description field — keeps the thread uniform).

### Step 2 — Routes (`server/routes/tickets.js`, mounted at `/api/tickets`)

All routes `authenticateToken`. Visibility via `tenantScope` idioms:

- A user always sees tickets they created.
- `employer_admin`/`employer_hr` additionally see all tickets where `company` = their company.
- `lender_admin`/`lender_officer` additionally see tickets where `handlerCompany` = their company, plus their own company's tickets.
- `platform_admin` sees everything.

Endpoints:

| Method & path | Who | Behavior |
|---|---|---|
| `POST /` | any authenticated | body `{subject, category, priority?, relatedLoan?, message}`; creates ticket + first message; server derives `company`/`handlerCompany`; if `relatedLoan` present, verify `canReadLoan` else 403 |
| `GET /` | any | list visible tickets (filter per rule above), query params `status`, `page`, `limit`; sort `updatedAt` desc |
| `GET /:id` | any visible | full ticket with populated `createdBy`/`assignedTo`/`messages.author` (name fields only, orphan-guarded per Phase 06 pattern) |
| `POST /:id/messages` | any visible | append `{body}`; reopens: if status `resolved`, set back to `in_progress` when the author is the creator |
| `PUT /:id/status` | handler side only (lender staff for lender-handled, platform_admin for platform-level) | `{status}` transitions; `closed` is terminal (only platform_admin may reopen) |
| `PUT /:id/assign` | handler side only | `{assignedTo}` must be a user of the handler company (or platform_admin for platform-level) |

Every handler follows the existing route conventions: try/catch, `{success, message, data}` envelope, dev-gated error strings.

### Step 3 — Tests

`tickets.test.js` minimum cases: creation routes `handlerCompany` correctly for a borrower vs. a lender_admin creator; visibility matrix (borrower can't see a colleague's ticket, employer_hr can, other lender's admin cannot); status change denied to creator/allowed to handler; message append reopens a resolved ticket; ticketNumber uniqueness across two rapid creates.

### Step 4 — Client functional minimum

`SupportPage.jsx`: a table of the caller's visible tickets (number, subject, status badge, updated date) + "New ticket" dialog (subject, category, message) + a detail dialog showing the thread with a reply box; lender staff additionally get a status select in the detail view. Reuse TanStack Query patterns from `UsersPage.jsx`. Route: `/support`, Navbar link visible to all roles. Nothing more.

### Step 5 — Verify & close out

1. Suite green (+ ticket tests).
2. Manual: borrower creates ticket → their lender's admin sees it, replies, resolves; borrower reply reopens; second lender's admin gets 403/absence.
3. Mount survives auth: unauthenticated `GET /api/tickets` → 401.
4. `CLAUDE.md` (Section 2/6 as applicable — support tickets now exist); changelog. Commit; merge green.

## Acceptance criteria

1. Suite green including Step 3 matrix.
2. Manual flow in Step 5.2 works end-to-end in the UI.
3. Ticket visibility honors tenancy exactly (spot-check with the Phase 04 second-lender seed data).
4. No new UI primitives or styling beyond existing components.

## Session sizing

**Two sessions.** A: model + routes + tests (server-complete, verifiable by API). B: client page + end-to-end verification.

## Rollback

Revert the merge commit; optionally drop the `tickets` collection (and `ticketNumber-*` counters) — additive feature, nothing depends on it until Phase 10's exemption list references the route path (which is just a string).

## Flagged concerns

- Categories/priorities are a guess pending real support workflow input from Manifi — they're enum values, trivially extendable; confirm with William before executing if possible.
- No email on ticket events until Phase 09 — until then handlers must poll the Support page; acceptable interim.
