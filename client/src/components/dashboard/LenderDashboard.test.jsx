import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { LenderDashboard } from './LenderDashboard';

const { lenderStatsFixture } = vi.hoisted(() => ({ lenderStatsFixture: {
  lenderCompany: { name: 'Manifi Investments', type: 'lender' },
  portfolioSummary: {
    activeCompanies: 3,
    activeCorporates: 3,
    activeUsers: 40,
    totalLoans: 20,
    activeLoans: 10,
    pendingLoans: 2,
    approvedLoans: 1,
    disbursedLoans: 1,
    completedLoans: 3,
    rejectedLoans: 1,
    inArrearsLoans: 2,
    defaultedLoans: 1,
    totalLoanAmount: 100000,
    activeLoanAmount: 60000,
    pendingLoanAmount: 5000,
    totalOutstandingBalance: 40000,
    totalInterestEarned: 8000,
  },
  recentApplications: [
    {
      id: '1',
      loanNumber: 'LN20260001',
      applicantName: 'Jane Doe',
      companyName: 'TechCorp Zambia',
      amount: 5000,
      status: 'pending',
      applicationDate: '2026-07-01',
      purpose: 'School fees',
    },
  ],
  pendingApprovals: 2,
  readyForDisbursement: 1,
  needsAttention: 2,
} }));

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { success: true, data: lenderStatsFixture } }) },
}));

beforeEach(() => {
  localStorage.clear();
  seedUser({ _id: '1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
});

describe('LenderDashboard', () => {
  it('renders the Overdue KPI as the sum of in-arrears and defaulted', async () => {
    const { ui } = renderWithProviders(<LenderDashboard />);
    render(ui);

    await waitFor(() => expect(screen.getByText('Overdue')).toBeInTheDocument());
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('2 in arrears · 1 defaulted')).toBeInTheDocument();
  });

  it('shows the breakdown rows for in-arrears and defaulted with pills', async () => {
    const { ui } = renderWithProviders(<LenderDashboard />);
    render(ui);

    await waitFor(() => expect(screen.getByText('Portfolio overview')).toBeInTheDocument());
    expect(screen.getByText('In arrears')).toBeInTheDocument();
    expect(screen.getByText('Defaulted')).toBeInTheDocument();
  });
});
