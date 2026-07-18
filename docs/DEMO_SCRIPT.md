# Manifi demo script — NdalamaHub walkthrough for Clement

**Created:** 2026-07-18 (planning agent), from the Phase 17 Step 5 dress rehearsal (2026-07-17, all 9 steps passed against live data — see `changelog.md`). Every step in this script was executed end-to-end during that rehearsal; nothing here is untested.
**Audience:** Clement (Manifi Investments) — first lender client. Goal: he leaves understanding exactly how Manifi will run its payroll-deduction lending day to day on NdalamaHub, and that the platform is real, working software — not slides.
**Environment:** the live demo environment — frontend `https://ndalamahublms.netlify.app/`, API on Render (`https://ndalamahub-lms-app.onrender.com`), Atlas dev DB. This is the permanent dev/staging/demo environment (CLAUDE.md §4); everything in it is dummy data, so nothing done in the demo needs cleaning up.

---

## 1. Cast of accounts (all existing, all password `TestVerify@2026`)

| Login | Role | Company | Used for |
|---|---|---|---|
| `manager` | lender_admin | FirstBank Lending (the demo lender tenant) | Main demo driver: dashboard, disburse, repayment, reports |
| `hr_sarah` | employer_hr | TechCorp Zambia (employer client) | Approving the loan application |
| `john_employee` | borrower | TechCorp Zambia | The borrower experience (has loan history, so his dashboard renders fully) |
| `loan_officer` | lender_officer | FirstBank Lending | Backup only — shows the officer view if asked |
| `superadmin` | platform_admin | — | **Backstage only** — Nexus's internal view; don't show unless it serves the conversation (see §6) |

**The product:** "Manifi Payday Product" — 25% flat per term, 30-day term — already configured and verified rendering exactly as "25% flat per term" / "30 days". This is Clement's own confirmed product terms live in the system, which is itself a talking point: *his product was configured, not coded*.

