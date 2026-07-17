import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { formatCurrency } from '@/lib/format';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';

export function PlatformDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
  });

  if (isLoading) return <DashboardLoading label="Loading system dashboard..." />;
  if (error || !data) return <DashboardError />;

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-medium">System administrator dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide overview</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Active companies"
          value={data.activeCompanies}
          sub={`${data.activeCorporates} employer clients`}
        />
        <MetricCard label="Active loans" value={data.activeLoans} sub={formatCurrency(data.totalLoanAmount)} tint="periwinkle" />
        <MetricCard label="Active users" value={data.activeUsers} sub="Across all companies" />
      </div>
    </div>
  );
}

export default PlatformDashboard;
