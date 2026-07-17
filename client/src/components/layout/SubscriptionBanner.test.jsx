import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { SubscriptionBanner } from './SubscriptionBanner';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/utils/api';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SubscriptionBanner', () => {
  it('renders danger-token classes and the employer-side copy for a read_only borrower', async () => {
    seedUser({ _id: '1', username: 'borrower1', role: 'borrower' });
    api.get.mockResolvedValue({ data: { data: { effectiveStatus: 'read_only', exempt: false } } });

    const { ui } = renderWithProviders(<SubscriptionBanner />);
    render(ui);

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.className).toMatch(/status-danger/);
    expect(screen.getByText('Read-only access')).toBeInTheDocument();
    expect(screen.getByText(/lender's account is unpaid/)).toBeInTheDocument();
  });
});
