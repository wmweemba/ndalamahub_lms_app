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

  // Check if user has admin access
  const isAdmin = currentUser && [
    ROLES.SUPER_USER,
    ROLES.LENDER_ADMIN,
    ROLES.CORPORATE_ADMIN,
    ROLES.CORPORATE_HR
  ].includes(currentUser.role);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (isAdmin) {
          // Fetch admin dashboard stats
          const response = await api.get('/dashboard/stats');
          if (response.data.success && response.data.data) {
            setAdminStats(response.data.data);
          } else {
            setError('Invalid response format from server');
          }
        } else {
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
  }, [isAdmin]);

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  // Render admin dashboard
  if (isAdmin) {
    return (
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-2">Welcome to your NdalamaHub dashboard</p>
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

  // Render user dashboard
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