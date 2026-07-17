import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser, renderWithProviders } from '@/test/utils';
import ProductBasedLoanForm from './ProductBasedLoanForm';

const { productFixture, postMock } = vi.hoisted(() => ({
  productFixture: {
    _id: 'product-1',
    name: 'Payday Advance',
    description: 'Short-term payday loan',
    category: 'payday',
    interestRate: { min: 20, max: 25, default: 25 },
    term: { min: 30, max: 30, default: 30, unit: 'days' },
    amount: { min: 500, max: 5000, currency: 'ZMW' },
    interestCalculation: { method: 'flat_rate', rateBasis: 'per_term' },
    repaymentFrequency: ['monthly'],
    collateralRequired: false,
  },
  postMock: vi.fn((url) => {
    if (url === '/loans') {
      return Promise.resolve({ data: { success: true, data: { loan: { _id: 'loan-new' } } } });
    }
    if (url.includes('/calculate-fees')) {
      return Promise.resolve({
        data: {
          success: true,
          data: { loanAmount: 1000, fees: { processingFee: 0, insuranceFee: 0, totalUpfrontFees: 0 }, netDisbursement: 1000 },
        },
      });
    }
    if (url.includes('/calculate-schedule')) {
      return Promise.resolve({
        data: { success: true, data: { monthlyPayment: 100, totalRepayment: 1200, totalInterest: 200, schedule: [] } },
      });
    }
    return Promise.resolve({ data: { success: true, data: {} } });
  }),
}));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/products/available') {
        return Promise.resolve({ data: { success: true, data: [productFixture] } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    post: postMock,
  },
}));

beforeEach(() => {
  localStorage.clear();
  postMock.mockClear();
  // Radix Select relies on pointer-capture APIs jsdom doesn't implement.
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

describe('ProductBasedLoanForm', () => {
  it('renders the product with rate-with-basis text on selection', async () => {
    seedUser({ _id: 'u1', username: 'borrower1', role: 'borrower', firstName: 'Ben', lastName: 'Phiri' });
    const user = userEvent.setup();
    const { ui } = renderWithProviders(
      <ProductBasedLoanForm open={true} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    render(ui);

    await waitFor(() => expect(screen.getByText('Payday Advance')).toBeInTheDocument());
    await user.click(screen.getByText('Payday Advance'));

    await waitFor(() => expect(screen.getByText(/25% flat per term/)).toBeInTheDocument());
  });

  it('submits with the same payload shape as before the restyle', async () => {
    seedUser({ _id: 'u1', username: 'borrower1', role: 'borrower', firstName: 'Ben', lastName: 'Phiri' });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const { ui } = renderWithProviders(
      <ProductBasedLoanForm open={true} onClose={vi.fn()} onSuccess={onSuccess} />
    );
    render(ui);

    await waitFor(() => expect(screen.getByText('Payday Advance')).toBeInTheDocument());
    await user.click(screen.getByText('Payday Advance'));

    await waitFor(() => expect(screen.getByLabelText(/Loan amount/)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Loan amount/), '1000');
    await user.type(screen.getByLabelText(/Monthly income/), '5000');

    // Explicitly choose the term (jsdom's Radix Select hidden-select fallback
    // otherwise clobbers the auto-populated default with an empty value).
    await user.click(screen.getByRole('combobox', { name: /Loan term/i }));
    await user.click(await screen.findByRole('option', { name: '30 days' }));

    await user.click(screen.getByText('Submit application'));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/loans', {
        productId: 'product-1',
        amount: 1000,
        term: 30,
        purpose: 'Payday Advance Application',
        description: '',
        monthlyIncome: 5000,
        collateral: undefined,
        gracePeriod: 0,
        graceType: 'none',
        moratorium: undefined,
      })
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
