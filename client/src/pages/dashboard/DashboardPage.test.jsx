import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import DashboardPage from './DashboardPage';

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          lenderCompany: { name: 'Manifi Investments', type: 'lender' },
          portfolioSummary: {
            activeCompanies: 1,
            activeCorporates: 1,
            activeUsers: 1,
            totalLoans: 0,
            activeLoans: 0,
            pendingLoans: 0,
            approvedLoans: 0,
            disbursedLoans: 0,
            completedLoans: 0,
            rejectedLoans: 0,
            inArrearsLoans: 0,
            defaultedLoans: 0,
            totalLoanAmount: 0,
            activeLoanAmount: 0,
            pendingLoanAmount: 0,
            totalOutstandingBalance: 0,
            totalInterestEarned: 0,
          },
          recentApplications: [],
          pendingApprovals: 0,
          readyForDisbursement: 0,
          needsAttention: 0,
        },
      },
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe('DashboardPage role switch', () => {
  it('renders LenderDashboard for a seeded lender_officer', async () => {
    seedUser({ _id: '1', username: 'officer1', role: 'lender_officer', firstName: 'Owen' });
    const { ui } = renderWithProviders(<DashboardPage />);
    render(ui);

    await waitFor(() => expect(screen.getByText(/Manifi Investments portfolio/i)).toBeInTheDocument());
  });
});
