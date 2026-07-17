import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBreakdownCard } from '@/components/dashboard/StatusBreakdownCard';
import { DashboardLoading, DashboardError } from '@/components/dashboard/QueryState';
import api from '@/utils/api';
import ReportModal from '@/components/reports/ReportModal';
import { TrendingUp, FileText, Download, Eye, Calendar } from 'lucide-react';
import { getCurrentUser } from '@/utils/roleUtils';

const STATUS_PILL = {
  pending_approval: 'pending_approval',
  approved: 'approved',
  active: 'active',
  disbursed: 'disbursed',
  in_arrears: 'in_arrears',
  defaulted: 'defaulted',
  completed: 'completed',
  rejected: 'rejected',
};

export default function ReportsPage() {
  const currentUser = getCurrentUser();
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', 'overview', currentUser?.role],
    queryFn: async () => {
      // Use the same endpoint as the dashboard for HR users
      const endpoint = currentUser?.role === 'employer_hr' ? '/dashboard/hr-stats' : '/reports/overview';
      const response = await api.get(endpoint);

      if (!response.data.success) {
        throw new Error('API returned unsuccessful response');
      }

      if (currentUser?.role === 'employer_hr') {
        // Transform HR dashboard data to reports format
        const hrData = response.data.data;

        // Create loans by status from HR data
        const loansByStatus = {
          pending_approval: hrData.loanSummary.pendingLoans || 0,
          approved: hrData.loanSummary.approvedLoans || 0,
          active: hrData.loanSummary.activeLoans || 0,
          completed: hrData.loanSummary.completedLoans || 0,
          rejected: hrData.loanSummary.rejectedLoans || 0
        };

        // For companies by type, we can show the user's company info
        const companiesByType = {
          [hrData.company.type]: 1 // Show 1 company of the user's company type
        };

        return {
          loansByStatus,
          companiesByType,
          monthlyLoanTrends: [],
          paymentStatus: {}
        };
      }

      // Use reports data as-is for other roles
      return response.data.data;
    },
  });

  const generateReport = async (reportType) => {
    try {
      setGenerating(true);
      const response = await api.get(`/reports/${reportType}`);
      if (response.data.success) {
        setSelectedReport({
          type: reportType,
          data: response.data.data,
          title: getReportTitle(reportType)
        });
        setShowModal(true);
      }
    } catch (err) {
      toast.error(`Failed to generate ${getReportTitle(reportType).toLowerCase()}`);
      console.error('Report generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const getReportTitle = (type) => {
    const titles = {
      'active-loans': 'Active Loans Report',
      'overdue-loans': 'Overdue Loans Report',
      'upcoming-payments': 'Upcoming Payments Report'
    };
    return titles[type] || 'Report';
  };

  if (isLoading) return <DashboardLoading label="Loading reports..." />;
  if (error || !stats) return <DashboardError message="Failed to load reports data" />;

  const loansTotal = Object.values(stats.loansByStatus).reduce((sum, count) => sum + count, 0);
  const overdueCount = (stats.loansByStatus.in_arrears || 0) + (stats.loansByStatus.defaulted || 0);
  const companiesTotal = Object.values(stats.companiesByType).reduce((sum, c) => sum + c, 0);

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-[22px] font-medium text-foreground">Reports & analytics</h1>
        <p className="text-sm text-muted-foreground mt-2">Comprehensive loan and company analytics</p>
      </header>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total loans" value={loansTotal} />
        <MetricCard label="Active loans" value={stats.loansByStatus.active || 0} tint="periwinkle" />
        <MetricCard label="Overdue" value={overdueCount} />
        <MetricCard label="Pending approval" value={stats.loansByStatus.pending_approval || 0} tint="accent" />
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <StatusBreakdownCard
          title="Loans by status"
          rows={Object.entries(stats.loansByStatus).map(([status, count]) => ({
            label: status.replace(/_/g, ' '),
            count,
            pill: STATUS_PILL[status] || status,
          }))}
        />

        <div className="rounded-2xl bg-muted p-5">
          <h3 className="text-[15px] font-medium text-foreground mb-4">Companies by type</h3>
          <div className="space-y-1">
            {Object.entries(stats.companiesByType).map(([type, count]) => {
              const percentage = companiesTotal > 0 ? (count / companiesTotal) * 100 : 0;
              return (
                <div key={type} className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground capitalize">{type} companies</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Report Generation Section */}
      <Card className="p-6 rounded-2xl">
        <h3 className="text-base font-medium text-foreground mb-6">Generate reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Loans Report */}
          <div className="border border-border rounded-2xl p-4">
            <div className="flex items-center mb-3">
              <TrendingUp className="w-4 h-4 text-status-success-fg mr-2" />
              <h4 className="text-sm font-medium text-foreground">Active loans</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Comprehensive report of all currently active loans with borrower details and payment status.
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('active-loans')}
                disabled={generating}
                className="flex items-center"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('active-loans')}
                disabled={generating}
                className="flex items-center"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Overdue Loans Report */}
          <div className="border border-border rounded-2xl p-4">
            <div className="flex items-center mb-3">
              <Calendar className="w-4 h-4 text-status-danger-fg mr-2" />
              <h4 className="text-sm font-medium text-foreground">Overdue loans</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Report of loans that are past due, including days in arrears and outstanding amounts.
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('overdue-loans')}
                disabled={generating}
                className="flex items-center"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('overdue-loans')}
                disabled={generating}
                className="flex items-center"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Upcoming Payments Report */}
          <div className="border border-border rounded-2xl p-4">
            <div className="flex items-center mb-3">
              <FileText className="w-4 h-4 text-status-info-fg mr-2" />
              <h4 className="text-sm font-medium text-foreground">Upcoming payments</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Report of loan payments due in the next 30 days for proactive collection management.
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('upcoming-payments')}
                disabled={generating}
                className="flex items-center"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateReport('upcoming-payments')}
                disabled={generating}
                className="flex items-center"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Report Modal */}
      {showModal && selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => {
            setShowModal(false);
            setSelectedReport(null);
          }}
        />
      )}
    </div>
  );
}
