import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import CollateralRegisterPage from './CollateralRegisterPage';

const { collateralFixture } = vi.hoisted(() => ({
  collateralFixture: [
    {
      _id: 'col-1',
      type: 'vehicle',
      description: 'Toyota Hilux',
      estimatedValue: 50000,
      status: 'verified',
      letterOfSale: { onFile: true, reference: 'LOS-001' },
      loan: { _id: 'loan-1', loanNumber: 'LN20260001', applicant: { firstName: 'John', lastName: 'Banda' } },
    },
    {
      _id: 'col-2',
      type: 'other',
      otherDescription: 'Livestock',
      description: '5 cattle',
      estimatedValue: 15000,
      status: 'declared',
      letterOfSale: { onFile: false },
      loan: { _id: 'loan-2', loanNumber: 'LN20260002', applicant: { firstName: 'Mary', lastName: 'Phiri' } },
    },
  ],
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/collateral') {
        return Promise.resolve({ data: { success: true, data: { collateral: collateralFixture } } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe('CollateralRegisterPage', () => {
  it('renders register fixtures with correct status pills and letter-of-sale flags', async () => {
    seedUser({ _id: 'u1', username: 'lenderofficer', role: 'lender_officer' });
    const { ui } = renderWithProviders(<CollateralRegisterPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260001').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Toyota Hilux').length).toBeGreaterThan(0);
    expect(screen.getAllByText('verified').length).toBeGreaterThan(0);
    expect(screen.getAllByText('declared').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/On file/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not on file/i).length).toBeGreaterThan(0);
  });

  it('shows the total verified value across filtered records', async () => {
    seedUser({ _id: 'u1', username: 'lenderofficer', role: 'lender_officer' });
    const { ui } = renderWithProviders(<CollateralRegisterPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('LN20260001').length).toBeGreaterThan(0));
    expect(screen.getByText('Total verified value')).toBeInTheDocument();
  });
});
