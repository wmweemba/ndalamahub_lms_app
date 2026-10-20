// Pure helpers for manual subscription billing. No DB access.

function invalid(message) {
  const err = new Error(message);
  err.code = 'INVALID_PERIOD';
  return err;
}

// Adds whole months, clamping the day to the last day of the target month
// (31 Jan + 1 month = 28/29 Feb). Does not mutate the input; preserves time of day (UTC).
function addMonthsClamped(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth() + months, 1,
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()
  ));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

const isGiven = (v) => v !== null && v !== undefined && v !== '';

function computePeriodExtension(subscription, { periodMonths, customPeriodEnd } = {}, now = new Date()) {
  const hasMonths = isGiven(periodMonths);
  const hasCustom = isGiven(customPeriodEnd);
  if (hasMonths === hasCustom) {
    throw invalid('Provide exactly one of periodMonths or customPeriodEnd');
  }

  const sub = subscription || {};
  const candidates = [now];
  if (sub.currentPeriodEnd) candidates.push(new Date(sub.currentPeriodEnd));
  if (sub.status === 'trialing' && sub.trialEndsAt) candidates.push(new Date(sub.trialEndsAt));
  const base = new Date(Math.max(...candidates.map((d) => d.getTime())));

  if (hasCustom) {
    const end = new Date(customPeriodEnd);
    if (Number.isNaN(end.getTime())) throw invalid('customPeriodEnd is not a valid date');
    if (end.getTime() <= now.getTime()) throw invalid('customPeriodEnd must be in the future');
    return { periodStart: base, periodEnd: end };
  }

  if (!Number.isInteger(periodMonths) || periodMonths < 1 || periodMonths > 36) {
    throw invalid('periodMonths must be an integer between 1 and 36');
  }
  return { periodStart: base, periodEnd: addMonthsClamped(base, periodMonths) };
}

// Mutates company.subscription per a recorded payment. Does not save.
function applyPayment(company, { periodEnd, plan } = {}) {
  const sub = company.subscription;
  const previousStatus = sub.status;
  const previousPeriodEnd = sub.currentPeriodEnd;
  sub.status = 'active';
  sub.currentPeriodEnd = periodEnd;
  sub.suspendedAt = undefined;
  if (plan) sub.plan = plan;
  return { previousStatus, previousPeriodEnd };
}

module.exports = { addMonthsClamped, computePeriodExtension, applyPayment };
