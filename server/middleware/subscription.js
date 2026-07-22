const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const { isPlatformAdmin, isLenderSide, companyLenderId } = require('../utils/tenantScope');

const EXEMPT_PREFIXES = ['/api/auth', '/api/tickets', '/api/health', '/api/subscriptions/status', '/api/public'];
const LOCKED_STATUSES = ['suspended', 'cancelled'];

const TRIAL_GRACE_DAYS = 7;   // past_due window after trialEndsAt/currentPeriodEnd
const READ_ONLY_GRACE_DAYS = 7; // additional read-only window after the past_due grace

const isExempt = (path) => EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

/** Resolve the lender company whose subscription state governs this user. platform_admin -> null (exempt). */
async function payingLenderId(user) {
  if (isPlatformAdmin(user)) return null;
  if (isLenderSide(user)) return user.company;
  return companyLenderId(user.company); // employer-side / borrower
}

/**
 * Compute the *effective* subscription status from stored dates rather than
 * trusting a possibly-stale `status` field — a doc that's still `trialing`
 * past its trialEndsAt locks immediately, sweep or not.
 *
 * Staircase (days past the anchor date): 0 = full access; 1-7 = past_due
 * (full access, warning banner); 8-14 = read_only (GET/HEAD only); 15+ =
 * suspended (fully locked). Manual `suspended`/`cancelled` always locks.
 */
function computeEffectiveStatus(subscription, now = new Date()) {
  const status = (subscription && subscription.status) || 'trialing';

  if (LOCKED_STATUSES.includes(status)) {
    return { effectiveStatus: status, locked: true, readOnly: false };
  }

  const anchor = (subscription && (subscription.currentPeriodEnd || subscription.trialEndsAt)) || null;
  if (!anchor) {
    // No date to compute a lapse from (e.g. a lender predating Phase 10 and
    // not yet backfilled) — don't lock on missing data.
    return { effectiveStatus: status === 'active' ? 'active' : 'trialing', locked: false, readOnly: false };
  }

  const daysPast = Math.floor((now.getTime() - new Date(anchor).getTime()) / (24 * 60 * 60 * 1000));

  if (daysPast <= 0) {
    return { effectiveStatus: status === 'active' ? 'active' : 'trialing', locked: false, readOnly: false };
  }
  if (daysPast <= TRIAL_GRACE_DAYS) {
    return { effectiveStatus: 'past_due', locked: false, readOnly: false };
  }
  if (daysPast <= TRIAL_GRACE_DAYS + READ_ONLY_GRACE_DAYS) {
    return { effectiveStatus: 'read_only', locked: false, readOnly: true };
  }
  return { effectiveStatus: 'suspended', locked: true, readOnly: false };
}

/**
 * Gate every non-exempt /api/* route. Mounted before the route mounts in
 * app.js; skips exempt prefixes and requests with no bearer token (the
 * route's own authenticateToken handles the 401 as usual). Never blocks
 * platform_admin. Fails open on unexpected DB/lookup errors — a billing
 * gate outage shouldn't take the whole API down.
 */
const enforceSubscription = async (req, res, next) => {
  if (isExempt(req.path)) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(); // invalid/expired token — the route's own auth middleware rejects it
  }

  if (isPlatformAdmin(user)) return next();

  try {
    const lenderId = await payingLenderId(user);
    if (!lenderId) return next();

    const lenderCompany = await Company.findById(lenderId).select('subscription');
    if (!lenderCompany) return next();

    const { effectiveStatus, locked, readOnly } = computeEffectiveStatus(lenderCompany.subscription);

    if (locked) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_LOCKED',
        message: 'Your organisation\'s NdalamaHub subscription is inactive. Please contact support.',
        data: { status: effectiveStatus }
      });
    }

    if (readOnly && !['GET', 'HEAD'].includes(req.method)) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_LOCKED',
        message: 'Your organisation\'s NdalamaHub subscription is in a read-only grace period. Contact support to restore full access.',
        data: { status: effectiveStatus }
      });
    }

    next();
  } catch (error) {
    console.error('[subscription] gate error:', error);
    next();
  }
};

module.exports = {
  EXEMPT_PREFIXES,
  LOCKED_STATUSES,
  TRIAL_GRACE_DAYS,
  READ_ONLY_GRACE_DAYS,
  payingLenderId,
  computeEffectiveStatus,
  enforceSubscription
};
