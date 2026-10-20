import { formatDate } from '@/lib/format';

const DAY_MS = 24 * 60 * 60 * 1000;

// Which date governs a lender's access. Mirrors the server gate's anchor:
// currentPeriodEnd when set (a paying lender always has one, so a stale
// trialEndsAt is ignored), else trialEndsAt (trial, or trial lapsed unpaid).
export function getAccessUntil(subscription) {
  if (!subscription) return { date: null, kind: null };
  if (subscription.currentPeriodEnd) return { date: subscription.currentPeriodEnd, kind: 'paid' };
  if (subscription.trialEndsAt) return { date: subscription.trialEndsAt, kind: 'trial' };
  return { date: null, kind: null };
}

export function daysUntil(date, now = new Date()) {
  return Math.ceil((new Date(date) - new Date(now)) / DAY_MS);
}

export function getExpiryStatus(subscription, { soonDays = 14, now = new Date() } = {}) {
  if (!subscription) return null;
  if (subscription.status === 'suspended' || subscription.status === 'cancelled') return null;
  const { date } = getAccessUntil(subscription);
  if (!date) return null;
  const days = daysUntil(date, now);
  if (days < 0) return { tone: 'danger', label: `Expired ${formatDate(date)}` };
  if (days <= soonDays) return { tone: 'warning', label: `Expires in ${days}d` };
  return null;
}

// Mirrors the server's addMonthsClamped (UTC): 31 Jan + 1 month = end of Feb.
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

// Preview of the period end a recorded payment will produce (server rule D1):
// base = max(now, currentPeriodEnd, trialEndsAt if trialing), then add months.
// The server response stays the source of truth.
export function previewPeriodEnd(subscription, periodMonths, now = new Date()) {
  const sub = subscription || {};
  const candidates = [new Date(now).getTime()];
  if (sub.currentPeriodEnd) candidates.push(new Date(sub.currentPeriodEnd).getTime());
  if (sub.status === 'trialing' && sub.trialEndsAt) candidates.push(new Date(sub.trialEndsAt).getTime());
  const base = new Date(Math.max(...candidates));
  return addMonthsClamped(base, periodMonths);
}
