import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { seedUser } from '@/test/utils';
import { LoanDetailsDialog } from './LoanDetailsDialog';

const putMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { success: true } }));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: putMock,
  },
}));

const pendingLoan = {
  _id: 'loan-1',
  loanNumber: 'LN20260001',
  status: 'pending',
  amount: 5000,
  term: 30,
  termUnit: 'days',
  interestRate: 25,
  applicant: { firstName: 'Jane', lastName: 'Doe', email: 'jane@techcorp.zm' },
  company: { _id: 'company-1', name: 'TechCorp Zambia' },
  lenderCompany: { _id: 'lender-1', name: 'Manifi' },
  applicationDate: '2026-07-01',
};

const approvedLoan = {
  ...pendingLoan,
  _id: 'loan-2',
  loanNumber: 'LN20260002',
  status: 'approved',
};

const directLoan = {
  ...pendingLoan,
  _id: 'loan-3',
  loanNumber: 'LN20260003',
  company: { _id: 'lender-1', name: 'Manifi' },
  lenderCompany: { _id: 'lender-1', name: 'Manifi' },
};

beforeEach(() => {
  localStorage.clear();
  putMock.mockClear();
});

describe('LoanDetailsDialog', () => {
  it('shows Approve/Reject for an employer_hr of the loan\'s company viewing a pending loan', () => {
    seedUser({ _id: 'u1', username: 'hruser', role: 'employer_hr', firstName: 'Henry', company: 'company-1' });
    render(<LoanDetailsDialog loan={pendingLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.getByText('Approve application')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('hides Approve/Reject for a lender_officer viewing an employer-model pending loan', () => {
    seedUser({ _id: 'u2', username: 'officer1', role: 'lender_officer', firstName: 'Owen', company: 'lender-1' });
    render(<LoanDetailsDialog loan={pendingLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.queryByText('Approve application')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows Approve/Reject for a lender_officer of the lender viewing a direct pending loan', () => {
    seedUser({ _id: 'u2', username: 'officer1', role: 'lender_officer', firstName: 'Owen', company: 'lender-1' });
    render(<LoanDetailsDialog loan={directLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.getByText('Approve application')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('hides Approve/Reject for a lender_officer of a different lender viewing a direct pending loan', () => {
    seedUser({ _id: 'u2b', username: 'officer2', role: 'lender_officer', firstName: 'Olga', company: 'lender-2' });
    render(<LoanDetailsDialog loan={directLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.queryByText('Approve application')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows Approve/Reject for a lender_admin of the lender viewing a direct pending loan', () => {
    seedUser({ _id: 'u3', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena', company: 'lender-1' });
    render(<LoanDetailsDialog loan={directLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.getByText('Approve application')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows Disburse loan for a lender_admin viewing an approved loan', () => {
    seedUser({ _id: 'u3', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena', company: 'lender-1' });
    render(<LoanDetailsDialog loan={approvedLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.getByText('Disburse loan')).toBeInTheDocument();
  });

  it('does not show Disburse loan for a lender_officer viewing a direct approved loan (unchanged by this fix)', () => {
    seedUser({ _id: 'u2', username: 'officer1', role: 'lender_officer', firstName: 'Owen', company: 'lender-1' });
    const approvedDirectLoan = { ...directLoan, status: 'approved' };
    render(<LoanDetailsDialog loan={approvedDirectLoan} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.queryByText('Disburse loan')).not.toBeInTheDocument();
  });

  it('calls onUpdate after a successful approve mutation', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    seedUser({ _id: 'u1', username: 'hruser', role: 'employer_hr', firstName: 'Henry', company: 'company-1' });
    render(<LoanDetailsDialog loan={pendingLoan} open={true} onClose={vi.fn()} onUpdate={onUpdate} />);

    await user.click(screen.getByText('Approve application'));
    await user.type(screen.getByLabelText(/Approval comment/i), 'Verified employment.');
    await user.click(screen.getByText('Confirm approval'));

    await waitFor(() => expect(putMock).toHaveBeenCalledWith('/loans/loan-1/approve', {
      approvalNotes: 'Verified employment.',
    }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });

  describe('collateral section (Phase 21)', () => {
    const loanWithCollateral = {
      ...pendingLoan,
      collateral: [
        {
          _id: 'col-1',
          type: 'vehicle',
          description: 'Toyota Hilux',
          estimatedValue: 50000,
          status: 'declared',
          letterOfSale: { onFile: false },
        },
      ],
    };

    it('shows the Verify action for lender staff', () => {
      seedUser({ _id: 'u3', username: 'lenderadmin', role: 'lender_admin', firstName: 'Lena' });
      render(<LoanDetailsDialog loan={loanWithCollateral} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    it('hides the Verify action for a borrower', () => {
      seedUser({ _id: 'u4', username: 'borrower1', role: 'borrower', firstName: 'Ben' });
      render(<LoanDetailsDialog loan={loanWithCollateral} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />);

      expect(screen.queryByText('Verify')).not.toBeInTheDocument();
      expect(screen.getByText('Toyota Hilux')).toBeInTheDocument();
    });
  });
});
