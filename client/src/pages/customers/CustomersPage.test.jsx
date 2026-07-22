import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { seedUser, renderWithProviders } from '@/test/utils';
import CustomersPage from './CustomersPage';

const { customersFixture } = vi.hoisted(() => ({
  customersFixture: [
    {
      _id: 'cust-1',
      firstName: 'John',
      lastName: 'Banda',
      nrc: '123456/10/1',
      phone: '+260970000001',
      email: 'john@example.com',
      isActive: true,
    },
    {
      _id: 'cust-2',
      firstName: 'Mary',
      lastName: 'Phiri',
      nrc: '654321/10/1',
      phone: '+260970000002',
      email: '',
      isActive: false,
    },
  ],
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/users?role=borrower') {
        return Promise.resolve({ data: customersFixture });
      }
      if (url === '/loans') {
        return Promise.resolve({ data: { success: true, data: { loans: [] } } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe('CustomersPage', () => {
  it('renders customers with NRC and active/inactive pills', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const { ui } = renderWithProviders(<CustomersPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('123456/10/1').length).toBeGreaterThan(0));
    expect(screen.getAllByText('654321/10/1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('inactive').length).toBeGreaterThan(0);
  });

  it('filters customers by search term', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const { ui } = renderWithProviders(<CustomersPage />);
    const { default: userEvent } = await import('@testing-library/user-event');
    render(ui);

    await waitFor(() => expect(screen.getAllByText('John Banda').length).toBeGreaterThan(0));
    const search = screen.getByPlaceholderText(/search by name/i);
    await userEvent.type(search, 'Phiri');

    expect(screen.queryByText('John Banda')).not.toBeInTheDocument();
    expect(screen.getAllByText('Mary Phiri').length).toBeGreaterThan(0);
  });

  it('shows a single "Add customer" primary button', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const { ui } = renderWithProviders(<CustomersPage />);
    render(ui);

    await waitFor(() => expect(screen.getAllByText('John Banda').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /add customer/i })).toBeInTheDocument();
  });
});
