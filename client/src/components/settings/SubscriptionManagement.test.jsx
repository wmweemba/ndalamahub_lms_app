import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser, renderWithProviders } from '@/test/utils';
import SubscriptionManagement from './SubscriptionManagement';

const { getMock, postMock, lender } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  lender: {
    _id: 'lender-1',
    name: 'Manifi Investments',
    subscription: {
      status: 'active',
      plan: 'standard',
      trialEndsAt: '2020-03-05T00:00:00.000Z',
      currentPeriodEnd: '2099-01-15T00:00:00.000Z',
    },
  },
}));

vi.mock('@/utils/api', () => ({
  default: { get: getMock, post: postMock, put: vi.fn() },
}));

const paymentsFixture = [
  {
    _id: 'pay-1',
    amount: 1500,
    currency: 'ZMW',
    method: 'mobile_money',
    reference: 'MM-REF-77',
    periodStart: '2099-01-15T00:00:00.000Z',
    periodEnd: '2099-04-15T00:00:00.000Z',
    createdAt: '2026-10-20T10:00:00.000Z',
    recordedBy: { firstName: 'Nexus', lastName: 'Admin', username: 'nexus' },
  },
];

const auditFixture = [
  {
    _id: 'aud-1',
    action: 'subscription.status_changed',
    source: 'system',
    performedBy: null,
    changedFields: ['status'],
    before: { status: 'active' },
    after: { status: 'past_due' },
    createdAt: '2026-10-19T02:00:00.000Z',
  },
];

function mockGets({ payments = paymentsFixture, entries = auditFixture } = {}) {
  getMock.mockImplementation((url) => {
    if (url === '/subscriptions') return Promise.resolve({ data: { success: true, data: { lenders: [lender] } } });
    if (url.endsWith('/payments')) return Promise.resolve({ data: { success: true, data: { payments } } });
    if (url.endsWith('/audit')) return Promise.resolve({ data: { success: true, data: { entries } } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderPage() {
  const { ui } = renderWithProviders(<SubscriptionManagement />);
  return render(ui);
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  seedUser({ _id: 'u1', username: 'nexus', role: 'platform_admin', firstName: 'Nexus' });
  mockGets();
});

async function openRecordDialog(user) {
  await screen.findByText('Manifi Investments');
  await user.click(screen.getByRole('button', { name: /Record payment/i }));
  return screen.findByRole('dialog');
}

describe('SubscriptionManagement billing table', () => {
  it('does not render a stale trial date for an active lender', async () => {
    renderPage();
    await screen.findByText('Manifi Investments');
    expect(screen.getByText('15 Jan 2099')).toBeInTheDocument();
    expect(screen.queryByText('5 Mar 2020')).not.toBeInTheDocument();
  });
});

describe('Record payment dialog', () => {
  it('previews the period end for 3 months and posts the expected body', async () => {
    postMock.mockResolvedValue({
      data: { success: true, data: { company: { ...lender }, payment: {} } },
    });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openRecordDialog(user);

    await user.type(within(dialog).getByLabelText(/Amount/i), '1500');
    await user.click(within(dialog).getByRole('combobox', { name: /Period/i }));
    await user.click(await screen.findByRole('option', { name: '3 months' }));
    expect(within(dialog).getByTestId('period-preview')).toHaveTextContent('15 Apr 2099');

    await user.type(within(dialog).getByLabelText(/Reference/i), 'MM-REF-77');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/subscriptions/lender-1/payments', {
        amount: 1500,
        method: 'mobile_money',
        plan: 'standard',
        reference: 'MM-REF-77',
        periodMonths: 3,
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server message on a 409', async () => {
    postMock.mockRejectedValue({
      response: { status: 409, data: { success: false, message: 'A payment with this reference has already been recorded' } },
    });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openRecordDialog(user);

    await user.type(within(dialog).getByLabelText(/Amount/i), '100');
    await user.type(within(dialog).getByLabelText(/Reference/i), 'DUP-1');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    expect(await within(dialog).findByText('A payment with this reference has already been recorded')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Record payment' })).not.toBeDisabled();
  });
});

describe('View history dialog', () => {
  async function openHistory(user) {
    await screen.findByText('Manifi Investments');
    await user.click(screen.getByRole('button', { name: /View history/i }));
    return screen.findByRole('dialog');
  }

  it('renders the Payments rows', async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openHistory(user);

    expect(await within(dialog).findByText('MM-REF-77')).toBeInTheDocument();
    expect(within(dialog).getByText('K1,500')).toBeInTheDocument();
    expect(within(dialog).getByText('Mobile money')).toBeInTheDocument();
    expect(within(dialog).getByText('Nexus Admin')).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalledWith('/subscriptions/lender-1/audit');
  });

  it('shows an empty state when there are no payments', async () => {
    mockGets({ payments: [] });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openHistory(user);
    expect(await within(dialog).findByText('No payments recorded yet.')).toBeInTheDocument();
  });

  it('renders System and a status change line in the Changes view', async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openHistory(user);

    await user.click(within(dialog).getByRole('button', { name: 'Changes' }));

    expect(await within(dialog).findByText('System')).toBeInTheDocument();
    expect(within(dialog).getByText('Automatic status change')).toBeInTheDocument();
    const line = within(dialog).getByText('status:').parentElement;
    expect(line).toHaveTextContent('status: active → past due');
  });
});
