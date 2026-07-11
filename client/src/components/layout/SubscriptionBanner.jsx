import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const LENDER_SIDE_ROLES = ['lender_admin', 'lender_officer'];
const TRIAL_WARNING_DAYS = 7;

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
      <Alert variant="destructive" className="max-w-7xl mx-auto mt-4">
        <AlertTitle>Payment overdue</AlertTitle>
        <AlertDescription>
          {isLenderSide
            ? 'Your subscription payment is overdue. You still have full access during the grace period, but please arrange payment soon to avoid losing functionality.'
            : "Your lender's subscription payment is overdue. Access is unaffected for now, but may become limited soon if it isn't resolved."}
        </AlertDescription>
      </Alert>
    );
  }

  if (data.effectiveStatus === 'read_only') {
    return (
      <Alert variant="destructive" className="max-w-7xl mx-auto mt-4">
        <AlertTitle>Read-only access</AlertTitle>
        <AlertDescription>
          {isLenderSide
            ? 'Your subscription is unpaid and access is now read-only — you can view dashboards and reports, but cannot create or modify records. Arrange payment now to avoid a full lockout.'
            : "Your lender's account is unpaid and access is now read-only — dashboards and reports are still available, but changes cannot be made until they renew."}
        </AlertDescription>
      </Alert>
    );
  }

  if (trialEndingSoon) {
    return (
      <Alert className="max-w-7xl mx-auto mt-4">
        <AlertTitle>Trial ending soon</AlertTitle>
        <AlertDescription>
          {isLenderSide
            ? 'Your free trial ends soon. Arrange payment to keep uninterrupted access.'
            : "Your lender's free trial ends soon."}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
