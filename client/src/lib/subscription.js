import { formatDate } from '@/lib/format';

const DAY_MS = 24 * 60 * 60 * 1000;

// Which date governs a lender's access. Only a trialing lender is bound by
// trialEndsAt; once paying, a stale trialEndsAt must be ignored.
export function getAccessUntil(subscription) {
  if (!subscription) return { date: null, kind: null };
  if (subscription.status === 'trialing') {
    return subscription.trialEndsAt
      ? { date: subscription.trialEndsAt, kind: 'trial' }
      : { date: null, kind: null };
  }
  return subscription.currentPeriodEnd
    ? { date: subscription.currentPeriodEnd, kind: 'paid' }
    : { date: null, kind: null };
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
