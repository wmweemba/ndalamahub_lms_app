import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';

export default function DashboardPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [adminStats, setAdminStats] = useState({
    activeLoans: 0,
    activeCompanies: 0,
    activeCorporates: 0,
    activeUsers: 0,
    totalLoanAmount: 0
  });
  const [lenderStats, setLenderStats] = useState({
    lenderCompany: { name: '', type: '' },
    portfolioSummary: {
      activeCompanies: 0,
      activeCorporates: 0,
      activeUsers: 0,
      totalLoans: 0,
      activeLoans: 0,
      pendingLoans: 0,
      approvedLoans: 0,
      disbursedLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
      totalLoanAmount: 0,
      activeLoanAmount: 0,
      pendingLoanAmount: 0
    },
    recentApplications: [],
    pendingApprovals: 0,
    readyForDisbursement: 0,
    needsAttention: 0
  });
  const [hrStats, setHrStats] = useState({
    company: { name: '', type: '', totalEmployees: 0 },
    loanSummary: {
      totalLoans: 0,
      pendingLoans: 0,
      approvedLoans: 0,
      activeLoans: 0,
      rejectedLoans: 0,
      completedLoans: 0,
      totalLoanAmount: 0,
      pendingLoanAmount: 0,
      activeLoanAmount: 0
    },
    employeeStats: {
      totalEmployees: 0,
      employeesWithLoans: 0,
      employeesWithoutLoans: 0,
      roleDistribution: {}
    },
    recentApplications: [],
    pendingApprovals: 0,
    needsAttention: 0
  });
  const [userStats, setUserStats] = useState({
    loanSummary: {
      totalLoans: 0,
      activeLoans: 0,
      pendingLoans: 0,
      approvedLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
      totalLoanAmount: 0,
      activeLoanAmount: 0,
      pendingLoanAmount: 0
    },
    recentActivity: [],
    nextPaymentDue: null,
    hasLoans: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check user role
  const isAdmin = currentUser && currentUser.role === ROLES.SUPER_USER;
  const isLenderAdmin = currentUser && currentUser.role === ROLES.LENDER_ADMIN;

  const isHROrCorporateAdmin = currentUser && [
    ROLES.CORPORATE_HR,
    ROLES.CORPORATE_ADMIN
  ].includes(currentUser.role);
  
  const isCorporateUser = currentUser && currentUser.role === ROLES.CORPORATE_USER;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (isAdmin) {
          // Fetch admin dashboard stats (super user only)
          const response = await api.get('/dashboard/stats');
          if (response.data.success && response.data.data) {
            setAdminStats(response.data.data);
          } else {
            setError('Invalid response format from server');
          }
        } else if (isLenderAdmin) {
          // Fetch lender admin dashboard stats
          const response = await api.get('/dashboard/lender-stats');
          if (response.data.success && response.data.data) {
            setLenderStats(response.data.data);
          } else {
            setError('Invalid response format from server');
          }
        } else if (isHROrCorporateAdmin) {
          // Fetch HR dashboard stats for both corporate_hr and corporate_admin
          const response = await api.get('/dashboard/hr-stats');
          if (response.data.success && response.data.data) {
            setHrStats(response.data.data);
          } else {
            setError('Invalid response format from server');
          }
        } else if (isCorporateUser) {
          // Fetch user-specific dashboard stats
          const response = await api.get('/dashboard/user-stats');
          if (response.data.success && response.data.data) {
            setUserStats(response.data.data);
          } else {
            setError('Invalid response format from server');
          }
        }
      } catch (err) {
        setError('Failed to load dashboard statistics');
        console.error('Dashboard stats error:', err);
        console.error('Error details:', err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin, isLenderAdmin, isHROrCorporateAdmin, isCorporateUser]);

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  // Render admin dashboard (super user only)
  if (isAdmin) {
    return (
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Administrator Dashboard</h1>
          <p className="text-gray-500 mt-2">Welcome to your NdalamaHub system dashboard</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Companies Card */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Companies</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {adminStats.activeCompanies}
                </h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-blue-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {adminStats.activeCorporates} corporate clients
              </p>
            </div>
          </Card>

          {/* Active Loans Card */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {adminStats.activeLoans}
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Total: K{adminStats.totalLoanAmount.toLocaleString()}
              </p>
            </div>
          </Card>

          {/* Active Users Card */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {adminStats.activeUsers}
                </h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-purple-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Across all companies
              </p>
            </div>
          </Card>

          {/* System Health Card */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  Active
                </h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-emerald-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                All services operational
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Render lender admin dashboard
  if (isLenderAdmin) {
    if (!lenderStats.lenderCompany) {
      return (
        <div className="p-8">
          <div className="text-center">Loading lender dashboard...</div>
        </div>
      );
    }

    return (
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lender Portfolio Dashboard</h1>
          <p className="text-gray-500 mt-2">
            Welcome, {currentUser?.firstName}! Manage your lending portfolio at {lenderStats.lenderCompany.name}
          </p>
        </header>

        {/* Portfolio Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Active Corporate Clients */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Companies</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {lenderStats.portfolioSummary.activeCompanies}
                </h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-blue-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {lenderStats.portfolioSummary.activeCorporates} corporate clients
              </p>
            </div>
          </Card>

          {/* Active Loans */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {lenderStats.portfolioSummary.activeLoans}
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Total: K{lenderStats.portfolioSummary.totalLoanAmount.toLocaleString()}
              </p>
            </div>
          </Card>

          {/* Active Users */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {lenderStats.portfolioSummary.activeUsers}
                </h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-purple-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Across all client companies
              </p>
            </div>
          </Card>

          {/* Pending Actions */}
          <Card className="p-6 bg-orange-50 shadow-lg rounded-lg border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Needs Attention</p>
                <h3 className="text-2xl font-bold text-orange-900 mt-1">
                  {lenderStats.needsAttention}
                </h3>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-orange-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-orange-700">
                {lenderStats.readyForDisbursement} ready for disbursement
              </p>
            </div>
          </Card>
        </div>

        {/* Portfolio Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Loan Portfolio Breakdown */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Loans</span>
                <span className="text-lg font-semibold text-gray-900">
                  {lenderStats.portfolioSummary.totalLoans}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending Review</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-orange-600 mr-2">
                    {lenderStats.portfolioSummary.pendingLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ 
                        width: `${lenderStats.portfolioSummary.totalLoans > 0 ? (lenderStats.portfolioSummary.pendingLoans / lenderStats.portfolioSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Approved</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600 mr-2">
                    {lenderStats.portfolioSummary.approvedLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${lenderStats.portfolioSummary.totalLoans > 0 ? (lenderStats.portfolioSummary.approvedLoans / lenderStats.portfolioSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-blue-600 mr-2">
                    {lenderStats.portfolioSummary.activeLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ 
                        width: `${lenderStats.portfolioSummary.totalLoans > 0 ? (lenderStats.portfolioSummary.activeLoans / lenderStats.portfolioSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 mr-2">
                    {lenderStats.portfolioSummary.completedLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-500 h-2 rounded-full"
                      style={{ 
                        width: `${lenderStats.portfolioSummary.totalLoans > 0 ? (lenderStats.portfolioSummary.completedLoans / lenderStats.portfolioSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="space-y-4">
              <Button 
                onClick={() => navigate('/loans')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Disburse Approved Loans ({lenderStats.readyForDisbursement})
              </Button>
              
              <Button 
                onClick={() => navigate('/loans')}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View All Portfolio Loans
              </Button>

              <Button 
                onClick={() => navigate('/companies')}
                variant="outline"
                className="w-full border-green-600 text-green-600 hover:bg-green-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Manage Corporate Clients
              </Button>

              <Button 
                onClick={() => navigate('/reports')}
                variant="outline"
                className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Portfolio Reports
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent Applications */}
        {lenderStats.recentApplications.length > 0 && (
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Loan Applications</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Loan #</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Applicant</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Purpose</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {lenderStats.recentApplications.map((loan) => (
                    <tr key={loan.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-sm text-gray-900">{loan.loanNumber}</td>
                      <td className="py-2 text-sm text-gray-900">{loan.applicantName}</td>
                      <td className="py-2 text-sm text-gray-700">{loan.companyName}</td>
                      <td className="py-2 text-sm text-gray-900">K{loan.amount.toLocaleString()}</td>
                      <td className="py-2 text-sm text-gray-700">{loan.purpose}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          loan.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                          loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-gray-700">
                        {new Date(loan.applicationDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Render HR/Corporate Admin dashboard
  if (isHROrCorporateAdmin) {
    return (
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentUser.role === ROLES.CORPORATE_ADMIN ? 'Corporate Admin Dashboard' : 'HR Dashboard'}
          </h1>
          <p className="text-gray-500 mt-2">
            Welcome, {currentUser?.firstName}! Manage {hrStats.company.name} employees and loan applications.
          </p>
        </header>

        {/* Company Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Company Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Employees */}
            <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {hrStats.employeeStats.totalEmployees}
                  </h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  {hrStats.employeeStats.employeesWithLoans} with loans
                </p>
              </div>
            </Card>

            {/* Pending Approvals */}
            <Card className="p-6 bg-orange-50 shadow-lg rounded-lg border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Pending Approvals</p>
                  <h3 className="text-2xl font-bold text-orange-900 mt-1">
                    {hrStats.pendingApprovals}
                  </h3>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-orange-700">
                  Requiring your attention
                </p>
              </div>
            </Card>

            {/* Total Loans */}
            <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Loans</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {hrStats.loanSummary.totalLoans}
                  </h3>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  K{hrStats.loanSummary.totalLoanAmount.toLocaleString()} total
                </p>
              </div>
            </Card>

            {/* Active Loans */}
            <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Loans</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">
                    {hrStats.loanSummary.activeLoans}
                  </h3>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  K{hrStats.loanSummary.activeLoanAmount.toLocaleString()} active
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Loan Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Loan Status Breakdown */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Loan Status Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending Review</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-orange-600 mr-2">
                    {hrStats.loanSummary.pendingLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ 
                        width: `${hrStats.loanSummary.totalLoans > 0 ? (hrStats.loanSummary.pendingLoans / hrStats.loanSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Approved</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600 mr-2">
                    {hrStats.loanSummary.approvedLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${hrStats.loanSummary.totalLoans > 0 ? (hrStats.loanSummary.approvedLoans / hrStats.loanSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-blue-600 mr-2">
                    {hrStats.loanSummary.activeLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ 
                        width: `${hrStats.loanSummary.totalLoans > 0 ? (hrStats.loanSummary.activeLoans / hrStats.loanSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 mr-2">
                    {hrStats.loanSummary.completedLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gray-500 h-2 rounded-full"
                      style={{ 
                        width: `${hrStats.loanSummary.totalLoans > 0 ? (hrStats.loanSummary.completedLoans / hrStats.loanSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rejected</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-red-600 mr-2">
                    {hrStats.loanSummary.rejectedLoans}
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ 
                        width: `${hrStats.loanSummary.totalLoans > 0 ? (hrStats.loanSummary.rejectedLoans / hrStats.loanSummary.totalLoans) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="space-y-4">
              <Button 
                onClick={() => navigate('/loans')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Review Pending Loans ({hrStats.pendingApprovals})
              </Button>
              
              <Button 
                onClick={() => navigate('/loans')}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View All Company Loans
              </Button>

              <Button 
                onClick={() => navigate('/settings')}
                variant="outline"
                className="w-full border-green-600 text-green-600 hover:bg-green-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Manage Employees
              </Button>

              <Button 
                onClick={() => navigate('/reports')}
                variant="outline"
                className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 justify-start"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Reports
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent Applications */}
        {hrStats.recentApplications.length > 0 && (
          <div className="mt-8">
            <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Loan Applications</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Loan #</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Employee</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Amount</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Purpose</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hrStats.recentApplications.map((loan) => (
                      <tr key={loan.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 text-sm text-gray-900">{loan.loanNumber}</td>
                        <td className="py-2 text-sm text-gray-900">{loan.applicantName}</td>
                        <td className="py-2 text-sm text-gray-900">K{loan.amount.toLocaleString()}</td>
                        <td className="py-2 text-sm text-gray-700">{loan.purpose}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            loan.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                            loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                            loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            loan.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="py-2 text-sm text-gray-700">
                          {new Date(loan.applicationDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Render user dashboard (isCorporateUser)
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Welcome back, {currentUser?.firstName || currentUser?.username}! Here's your loan overview.
        </p>
      </header>

      {!userStats.hasLoans ? (
        // No loans - Show getting started card
        <div className="max-w-md mx-auto">
          <Card className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg rounded-lg border-2 border-blue-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/loans')}>
            <div className="text-center">
              <div className="p-4 bg-blue-100 rounded-full inline-block mb-4">
                <svg 
                  className="w-8 h-8 text-blue-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Get Started with Your First Loan
              </h3>
              <p className="text-gray-600 mb-6">
                You haven't applied for any loans yet. Click here to start your loan application process.
              </p>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/loans');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                Apply for Loan
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        // Has loans - Show loan dashboard
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* My Loans Overview */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Loans</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {userStats.loanSummary.totalLoans}
                </h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-blue-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Active: {userStats.loanSummary.activeLoans}</span>
                <span>Pending: {userStats.loanSummary.pendingLoans}</span>
              </div>
            </div>
          </Card>

          {/* Active Loans Amount */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Amount</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  K{userStats.loanSummary.activeLoanAmount.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-green-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Total borrowed: K{userStats.loanSummary.totalLoanAmount.toLocaleString()}
            </div>
          </Card>

          {/* Loan Status Summary */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Loan Status</p>
                <h3 className="text-lg font-bold text-gray-900">
                  Overview
                </h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg 
                  className="w-6 h-6 text-purple-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Approved:</span>
                <span className="font-medium">{userStats.loanSummary.approvedLoans}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-medium">{userStats.loanSummary.completedLoans}</span>
              </div>
              <div className="flex justify-between">
                <span>Rejected:</span>
                <span className="font-medium">{userStats.loanSummary.rejectedLoans}</span>
              </div>
            </div>
          </Card>

          {/* Next Payment Due */}
          {userStats.nextPaymentDue && (
            <Card className="p-6 bg-orange-50 shadow-lg rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-orange-600">Next Payment Due</p>
                  <h3 className="text-2xl font-bold text-orange-900">
                    K{userStats.nextPaymentDue.amount.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg 
                    className="w-6 h-6 text-orange-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-sm text-orange-700">
                <div>Loan: {userStats.nextPaymentDue.loanNumber}</div>
                <div>Due: {new Date(userStats.nextPaymentDue.dueDate).toLocaleDateString()}</div>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="p-6 bg-white shadow-lg rounded-lg border border-gray-200">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Actions</h3>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/loans')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                View All Loans
              </Button>
              <Button 
                onClick={() => navigate('/loans')}
                variant="outline"
                className="w-full border-green-600 text-green-600 hover:bg-green-50"
              >
                Apply for New Loan
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}