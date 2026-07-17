import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import { PlatformDashboard } from './PlatformDashboard';

const { statsFixture } = vi.hoisted(() => ({
  statsFixture: {
    activeCompanies: 5,
    activeCorporates: 4,
    activeUsers: 120,
    activeLoans: 30,
    totalLoanAmount: 200000,
  },
}));

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { success: true, data: statsFixture } }) },
}));

beforeEach(() => {
  localStorage.clear();
  seedUser({ _id: '1', username: 'admin', role: 'platform_admin', firstName: 'Ada' });
});

describe('PlatformDashboard', () => {
  it('contains no chart element and no "System Status" text', async () => {
    const { ui } = renderWithProviders(<PlatformDashboard />);
    const { container } = render(ui);

    await waitFor(() => expect(screen.getByText('Active companies')).toBeInTheDocument());
    expect(screen.queryByText(/System Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All services operational/i)).not.toBeInTheDocument();
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
  });
});
