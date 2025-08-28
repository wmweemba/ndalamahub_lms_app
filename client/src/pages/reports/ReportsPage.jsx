import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import ReportModal from '@/components/reports/ReportModal';
import { BarChart3, PieChart, TrendingUp, FileText, Download, Eye, Calendar } from 'lucide-react';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    loansByStatus: {},
    companiesByType: {},
    monthlyLoanTrends: [],
    paymentStatus: {}
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      const response = await api.get('/reports/overview');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      setError('Failed to load reports data');
      console.error('Reports data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportType) => {
    try {
      setLoading(true);
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
      setError(`Failed to generate ${reportType} report`);
      console.error('Report generation error:', err);
    } finally {
      setLoading(false);
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

  if (loading && !stats.loansByStatus) {
    return <div className="p-8">Loading reports...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-500 mt-2">Comprehensive loan and company analytics</p>
      </header>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Loans</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {Object.values(stats.loansByStatus).reduce((sum, count) => sum + count, 0)}
              </h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Loans</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {stats.loansByStatus.active || 0}
              </h3>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue Loans</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {(stats.loansByStatus.in_arrears || 0) + (stats.loansByStatus.defaulted || 0)}
              </h3>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Approval</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {stats.loansByStatus.pending_approval || 0}
              </h3>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <PieChart className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Loans by Status Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Loans by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.loansByStatus).map(([status, count]) => {
              const total = Object.values(stats.loansByStatus).reduce((sum, c) => sum + c, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const statusColors = {
                active: 'bg-green-500',
                pending_approval: 'bg-yellow-500',
                approved: 'bg-blue-500',
                disbursed: 'bg-purple-500',
                in_arrears: 'bg-orange-500',
                defaulted: 'bg-red-500',
                completed: 'bg-gray-500'
              };

              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{count}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${statusColors[status] || 'bg-gray-400'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-8">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Companies by Type */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Companies by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.companiesByType).map(([type, count]) => {
              const total = Object.values(stats.companiesByType).reduce((sum, c) => sum + c, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const typeColors = {
                lender: 'bg-blue-500',
                corporate: 'bg-purple-500'
              };

              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${typeColors[type] || 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {type} Companies
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{count}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${typeColors[type] || 'bg-gray-400'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-8">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Report Generation Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Generate Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Loans Report */}
          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center mb-3">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-medium text-gray-900">Active Loans</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Comprehensive report of all currently active loans with borrower details and payment status.
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('active-loans')}
                className="flex items-center"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('active-loans')}
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Overdue Loans Report */}
          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center mb-3">
              <Calendar className="w-5 h-5 text-red-600 mr-2" />
              <h4 className="font-medium text-gray-900">Overdue Loans</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Report of loans that are past due, including days in arrears and outstanding amounts.
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('overdue-loans')}
                className="flex items-center"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('overdue-loans')}
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Upcoming Payments Report */}
          <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center mb-3">
              <FileText className="w-5 h-5 text-blue-600 mr-2" />
              <h4 className="font-medium text-gray-900">Upcoming Payments</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Report of loan payments due in the next 30 days for proactive collection management.
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('upcoming-payments')}
                className="flex items-center"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateReport('upcoming-payments')}
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
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
