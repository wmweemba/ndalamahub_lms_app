import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { seedUser } from '@/test/utils';

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: { exempt: true } } }),
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
  it('renders sidebar nav for a lender_admin, including Companies/Products/Reports', () => {
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

  it('redirects to /login when no user is seeded', () => {
    renderApp('/dashboard');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
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
