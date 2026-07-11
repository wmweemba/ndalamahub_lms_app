const Company = require('../models/Company');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const { TRIAL_GRACE_DAYS, READ_ONLY_GRACE_DAYS } = require('../middleware/subscription');

const DAY_MS = 24 * 60 * 60 * 1000;
const daysPast = (anchor, asOf) => Math.floor((asOf.getTime() - new Date(anchor).getTime()) / DAY_MS);

async function notifyLenderAdmins(lender, kind) {
  const admins = await User.find({ company: lender._id, role: 'lender_admin' }).select('firstName email');
  for (const admin of admins) {
    if (admin.email) {
      void sendEmail({ to: admin.email, ...emailTemplates.subscriptionNotice(admin, lender, kind) });
    }
  }
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
  const result = { trialToPastDue: 0, activeToPastDue: 0, pastDueToReadOnly: 0, readOnlyToSuspended: 0 };

  for (const lender of lenders) {
    const sub = lender.subscription;
    if (!sub || !sub.status) continue;

    let notifyKind = null;

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
      await notifyLenderAdmins(lender, notifyKind);
    }
  }

  return result;
}

module.exports = expireSubscriptions;
