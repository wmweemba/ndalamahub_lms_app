import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser, renderWithProviders } from '@/test/utils';
import { ApplicationDetailDialog } from './ApplicationDetailDialog';

const putMock = vi.hoisted(() => vi.fn().mockResolvedValue({
  data: { success: true, data: { loan: { loanNumber: 'LN20260099' } } },
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: putMock,
  },
}));

const baseApplication = {
  _id: 'app-1',
  status: 'pending',
  applicant: {
    fullName: 'Chanda Mwansa',
    nrc: '111111/10/1',
    phone: '+260970000010',
    email: '',
    address: 'Lusaka',
    employmentStatus: 'self-employed',
  },
  loanRequest: { amount: 3000, purpose: 'School fees', termDays: 30 },
  collateral: { type: 'vehicle', estimatedValue: 10000, description: '2015 Toyota' },
  source: 'website',
  createdAt: '2026-07-20',
  dedupe: null,
};

beforeEach(() => {
  localStorage.clear();
  putMock.mockClear();
});

describe('ApplicationDetailDialog', () => {
  it('shows the dedupe banner when the API returns a match', () => {
    seedUser({ _id: 'u1', username: 'officer1', role: 'lender_officer' });
    const withDedupe = { ...baseApplication, dedupe: { matchType: 'nrc', userId: 'user-1', name: 'Existing Customer' } };
    const { ui } = renderWithProviders(
      <ApplicationDetailDialog application={withDedupe} open={true} onClose={vi.fn()} />
    );
    render(ui);

    expect(screen.getByText(/Possible existing customer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Existing Customer/).length).toBeGreaterThan(0);
  });

  it('sends attachToUserId when the officer chooses to attach to the matched customer', async () => {
    const user = userEvent.setup();
    seedUser({ _id: 'u1', username: 'officer1', role: 'lender_officer' });
    const withDedupe = { ...baseApplication, dedupe: { matchType: 'nrc', userId: 'user-1', name: 'Existing Customer' } };
    const { ui } = renderWithProviders(
      <ApplicationDetailDialog application={withDedupe} open={true} onClose={vi.fn()} />
    );
    render(ui);

    await user.click(screen.getByLabelText(/Attach loan to Existing Customer/i));
    await user.click(screen.getByRole('button', { name: /^Approve$/i }));

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith('/customer-applications/app-1/approve', {
        attachToUserId: 'user-1',
      })
    );
  });

  it('requires a rejection reason before confirming reject', async () => {
    const user = userEvent.setup();
    seedUser({ _id: 'u1', username: 'officer1', role: 'lender_officer' });
    const { ui } = renderWithProviders(
      <ApplicationDetailDialog application={baseApplication} open={true} onClose={vi.fn()} />
    );
    render(ui);

    await user.click(screen.getByRole('button', { name: /^Reject$/i }));
    expect(screen.getByRole('button', { name: /Confirm rejection/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/Rejection reason/i), 'Unverifiable income');
    expect(screen.getByRole('button', { name: /Confirm rejection/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Confirm rejection/i }));
    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith('/customer-applications/app-1/reject', {
        reason: 'Unverifiable income',
      })
    );
  });
});
