import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import ProductsPage from './ProductsPage';

const { productsFixture } = vi.hoisted(() => ({
  productsFixture: [
    {
      _id: 'product-1',
      name: 'Payday Advance',
      description: 'Short-term payday loan',
      category: 'payday',
      company: { _id: 'company-1', name: 'Manifi Investments' },
      interestRate: { min: 20, max: 25, default: 25 },
      term: { min: 30, max: 30, default: 30, unit: 'days' },
      amount: { min: 500, max: 5000, currency: 'ZMW' },
      interestCalculation: { method: 'flat_rate', rateBasis: 'per_term' },
    },
  ],
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/products') {
        return Promise.resolve({ data: { success: true, data: productsFixture } });
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

describe('ProductsPage', () => {
  it('renders a 30-day term as "30 days" and shows the rate basis text', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    const { ui } = renderWithProviders(<ProductsPage />);
    render(ui);

    await waitFor(() => expect(screen.getByText('Payday Advance')).toBeInTheDocument());
    expect(screen.getByText('30 days – 30 days')).toBeInTheDocument();
    expect(screen.getByText('25% flat per term')).toBeInTheDocument();
  });
});
