const BillingAuditLog = require('../models/BillingAuditLog');

const KEYS = ['status', 'plan', 'trialEndsAt', 'currentPeriodEnd', 'suspendedAt', 'notes'];
const DATE_KEYS = ['trialEndsAt', 'currentPeriodEnd', 'suspendedAt'];

function snapshotSubscription(subscription) {
  const src = subscription && typeof subscription.toObject === 'function'
    ? subscription.toObject()
    : (subscription || {});
  const out = {};
  for (const k of KEYS) {
    let v = src[k];
    if (v === undefined || v === null || v === '') {
      v = null;
    } else if (DATE_KEYS.includes(k)) {
      v = v instanceof Date ? v : new Date(v);
    }
    out[k] = v;
  }
  return out;
}

function diffSnapshots(before, after) {
  const b = before || {};
  const a = after || {};
  return KEYS.filter((k) => {
    const x = b[k] == null || b[k] === '' ? null : b[k];
    const y = a[k] == null || a[k] === '' ? null : a[k];
    if (x === null || y === null) return x !== y;
    if (x instanceof Date || y instanceof Date) {
      return new Date(x).getTime() !== new Date(y).getTime();
    }
    return x !== y;
  });
}

async function logBillingChange({ companyId, action, source, performedBy = null, before, after, meta = {} } = {}) {
  try {
    const changedFields = diffSnapshots(before, after);
    if (changedFields.length === 0 && action === 'subscription.adjusted') return null;
    return await BillingAuditLog.create({
      lenderCompany: companyId,
      action,
      source,
      performedBy,
      before: snapshotSubscription(before),
      after: snapshotSubscription(after),
      changedFields,
      meta
    });
  } catch (err) {
    console.error('[billingAudit] failed to write audit row', err);
    return null;
  }
}

module.exports = { snapshotSubscription, diffSnapshots, logBillingChange };
