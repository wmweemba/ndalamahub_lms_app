import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser, canApplyForLoan } from '@/utils/roleUtils';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusPill } from '@/components/ui/status-pill';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DUE_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function BorrowerDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'user-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/user-stats');
      return res.data.data;
    },
  });

  if (isLoading) return <DashboardLoading label="Loading your dashboard..." />;
  if (error || !data) return <DashboardError />;

  const { loanSummary: l, nextPaymentDue, recentActivity, hasLoans } = data;
  const mostRecentLoan = recentActivity?.[0];
  const canApply = currentUser && canApplyForLoan(currentUser.role);

  const dueSoon =
    !!nextPaymentDue && new Date(nextPaymentDue.dueDate) - Date.now() < DUE_SOON_WINDOW_MS;

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-[22px] font-medium text-foreground">My dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {currentUser?.firstName || currentUser?.username}
        </p>
      </header>

      {!hasLoans ? (
        <div className="rounded-2xl bg-tint-accent p-8 text-center">
          <h3 className="text-lg font-medium mb-2 text-foreground">Welcome, {currentUser?.firstName}!</h3>
          <p className="text-sm text-tint-accent-fg mb-6">
            You haven't applied for any loans yet. Get started with your first application.
          </p>
          <Button onClick={() => navigate('/loans')} className="min-h-[44px]">
            Apply for a loan
          </Button>
        </div>
      ) : (
        <>
          <div className={cn('rounded-[20px] p-6', dueSoon ? 'bg-status-warning-bg' : 'bg-muted')}>
            <p className={cn('text-xs mb-2', dueSoon ? 'text-status-warning-fg' : 'text-muted-foreground')}>
              {nextPaymentDue ? `Next payment · due ${formatDate(nextPaymentDue.dueDate)}` : 'Active loan amount'}
            </p>
            <p className="font-mono text-[34px] font-medium text-foreground leading-none">
              {formatCurrency(nextPaymentDue ? nextPaymentDue.amount : l.activeLoanAmount)}
            </p>
            {(nextPaymentDue?.loanNumber || mostRecentLoan?.loanNumber) && (
              <p className="text-sm text-muted-foreground mt-3">
                {nextPaymentDue?.loanNumber || mostRecentLoan?.loanNumber}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted rounded-2xl p-4 min-h-[44px]">
              <div>
                <p className="text-sm font-medium text-foreground">Active loans</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {l.activeLoans} active · {l.pendingLoans} pending
                </p>
              </div>
              <p className="font-mono text-base font-medium text-foreground">
                {formatCurrency(l.activeLoanAmount)}
              </p>
            </div>

            {mostRecentLoan && (
              <div className="flex items-center justify-between bg-status-info-bg rounded-2xl p-4 min-h-[44px]">
                <div>
                  <p className="text-sm font-medium text-foreground">Most recent loan</p>
                  <p className="font-mono text-xs text-status-info-fg mt-0.5">{mostRecentLoan.loanNumber}</p>
                </div>
                <StatusPill status={mostRecentLoan.status} />
              </div>
            )}

            {canApply && (
              <button
                type="button"
                onClick={() => navigate('/loans')}
                className="w-full flex items-center justify-between bg-nh-accent text-white rounded-2xl p-4 min-h-[44px] text-sm font-medium"
              >
                Apply for a loan
                <span aria-hidden="true">&rsaquo;</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default BorrowerDashboard;
