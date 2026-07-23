import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { seedUser } from '@/test/utils';

const { meResponse } = vi.hoisted(() => ({ meResponse: { current: null } }));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({ data: { data: { user: meResponse.current } } });
      }
      return Promise.resolve({ data: { data: { exempt: true } } });
    }),
  },
}));

function renderApp(initialEntry) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
            <Route path="/loans" element={<div>Loans Content</div>} />
            <Route path="/companies" element={<div>Companies Content</div>} />
            <Route path="/customers" element={<div>Customers Content</div>} />
            <Route path="/products" element={<div>Products Content</div>} />
            <Route path="/settings" element={<div>Settings Content</div>} />
            <Route path="/support" element={<div>Support Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    meResponse.current = null;
  });

  it('renders sidebar nav for a lender_admin, including Companies/Products/Reports', () => {
    meResponse.current = { company: { lendingModel: 'employer' } };
    seedUser({ _id: '1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    renderApp('/dashboard');

    expect(screen.getByRole('link', { name: /companies/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('hides Companies/Products/Settings for a borrower', () => {
    seedUser({ _id: '2', username: 'borrower1', role: 'borrower', firstName: 'Bo' });
    renderApp('/dashboard');

    expect(screen.queryByRole('link', { name: /companies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /products/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('redirects to /login when no user is seeded', async () => {
    renderApp('/dashboard');
    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
  });

  it('shows Customers instead of Companies for a direct-model lender_admin', async () => {
    meResponse.current = { company: { lendingModel: 'direct' } };
    seedUser({ _id: '4', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    renderApp('/dashboard');

    await waitFor(() => expect(screen.getByRole('link', { name: /customers/i })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /companies/i })).not.toBeInTheDocument();
  });

  it('keeps Companies for an employer-model lender_admin (no change)', async () => {
    meResponse.current = { company: { lendingModel: 'employer' } };
    seedUser({ _id: '5', username: 'lenderadmin2', role: 'lender_admin', firstName: 'Lena' });
    renderApp('/dashboard');

    await waitFor(() => expect(screen.getByRole('link', { name: /companies/i })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /customers/i })).not.toBeInTheDocument();
  });

  it('keeps Companies for a direct-model lender under platform_admin (no change)', async () => {
    meResponse.current = { company: { lendingModel: 'direct' } };
    seedUser({ _id: '6', username: 'platformadmin', role: 'platform_admin', firstName: 'Pat' });
    renderApp('/dashboard');

    expect(screen.getByRole('link', { name: /companies/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /customers/i })).not.toBeInTheDocument();
  });

  it('renders exactly Dashboard/Loans/Support in the borrower bottom nav, no Settings', () => {
    seedUser({ _id: '3', username: 'borrower1', role: 'borrower', firstName: 'Bo' });
    renderApp('/dashboard');

    const nav = screen.getByRole('navigation', { name: 'Bottom navigation' });
    expect(nav).toHaveTextContent('Dashboard');
    expect(nav).toHaveTextContent('Loans');
    expect(nav).toHaveTextContent('Support');
    expect(nav).not.toHaveTextContent('Settings');
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
  });
});
