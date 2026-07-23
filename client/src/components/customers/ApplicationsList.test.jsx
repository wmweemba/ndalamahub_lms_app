import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { ApplicationsList } from './ApplicationsList';

const { applicationsFixture } = vi.hoisted(() => ({
  applicationsFixture: [
    {
      _id: 'app-1',
      reference: 'REF-001',
      status: 'pending',
      applicant: { fullName: 'Chanda Mwansa', nrc: '111111/10/1', phone: '+260970000010', email: '' },
      loanRequest: { amount: 3000, purpose: 'School fees', termDays: 30 },
      collateral: { type: 'vehicle' },
      source: 'website',
      createdAt: '2026-07-20',
      dedupe: null,
    },
  ],
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.startsWith('/customer-applications')) {
        return Promise.resolve({ data: { success: true, data: { applications: applicationsFixture } } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe('ApplicationsList', () => {
  it('renders queue fixtures with status pills', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const { ui } = renderWithProviders(<ApplicationsList />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('Chanda Mwansa').length).toBeGreaterThan(0));
    expect(screen.getAllByText('111111/10/1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0);
  });
});
