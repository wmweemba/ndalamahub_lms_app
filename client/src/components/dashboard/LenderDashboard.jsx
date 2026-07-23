import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { formatCurrency, formatDate } from '@/lib/format';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBreakdownCard } from '@/components/dashboard/StatusBreakdownCard';
import { StatusPill } from '@/components/ui/status-pill';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';
import { Button } from '@/components/ui/button';

export function LenderDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'lender-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/lender-stats');
      return res.data.data;
    },
  });

  // Shared with AppLayout's ['current-user-profile'] query (same key, same
  // 1h staleTime) — resolves whether this lender is direct-model without an
  // extra request in the real app; only direct-model lenders get website
  // applications feeding the pending-applications KPI.
  const { data: profile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: () => api.get('/auth/me').then((res) => res.data.data.user),
    staleTime: 60 * 60 * 1000,
  });
  const isDirectModel = profile?.company?.lendingModel === 'direct';

  const { data: pendingApplications = [] } = useQuery({
    queryKey: ['customer-applications', 'pending'],
    queryFn: async () => {
      const res = await api.get('/customer-applications?status=pending');
      return res.data.data.applications;
    },
    enabled: isDirectModel,
  });

  if (isLoading) return <DashboardLoading label="Loading portfolio dashboard..." />;
  if (error || !data) return <DashboardError />;

  const { lenderCompany, portfolioSummary: p, recentApplications, readyForDisbursement } = data;
  const overdue = p.inArrearsLoans + p.defaultedLoans;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-medium">Welcome back, {currentUser?.firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lenderCompany.name} portfolio · {currentUser?.role === 'lender_officer' ? 'lender officer' : 'lender admin'}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCard
          label="Active portfolio"
          value={formatCurrency(p.activeLoanAmount)}
          sub={`Total: ${formatCurrency(p.totalLoanAmount)}`}
        />
        <MetricCard label="Active loans" value={p.activeLoans} sub="performing" tint="periwinkle" />
        <MetricCard
          label="Overdue"
          value={overdue}
          sub={`${p.inArrearsLoans} in arrears · ${p.defaultedLoans} defaulted`}
        />
        <MetricCard
          label="Pending applications"
          value={p.pendingLoans}
          sub={
            isDirectModel
              ? `${readyForDisbursement} ready to disburse · ${pendingApplications.length} from website`
              : `${readyForDisbursement} ready to disburse`
          }
          tint="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 mb-5">
        <StatusBreakdownCard
          title="Portfolio overview"
          rows={[
            { label: 'Pending', count: p.pendingLoans, pill: 'pending' },
            { label: 'Approved', count: p.approvedLoans, pill: 'approved' },
            { label: 'Active', count: p.activeLoans, pill: 'active' },
            { label: 'In arrears', count: p.inArrearsLoans, pill: 'in_arrears' },
            { label: 'Defaulted', count: p.defaultedLoans, pill: 'defaulted' },
            { label: 'Completed', count: p.completedLoans, pill: 'completed' },
            { label: 'Rejected', count: p.rejectedLoans, pill: 'rejected' },
          ]}
        />

        <div className="rounded-2xl bg-muted p-5">
          <h3 className="text-[15px] font-medium mb-4">Quick actions</h3>
          <div className="space-y-3">
            <Button className="w-full justify-start" onClick={() => navigate('/loans')}>
              Disburse approved loans ({readyForDisbursement})
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/loans')}>
              View portfolio loans
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/companies')}>
              Manage employers
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/reports')}>
              Generate reports
            </Button>
          </div>
          <div className="mt-5 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding balance</span>
              <span className="font-mono font-medium">{formatCurrency(p.totalOutstandingBalance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total interest earned</span>
              <span className="font-mono font-medium">{formatCurrency(p.totalInterestEarned)}</span>
            </div>
          </div>
        </div>
      </div>

      {recentApplications.length > 0 && (
        <div className="rounded-2xl bg-muted p-5">
          <h3 className="text-[15px] font-medium mb-4">Recent loan applications</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Loan #</th>
                  <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Applicant</th>
                  <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Company</th>
                  <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((loan) => (
                  <tr key={loan.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 text-sm font-mono">{loan.loanNumber}</td>
                    <td className="py-2 pr-3 text-sm">{loan.applicantName}</td>
                    <td className="py-2 pr-3 text-sm text-muted-foreground">{loan.companyName}</td>
                    <td className="py-2 pr-3 text-sm font-mono text-right">{formatCurrency(loan.amount)}</td>
                    <td className="py-2 pr-3"><StatusPill status={loan.status} /></td>
                    <td className="py-2 text-sm text-muted-foreground">{formatDate(loan.applicationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LenderDashboard;
