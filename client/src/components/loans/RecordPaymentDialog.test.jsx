import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser } from '@/test/utils';
import { RecordPaymentDialog } from './RecordPaymentDialog';

const putMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { success: true } }));

vi.mock('@/utils/api', () => ({
  default: {
    put: putMock,
  },
}));

const loan = { _id: 'loan-1', loanNumber: 'LN20260001' };
const installment = {
  installmentNumber: 1,
  amount: 500,
  paidAmount: 0,
  status: 'pending',
  dueDate: '2026-07-01',
};

beforeEach(() => {
  localStorage.clear();
  putMock.mockClear();
  // Radix Select relies on pointer-capture APIs jsdom doesn't implement.
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

describe('RecordPaymentDialog', () => {
  it('records a payment, invokes onSuccess, and closes on success', async () => {
    seedUser({ _id: 'u1', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <RecordPaymentDialog
        loan={loan}
        installment={installment}
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    // Payment method (shadcn Select)
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Cash' }));

    await user.type(screen.getByLabelText(/Reference number/i), 'TXN-001');
    await user.click(screen.getByText('Record repayment'));

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith('/loans/loan-1/repayment', expect.objectContaining({
        installmentNumber: 1,
        amount: 500,
        paymentMethod: 'cash',
        referenceNumber: 'TXN-001',
      }))
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
