import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { EmployerDashboard } from './EmployerDashboard';

const { hrStatsFixture } = vi.hoisted(() => ({ hrStatsFixture: {
  company: { name: 'TechCorp Zambia', type: 'corporate', totalEmployees: 50 },
  loanSummary: {
    totalLoans: 15,
    pendingLoans: 4,
    approvedLoans: 2,
    activeLoans: 6,
    rejectedLoans: 1,
    completedLoans: 1,
    inArrearsLoans: 2,
    defaultedLoans: 1,
    totalLoanAmount: 70000,
    pendingLoanAmount: 8000,
    activeLoanAmount: 30000,
    totalOutstandingBalance: 20000,
    totalInterestEarned: 4000,
  },
  employeeStats: {
    totalEmployees: 50,
    employeesWithLoans: 15,
    employeesWithoutLoans: 35,
    roleDistribution: { borrower: 50 },
  },
  recentApplications: [],
  pendingApprovals: 4,
  needsAttention: 4,
} }));

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { success: true, data: hrStatsFixture } }) },
}));

beforeEach(() => {
  localStorage.clear();
  seedUser({ _id: '1', username: 'hruser', role: 'employer_hr', firstName: 'Henry' });
});

describe('EmployerDashboard', () => {
  it('renders pending approvals and the arrears breakdown rows', async () => {
    const { ui } = renderWithProviders(<EmployerDashboard />);
    render(ui);

    await waitFor(() => expect(screen.getByText('Pending approvals')).toBeInTheDocument());
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.getByText('In arrears')).toBeInTheDocument();
    expect(screen.getByText('Defaulted')).toBeInTheDocument();
  });
});
