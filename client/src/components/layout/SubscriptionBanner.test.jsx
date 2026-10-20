import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { SubscriptionBanner } from './SubscriptionBanner';
import { formatDate } from '@/lib/format';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/utils/api';

const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
const settle = () => new Promise((r) => setTimeout(r, 50));

function setup(role, status) {
  seedUser({ _id: '1', username: 'u1', role });
  api.get.mockResolvedValue({ data: { data: { exempt: false, ...status } } });
  const { ui } = renderWithProviders(<SubscriptionBanner />);
  render(ui);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SubscriptionBanner', () => {
  it('shows a borrower nothing even when the lender is read_only', async () => {
    setup('borrower', { effectiveStatus: 'read_only' });
    await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows lender_admin the renewal banner with the date 5 days before period end', async () => {
    const end = inDays(5);
    setup('lender_admin', { effectiveStatus: 'active', currentPeriodEnd: end });
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.className).toMatch(/status-info/);
    expect(screen.getByText('Subscription renews soon')).toBeInTheDocument();
    expect(alert).toHaveTextContent(formatDate(end));
  });

  it('shows lender_officer no renewal banner', async () => {
    setup('lender_officer', { effectiveStatus: 'active', currentPeriodEnd: inDays(5) });
    await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows lender_officer the past_due banner', async () => {
    setup('lender_officer', { effectiveStatus: 'past_due' });
    await waitFor(() => screen.getByText('Payment overdue'));
  });

  it('shows employer_hr nothing when read_only', async () => {
    setup('employer_hr', { effectiveStatus: 'read_only' });
    await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows lender_admin nothing when 30 days remain', async () => {
    setup('lender_admin', { effectiveStatus: 'active', currentPeriodEnd: inDays(30) });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('names the trial end date for lender_admin', async () => {
    const end = inDays(3);
    setup('lender_admin', { effectiveStatus: 'trialing', trialEndsAt: end });
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert).toHaveTextContent(formatDate(end));
  });
});
