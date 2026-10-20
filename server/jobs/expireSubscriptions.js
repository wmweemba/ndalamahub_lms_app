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
      await lender.save();
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
    const anchor = sub.status === 'active' ? sub.currentPeriodEnd
      : sub.status === 'trialing' ? sub.trialEndsAt : null;
    if (anchor) {
      const anchorDate = new Date(anchor);
      const daysLeft = Math.ceil((anchorDate.getTime() - asOf.getTime()) / DAY_MS);
      const alreadySent = sub.reminderSentFor && new Date(sub.reminderSentFor).getTime() === anchorDate.getTime();
      if (daysLeft >= 1 && daysLeft <= RENEWAL_REMINDER_DAYS && !alreadySent) {
        const sends = await notifyLenderAdmins(lender, sub.status === 'active' ? 'renewal_upcoming' : 'trial_ending');
        if (sends.some((r) => r && r.sent === true)) {
          sub.reminderSentFor = anchorDate;
          await lender.save();
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
