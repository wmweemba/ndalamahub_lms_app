import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { BorrowerDashboard } from './BorrowerDashboard';

const { withLoansFixture, noLoansFixture } = vi.hoisted(() => ({
  withLoansFixture: {
    loanSummary: {
      totalLoans: 2,
      activeLoans: 1,
      pendingLoans: 1,
      approvedLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
      totalLoanAmount: 7500,
      activeLoanAmount: 5000,
      pendingLoanAmount: 2500,
    },
    recentActivity: [
      { id: '1', loanNumber: 'LN20260011', amount: 2500, status: 'pending_approval', applicationDate: '2026-07-17', purpose: 'School fees' },
      { id: '2', loanNumber: 'LN20260007', amount: 5000, status: 'active', applicationDate: '2026-06-01', purpose: 'Business' },
    ],
    nextPaymentDue: { amount: 850, dueDate: '2026-07-20', loanNumber: 'LN20260007' },
    hasLoans: true,
  },
  noLoansFixture: {
    loanSummary: {
      totalLoans: 0,
      activeLoans: 0,
      pendingLoans: 0,
      approvedLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
      totalLoanAmount: 0,
      activeLoanAmount: 0,
      pendingLoanAmount: 0,
    },
    recentActivity: [],
    nextPaymentDue: null,
    hasLoans: false,
  },
}));

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/utils/api';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  seedUser({ _id: '1', username: 'borrower1', role: 'borrower', firstName: 'Mulenga' });
});

describe('BorrowerDashboard', () => {
  it('renders the hero amount and label from nextPaymentDue', async () => {
    api.get.mockResolvedValue({ data: { data: withLoansFixture } });
    const { ui } = renderWithProviders(<BorrowerDashboard />);
    render(ui);

    await waitFor(() => expect(screen.getByText(/Next payment · due/)).toBeInTheDocument());
    const amount = screen.getByText('K850');
    expect(amount.className).toMatch(/font-mono/);
    expect(screen.getByText('LN20260007')).toBeInTheDocument();
  });

  it('renders the welcome state with one primary CTA when there are no loans', async () => {
    api.get.mockResolvedValue({ data: { data: noLoansFixture } });
    const { ui } = renderWithProviders(<BorrowerDashboard />);
    render(ui);

    await waitFor(() => expect(screen.getByText(/Welcome, Mulenga/)).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /apply for a loan/i })).toHaveLength(1);
    expect(screen.queryByText(/Next payment/)).not.toBeInTheDocument();
  });
});
