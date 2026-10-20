const Company = require('../models/Company');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const BillingAuditLog = require('../models/BillingAuditLog'); // register for the standalone runner
const { snapshotSubscription, logBillingChange } = require('../utils/billingAudit');
const { TRIAL_GRACE_DAYS, READ_ONLY_GRACE_DAYS } = require('../middleware/subscription');

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEWAL_REMINDER_DAYS = 7;
const daysPast = (anchor, asOf) => Math.floor((asOf.getTime() - new Date(anchor).getTime()) / DAY_MS);

async function notifyLenderAdmins(lender, kind) {
  const admins = await User.find({ company: lender._id, role: 'lender_admin' }).select('firstName email');
  const results = [];
  for (const admin of admins) {
    if (admin.email) {
      results.push(await sendEmail({ to: admin.email, ...emailTemplates.subscriptionNotice(admin, lender, kind) }));
    }
  }
  return results;
}

/**
 * Write the job's change only if the subscription is still exactly as the job
 * read it. A plain lender.save() would overwrite a payment (or an Adjust)
 * recorded by an admin while the sweep was running. Returns true if applied.
 * A field that was unset when read matches `null` (null matches missing).
 */
async function applyIfUnchanged(lender, before, set) {
  const filter = {
    _id: lender._id,
    // 'trialing' is the schema default, so the in-memory doc reports it even
    // when no status is stored (legacy lenders); let a missing value match too.
    'subscription.status': before.status === 'trialing' ? { $in: ['trialing', null] } : before.status,
    'subscription.currentPeriodEnd': before.currentPeriodEnd || null,
    'subscription.trialEndsAt': before.trialEndsAt || null
  };
  const updates = {};
  for (const [k, v] of Object.entries(set)) updates[`subscription.${k}`] = v;
  const res = await Company.updateOne(filter, { $set: updates });
  return res.modifiedCount === 1;
}

/**
 * Daily sweep: keeps the persisted subscription.status roughly in sync with
 * reality and fires the transition emails. NOT the source of truth for
 * enforcement — server/middleware/subscription.js computes the effective
 * status from dates on every request regardless of what this job has run.
 * Idempotent — a lender already in a state simply doesn't match any branch.
 */
async function expireSubscriptions(asOf = new Date()) {
  const lenders = await Company.find({ type: 'lender' });
  const result = { trialToPastDue: 0, activeToPastDue: 0, pastDueToReadOnly: 0, readOnlyToSuspended: 0, renewalReminders: 0, errors: 0, auditWriteFailures: 0 };

  for (const lender of lenders) {
    try {
    const sub = lender.subscription;
    if (!sub || !sub.status) continue;

    let notifyKind = null;
    const before = snapshotSubscription(sub);

    if (sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt < asOf) {
      sub.status = 'past_due';
      result.trialToPastDue += 1;
      notifyKind = 'trial_ended';
    } else if (sub.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd < asOf) {
      sub.status = 'past_due';
      result.activeToPastDue += 1;
      notifyKind = 'renewal_due';
    } else if (sub.status === 'past_due') {
      const anchor = sub.currentPeriodEnd || sub.trialEndsAt;
      if (anchor && daysPast(anchor, asOf) > TRIAL_GRACE_DAYS) {
        sub.status = 'read_only';
        result.pastDueToReadOnly += 1;
        notifyKind = 'read_only';
      }
    } else if (sub.status === 'read_only') {
      const anchor = sub.currentPeriodEnd || sub.trialEndsAt;
      if (anchor && daysPast(anchor, asOf) > TRIAL_GRACE_DAYS + READ_ONLY_GRACE_DAYS) {
        sub.status = 'suspended';
        sub.suspendedAt = asOf;
        result.readOnlyToSuspended += 1;
        notifyKind = 'suspended';
      }
    }

    if (notifyKind) {
      const set = { status: sub.status };
      if (notifyKind === 'suspended') set.suspendedAt = sub.suspendedAt;
      if (!(await applyIfUnchanged(lender, before, set))) {
        // Changed under us (e.g. a payment was recorded mid-sweep): skip this
        // lender, no email and no audit row. Tomorrow's run re-evaluates.
        console.warn('[expireSubscriptions] subscription changed during sweep, skipped', lender._id);
        continue;
      }
      const auditRow = await logBillingChange({
        companyId: lender._id,
        action: 'subscription.status_changed',
        source: 'system',
        before,
        after: snapshotSubscription(lender.subscription),
        meta: { kind: notifyKind }
      });
      if (!auditRow) result.auditWriteFailures += 1;
      await notifyLenderAdmins(lender, notifyKind);
      continue;
    }

    // Pre-expiry reminder (only when no transition fired for this lender this run).
    // Same anchor the access gate uses (currentPeriodEnd wins over trialEndsAt).
    const anchor = (sub.status === 'active' || sub.status === 'trialing')
      ? (sub.currentPeriodEnd || sub.trialEndsAt) : null;
    if (anchor) {
      const anchorDate = new Date(anchor);
      const daysLeft = Math.ceil((anchorDate.getTime() - asOf.getTime()) / DAY_MS);
      const alreadySent = sub.reminderSentFor && new Date(sub.reminderSentFor).getTime() === anchorDate.getTime();
      if (daysLeft >= 1 && daysLeft <= RENEWAL_REMINDER_DAYS && !alreadySent) {
        const sends = await notifyLenderAdmins(lender, sub.status === 'active' ? 'renewal_upcoming' : 'trial_ending');
        if (sends.some((r) => r && r.sent === true)) {
          // Conditional: don't clobber a payment that landed during the sweep.
          await applyIfUnchanged(lender, before, { reminderSentFor: anchorDate });
          result.renewalReminders += 1;
        }
      }
    }
    } catch (err) {
      console.error('[expireSubscriptions] lender failed', lender._id, err);
      result.errors += 1;
    }
  }

  return result;
}

module.exports = expireSubscriptions;
module.exports.RENEWAL_REMINDER_DAYS = RENEWAL_REMINDER_DAYS;
