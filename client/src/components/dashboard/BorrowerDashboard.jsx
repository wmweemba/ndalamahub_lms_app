import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { formatCurrency, formatDate } from '@/lib/format';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';
import { Button } from '@/components/ui/button';

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

  const { loanSummary: l, nextPaymentDue, hasLoans } = data;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-medium">My dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {currentUser?.firstName || currentUser?.username} — here's your loan overview
        </p>
      </header>

      {!hasLoans ? (
        <div className="max-w-md mx-auto rounded-2xl bg-tint-accent p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Welcome, {currentUser?.firstName}!</h3>
          <p className="text-sm text-tint-accent-fg mb-6">
            You haven't applied for any loans yet. Get started with your first application.
          </p>
          <Button onClick={() => navigate('/loans')}>Apply for a loan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Total loans"
            value={l.totalLoans}
            sub={`Active: ${l.activeLoans} · Pending: ${l.pendingLoans}`}
          />
          <MetricCard
            label="Active amount"
            value={formatCurrency(l.activeLoanAmount)}
            sub={`Total borrowed: ${formatCurrency(l.totalLoanAmount)}`}
            tint="periwinkle"
          />
          <MetricCard
            label="Loan status"
            value={l.approvedLoans}
            sub={`Completed: ${l.completedLoans} · Rejected: ${l.rejectedLoans}`}
          />

          {nextPaymentDue && (
            <MetricCard
              label="Next payment due"
              value={formatCurrency(nextPaymentDue.amount)}
              sub={`${nextPaymentDue.loanNumber} · due ${formatDate(nextPaymentDue.dueDate)}`}
              tint="accent"
            />
          )}

          <div className="rounded-2xl bg-muted p-5">
            <h3 className="text-[15px] font-medium mb-4">Quick actions</h3>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate('/loans')}>View all loans</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/loans')}>Apply for new loan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BorrowerDashboard;