**Reference loans already in the DB** (from build verification — confirm they're still in these states during prep): `LN20260009` in arrears (the arrears story), `LN20260010` active with payment history, `LN20260011`/`LN20260012` from earlier verification runs.

## 2. Pre-demo checklist

**A few days before (decisions + optional polish — see §5 for the quirk list):**

- [ ] **Decide: rename the demo lender.** Clement will see "FirstBank Lending" as his company name on the dashboard subtitle and throughout. Renaming it to "Manifi Investments" via the Companies edit dialog (as `manager` or `superadmin`) takes one minute and makes the whole demo read as *his* tenant. Recommended. (Reversible the same way; it's dummy data.)
- [ ] **Decide: pre-demo micro-hotfix or route around** the two cosmetic-but-visible quirks in §5 (the "Welcome, !" empty name on a fresh borrower's dashboard, and the payment-history "Total paid" header mismatch). Both have small client-only fixes; if you want them fixed, have the planning agent scope a one-commit hotfix doc for Sonnet — don't fix ad hoc.
- [ ] Do one full dry run of this script yourself against the Netlify environment (the rehearsal ran against localhost; the environment differs only in hosting, but verify once on the real URL end to end — especially login for all accounts and the Excel export download).

**30 minutes before:**

- [ ] Warm up the Render API (log in once at `ndalamahublms.netlify.app`) so no cold-start delay lands mid-demo, and leave yourself logged in as `manager` in the main window.
- [ ] Second browser window (or profile) ready at 375×812 (DevTools device toolbar) for the borrower — mobile is the borrower's register and demos dramatically better than desktop.
- [ ] Third window/profile for `hr_sarah` (avoids logging in and out mid-flow; three separate browser profiles or one normal + one incognito + one different browser all work).
- [ ] Close everything else; hide bookmarks bar; 100% zoom on the admin windows.
- [ ] Confirm `LN20260009` still shows `in arrears` on the loans list and the dashboard Overdue KPI is non-zero.

## 3. The walkthrough

Target: ~25–30 minutes of driving, leaving room for conversation. Each act lists **Do** and **Say** (what Clement should take away).

### Act 1 — The lender's morning (3 min) · `manager`, desktop

**Do:** Land on the dashboard. Walk the four KPIs (Active portfolio, Active loans, Overdue, Pending applications), the portfolio breakdown with status pills, quick actions, recent applications.
**Say:** "This is what your team sees every morning — the whole portfolio at a glance. The Overdue number isn't a report someone has to remember to run: a scheduled job checks every loan every night at 1am and moves anything past due into arrears automatically. We'll come back to that."
**Highlight:** the numbers are live data; nothing on this screen is a mock-up.

### Act 2 — Onboarding a borrower (3 min) · `manager`, desktop

**Do:** Settings → User Management → Add user. Create a fresh borrower under TechCorp Zambia. **Fill every field including Department** (the server requires it; the form doesn't mark it — see §5). Note the username/password you set.
**Say:** "TechCorp here is one of your employer clients — the companies whose payrolls you lend against. Their employees are your borrowers. Setting one up takes under a minute, and you can also delegate this to the employer's own admin — they manage their staff, you never have to."
**Highlight:** the role model — lender staff, employer admins/HR, borrowers — each sees only their slice.

### Act 3 — The borrower applies (5 min) · mobile window

**Do:** In the 375px window, log in as the **new borrower** (or `john_employee` if you'd rather skip account juggling). If the new borrower: go straight to **Loans** via the bottom nav (their empty dashboard has the "Welcome, !" quirk — §5) and hit "Apply for a loan". Select the **Manifi Payday Product** — pause on the product card: "25% flat per term", "30 days". Enter an amount (e.g. K2,500), show the repayment preview, submit. Toast fires.
**Say:** "This is the employee's experience, on their phone — no app store, just a link. And look at the product card: that's *your* product — 25% flat, 30-day term — configured exactly, not approximated. When your terms change, that's a settings change, not a software project."
**Highlight:** mobile-first borrower register; the schedule preview computed before submitting; the application appearing instantly with no refresh.

### Act 4 — Employer approval (3 min) · `hr_sarah` window

**Do:** As `hr_sarah`, show the HR dashboard — pending approvals count already updated, the new application in Recent loan applications. Open it from Loans, approve with a comment. Pill flips to `approved` live.
**Say:** "Before you ever see an application, the employer's HR has confirmed this person works there and the deduction is viable. That's your first-line risk control, built into the workflow — not a phone call and a spreadsheet."

### Act 5 — Disburse and repay (5 min) · `manager`, desktop

**Do:** Back as `manager`: open the approved loan, **Disburse** (with a note) — status flips to `active` and the repayment schedule appears, anchored to today's disbursement date. Then open `LN20260010` (or the just-disbursed loan), **Record repayment** — mobile money, amount, reference — installment pill flips to `paid` live. Optionally show payment history rows (mind the header quirk, §5).
**Say:** "Disbursement generates the real schedule from the disbursement date — not the application date, so a loan approved on Friday and paid out on Tuesday doesn't lose four days. Repayments are recorded by your team only — employer side is strictly read-only on money movement. Every payment carries its method and reference."
**Highlight:** this is the full lifecycle Clement just watched — applied, approved, disbursed, repaid — in about fifteen minutes.

### Act 6 — When things go wrong: arrears (3 min) · `manager`

**Do:** Open `LN20260009`: `in arrears` pill on the list, in the header, `overdue` on the missed installment in the schedule. Flip to the dashboard: it's inside the Overdue KPI and the breakdown row.
**Say:** "Nobody had to notice this loan was late. The nightly job flagged it, it shows on your dashboard, and the system also emails borrowers a reminder three days *before* each due date, and a notice when they go overdue — automatically. If it recovers, it moves back to active on its own; defaults are only ever declared by a human."

### Act 7 — Reports and exports (3 min) · `manager`

**Do:** Reports page: KPIs and breakdowns, then **View** the Active Loans report and, inside the modal, click the **Excel export** — a real `.xlsx` downloads (rehearsal-verified). Open it briefly. Mention PDF exists too. Show the Overdue Loans report (days in arrears).
**Say:** "Everything your accountant or your board asks for — active book, overdue book, upcoming collections — on screen or as a real Excel/PDF file, generated from live data."

### Act 8 — Support (2 min) · borrower window, then `manager`

**Do:** As the borrower, raise a quick ticket ("How do I check my balance?"). As `manager`, open it, reply, set it to resolved.
**Say:** "Borrower questions come to your team through the system, not your personal WhatsApp — with the full thread kept. And every new ticket also alerts us at Nexus, so platform issues get seen immediately."

### Act 9 — Close (2 min)

Return to the `manager` dashboard (the strongest single screen) and recap: onboarding → application → approval → disbursement → repayment → arrears → reports → support, all live. Then the roadmap conversation: production environment on dedicated infrastructure (the Coolify migration), his data starting clean, go-live steps.

## 4. Backstage — only if the conversation goes there

- **Officer view** (`loan_officer`): same portfolio dashboard scoped to lender staff — shows Manifi can have multiple staff levels.
- **Platform admin** (`superadmin`): Nexus's cross-tenant view and the Billing tab. Showing Clement his own subscription management can open a pricing conversation — only go here deliberately.
- **Security, if asked:** role-gated everything server-side (not just hidden buttons), tenant isolation enforced per-document, rate-limited logins, no public registration, soft-delete for anyone with loan history.

## 5. Known quirks — route around or pre-fix (all logged, none are demo blockers)

These three were found and deliberately flagged (not silently patched) during the dress rehearsal — they're pre-existing functional items, tracked for post-demo fixing:

1. **Fresh borrower's empty dashboard says "Welcome, !"** (missing first name — JWT-payload limitation, CLAUDE.md §6/Phase 06). *Route-around:* after logging in as the new borrower, go straight to Loans via the bottom nav; or do Act 3 with `john_employee`, whose dashboard is fully populated. *Or pre-fix:* one-line client fallback — worth a scoped hotfix if you want the new-borrower moment clean.
2. **Payment-history dialog's "Total paid" header doesn't match its rows** (shows K0 above a K892.63 paid row on `LN20260010`). *Route-around:* in Act 5, show the repayment landing in the schedule (pill flips to `paid`) rather than opening payment history; or open it and don't dwell on the header. *Or pre-fix:* client-side aggregation bug, small.
3. **"Add user" doesn't mark Department as required** but the server rejects without it (clean inline error after a round trip). *Route-around:* always fill Department in Act 2 (it's in the checklist).

Also by design, not bugs: the report **card's** "Export" button opens the same view modal as "View" — the real file export lives on the buttons *inside* the modal (naming/UX mismatch, punch-list item §18.3); and the platform-admin dashboard is deliberately the light register with no charts (dark control-room and charts are post-demo scope cuts).

## 6. If something breaks live

- API slow/unresponsive → Render cold start; you warmed it up in prep, but if it happens, narrate ("demo environment waking up") and use the pause to talk roadmap — it recovers in ~30s.
- A flow errors unexpectedly → don't debug on screen. Every act after Act 2 has existing data to fall back to: `LN20260010`-class active loans for repayment, `LN20260009` for arrears, existing tickets for support. The demo can complete on existing records alone.
- Total loss of the environment → the local dev stack (`pnpm dev` server + client against Atlas) runs the identical demo; keep it as the emergency fallback if you're demoing from your own machine.
