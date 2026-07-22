import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser, renderWithProviders } from '@/test/utils';
import { CreateCustomerDialog } from './CreateCustomerDialog';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('@/utils/api', () => ({
  default: {
    post: postMock,
  },
}));

beforeEach(() => {
  localStorage.clear();
  postMock.mockReset();
  postMock.mockResolvedValue({ data: { success: true, data: { _id: 'new-cust-1' } } });
});

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText(/first name/i), 'Jane');
  await user.type(screen.getByLabelText(/last name/i), 'Doe');
  await user.type(screen.getByLabelText(/nrc/i), '123456/10/1');
  await user.type(screen.getByLabelText(/phone/i), '+260970000001');
}

describe('CreateCustomerDialog', () => {
  it('requires NRC but not email', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const onSuccess = vi.fn();
    const { ui } = renderWithProviders(
      <CreateCustomerDialog open={true} onClose={vi.fn()} onSuccess={onSuccess} />
    );
    render(ui);

    const nrcInput = screen.getByLabelText(/nrc/i);
    expect(nrcInput).toBeRequired();
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).not.toBeRequired();
  });

  it('without email: requires a temp password and derives username from NRC', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const { ui } = renderWithProviders(
      <CreateCustomerDialog open={true} onClose={vi.fn()} onSuccess={onSuccess} />
    );
    render(ui);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/temporary password/i), 'TempPass1!');

    await user.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/users', expect.objectContaining({
      nrc: '123456/10/1',
      username: '123456101',
      password: 'TempPass1!',
    })));
    // No invite call for the without-email path
    expect(postMock).not.toHaveBeenCalledWith(expect.stringContaining('/invite'));
  });

  it('with email: calls create then invite', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', company: 'lender-1' });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const { ui } = renderWithProviders(
      <CreateCustomerDialog open={true} onClose={vi.fn()} onSuccess={onSuccess} />
    );
    render(ui);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');

    expect(screen.getByText(/an invite to set their password will be emailed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/users', expect.objectContaining({
      email: 'jane@example.com',
    })));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/users/new-cust-1/invite'));
  });
});
