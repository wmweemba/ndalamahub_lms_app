import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { cn } from '@/lib/utils';

const LENDER_SIDE_ROLES = ['lender_admin', 'lender_officer'];
const TRIAL_WARNING_DAYS = 7;

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

  const { data } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/subscriptions/status').then((res) => res.data.data),
    staleTime: 60 * 60 * 1000, // 1h
    enabled: !!currentUser,
  });

  if (!data || data.exempt) return null;

  const isLenderSide = LENDER_SIDE_ROLES.includes(currentUser?.role);

  const trialEndingSoon =
    data.effectiveStatus === 'trialing' &&
    data.trialEndsAt &&
    new Date(data.trialEndsAt) - Date.now() < TRIAL_WARNING_DAYS * 24 * 60 * 60 * 1000;

  if (data.effectiveStatus === 'past_due') {
    return (
      <Banner tint="warning" title="Payment overdue">
        {isLenderSide
          ? 'Your subscription payment is overdue. You still have full access during the grace period, but please arrange payment soon to avoid losing functionality.'
          : "Your lender's subscription payment is overdue. Access is unaffected for now, but may become limited soon if it isn't resolved."}
      </Banner>
    );
  }

  if (data.effectiveStatus === 'read_only') {
    return (
      <Banner tint="danger" title="Read-only access">
        {isLenderSide
          ? 'Your subscription is unpaid and access is now read-only — you can view dashboards and reports, but cannot create or modify records. Arrange payment now to avoid a full lockout.'
          : "Your lender's account is unpaid and access is now read-only — dashboards and reports are still available, but changes cannot be made until they renew."}
      </Banner>
    );
  }

  if (trialEndingSoon) {
    return (
      <Banner tint="info" title="Trial ending soon">
        {isLenderSide
          ? 'Your free trial ends soon. Arrange payment to keep uninterrupted access.'
          : "Your lender's free trial ends soon."}
      </Banner>
    );
  }

  return null;
}
