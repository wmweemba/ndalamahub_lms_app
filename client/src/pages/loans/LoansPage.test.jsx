import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import LoansPage from './LoansPage';

const { loansFixture } = vi.hoisted(() => ({
  loansFixture: [
    {
      _id: 'loan-1',
      loanNumber: 'LN20260001',
      applicant: { firstName: 'Jane', lastName: 'Doe', email: 'jane@techcorp.zm' },
      company: { _id: 'company-1', name: 'TechCorp Zambia' },
      product: { name: 'Payday Advance', category: 'payday' },
      amount: 5000,
      term: 30,
      termUnit: 'days',
      status: 'pending',
      applicationDate: '2026-07-01',
    },
    {
      _id: 'loan-2',
      loanNumber: 'LN20260002',
      applicant: { firstName: 'John', lastName: 'Banda', email: 'john@techcorp.zm' },
      company: { _id: 'company-1', name: 'TechCorp Zambia' },
      product: { name: 'Personal Loan', category: 'personal' },
      amount: 12000,
      term: 6,
      status: 'active',
      applicationDate: '2026-06-01',
      rolloverCount: 2,
    },
  ],
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/loans') {
        return Promise.resolve({ data: { success: true, data: { loans: loansFixture } } });
      }
      if (url === '/companies') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe('LoansPage', () => {
  it('renders rows from fixture loans with correct term units', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    const { ui } = renderWithProviders(<LoansPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260001').length).toBeGreaterThan(0));
    expect(screen.getAllByText('30 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6 months').length).toBeGreaterThan(0);
  });

  it('shows a "Rolled over" pill on a loan with a positive rolloverCount', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    const { ui } = renderWithProviders(<LoansPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260002').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Rolled over ×2').length).toBeGreaterThan(0);
  });

  it('shows "Apply for a loan" for a borrower and hides it for a lender_admin', async () => {
    seedUser({ _id: 'u2', username: 'borrower1', role: 'borrower', firstName: 'Ben' });
    const { ui } = renderWithProviders(<LoansPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260001').length).toBeGreaterThan(0));
    expect(screen.getByText('Apply for a loan')).toBeInTheDocument();
  });

  it('hides the apply button and shows the company filter for a lender_admin', async () => {
    seedUser({ _id: 'u3', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    const { ui } = renderWithProviders(<LoansPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260001').length).toBeGreaterThan(0));
    expect(screen.queryByText('Apply for a loan')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
  });
});
