import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser, canSeeBillingBanner, canSeeUpcomingBillingNotice } from '@/utils/roleUtils';
import { daysUntil } from '@/lib/subscription';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const WARNING_DAYS = 7;

const TINT_CLASSES = {
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  info: 'bg-status-info-bg text-status-info-fg',
};

function Banner({ tint, title, children }) {
  return (
    <div role="alert" className={cn('max-w-7xl mx-auto mt-4 rounded-2xl p-4', TINT_CLASSES[tint])}>
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export function SubscriptionBanner() {
  const currentUser = getCurrentUser();
  const canSee = canSeeBillingBanner(currentUser);

  const { data } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/subscriptions/status').then((res) => res.data.data),
    staleTime: 60 * 60 * 1000, // 1h
    enabled: !!currentUser && canSee,
  });

  if (!canSee || !data || data.exempt) return null;

  if (data.effectiveStatus === 'past_due') {
    return (
      <Banner tint="warning" title="Payment overdue">
        Your subscription payment is overdue. You still have full access during the grace period, but please arrange payment soon to avoid losing functionality.
      </Banner>
    );
  }

  if (data.effectiveStatus === 'read_only') {
    return (
      <Banner tint="danger" title="Read-only access">
        Your subscription is unpaid and access is now read-only — you can view dashboards and reports, but cannot create or modify records. Arrange payment now to avoid a full lockout.
      </Banner>
    );
  }

  if (!canSeeUpcomingBillingNotice(currentUser)) return null;

  // Persisted status (not effectiveStatus): the gate reports 'trialing' for any
  // lapsed-but-in-grace lender, including a paying one on its last paid day.
  const trialDays = data.trialEndsAt ? daysUntil(data.trialEndsAt) : null;
  if (
    data.status === 'trialing' &&
    trialDays !== null &&
    trialDays >= 0 &&
    trialDays <= WARNING_DAYS
  ) {
    return (
      <Banner tint="info" title="Trial ending soon">
        Your free trial ends on <span className="font-mono">{formatDate(data.trialEndsAt)}</span>. Arrange payment to keep uninterrupted access.
      </Banner>
    );
  }

  if (data.effectiveStatus === 'active' && data.currentPeriodEnd) {
    const days = daysUntil(data.currentPeriodEnd);
    if (days >= 0 && days <= WARNING_DAYS) {
      return (
        <Banner tint="info" title="Subscription renews soon">
          Your subscription runs until <span className="font-mono">{formatDate(data.currentPeriodEnd)}</span>. Arrange payment with Nexus before then to keep uninterrupted access.
        </Banner>
      );
    }
  }

  return null;
}
