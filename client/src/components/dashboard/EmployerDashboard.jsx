import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';
import { formatCurrency, formatDate } from '@/lib/format';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBreakdownCard } from '@/components/dashboard/StatusBreakdownCard';
import { StatusPill } from '@/components/ui/status-pill';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';
import { Button } from '@/components/ui/button';

export function EmployerDashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'hr-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/hr-stats');
      return res.data.data;
    },
  });

  if (isLoading) return <DashboardLoading label="Loading dashboard..." />;
  if (error || !data) return <DashboardError />;

  const { company, loanSummary: l, employeeStats, recentApplications, pendingApprovals } = data;
  const heading = currentUser?.role === ROLES.EMPLOYER_ADMIN ? 'Employer admin dashboard' : 'HR dashboard';

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-medium">{heading}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, {currentUser?.firstName} · {company.name} employees and loan applications
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCard
          label="Total employees"
          value={employeeStats.totalEmployees}
          sub={`${employeeStats.employeesWithLoans} with loans`}
        />
        <MetricCard label="Outstanding balance" value={formatCurrency(l.totalOutstandingBalance)} tint="periwinkle" />
        <MetricCard label="Pending approvals" value={pendingApprovals} sub="Requiring your attention" tint="accent" />
        <MetricCard label="Active loans" value={l.activeLoans} sub={formatCurrency(l.activeLoanAmount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 mb-5">
        <StatusBreakdownCard
          title="Loan status overview"
          rows={[
            { label: 'Pending', count: l.pendingLoans, pill: 'pending' },
            { label: 'Approved', count: l.approvedLoans, pill: 'approved' },
            { label: 'Active', count: l.activeLoans, pill: 'active' },
            { label: 'In arrears', count: l.inArrearsLoans, pill: 'in_arrears' },
            { label: 'Defaulted', count: l.defaultedLoans, pill: 'defaulted' },
            { label: 'Completed', count: l.completedLoans, pill: 'completed' },
            { label: 'Rejected', count: l.rejectedLoans, pill: 'rejected' },
          ]}
        />

        <div className="rounded-2xl bg-muted p-5">
          <h3 className="text-[15px] font-medium mb-4">Quick actions</h3>
          <div className="space-y-3">
            <Button className="w-full justify-start" onClick={() => navigate('/loans')}>
              Review pending loans ({pendingApprovals})
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/loans')}>
              View company loans
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/settings')}>
              Manage employees
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/reports')}>
              Generate reports
            </Button>
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total interest earned</span>
              <span className="font-mono font-medium">{formatCurrency(l.totalInterestEarned)}</span>
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
                  <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Employee</th>
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

export default EmployerDashboard;
