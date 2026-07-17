import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatusPill } from '../ui/status-pill';
import { formatCurrency, formatDate } from '@/lib/format';

const PaymentHistoryDialog = ({ open, onClose, loan }) => {
  if (!loan) return null;

  // Extract all payments from different sources
  const regularPayments = [];
  const prepayments = loan.prepayments || [];
  const earlySettlement = loan.earlySettlement;

  // Extract regular installment payments from repayment schedule
  if (loan.repaymentSchedule && Array.isArray(loan.repaymentSchedule)) {
    loan.repaymentSchedule.forEach(installment => {
      // Include both 'paid' and 'partial' payments
      if (installment && (installment.status === 'paid' || installment.status === 'partial') && installment.paymentDate) {
        regularPayments.push({
          installmentNumber: installment.installmentNumber || 0,
          amount: installment.paidAmount || installment.amount || 0,
          fullAmount: installment.amount || 0,
          isPaid: installment.status === 'paid',
          isPartial: installment.status === 'partial',
          date: installment.paymentDate,
          method: installment.paymentMethod,
          reference: installment.referenceNumber,
          notes: installment.paymentNotes,
          dueDate: installment.dueDate
        });
      }
    });
  }

  regularPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedPrepayments = [...prepayments].sort((a, b) => new Date(b.date) - new Date(a.date));
  const hasPayments = regularPayments.length > 0 || sortedPrepayments.length > 0 || earlySettlement;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete payment history</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Loan: <span className="font-mono">{loan.loanNumber || 'N/A'}</span> | Total paid: <span className="font-mono">{formatCurrency(loan.totalPaid)}</span>
          </p>
        </DialogHeader>

        {!hasPayments && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No payments recorded yet
          </div>
        )}

        {/* Regular Installment Payments */}
        {regularPayments.length > 0 && (
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-success-bg text-status-success-fg">
                Regular payments
              </span>
              <span className="text-sm text-muted-foreground">
                {regularPayments.length} installment{regularPayments.length !== 1 ? 's' : ''} paid
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Due date</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Payment date</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Amount</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Method</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Reference</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {regularPayments.map((payment, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="py-3">
                        #{payment.installmentNumber}
                        {payment.isPartial && (
                          <StatusPill status="partial" className="ml-2" />
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(payment.dueDate)}
                      </td>
                      <td className="py-3">
                        {formatDate(payment.date)}
                      </td>
                      <td className="py-3 text-right font-mono font-medium">
                        <div>{formatCurrency(payment.amount)}</div>
                        {payment.isPartial && payment.fullAmount && (
                          <div className="text-xs text-muted-foreground font-normal">
                            of {formatCurrency(payment.fullAmount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 capitalize hidden sm:table-cell">
                        {payment.method ? payment.method.replace(/_/g, ' ') : 'N/A'}
                      </td>
                      <td className="py-3 hidden md:table-cell">
                        {payment.reference || '-'}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {payment.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Prepayments (Extra Payments) */}
        {sortedPrepayments.length > 0 && (
          <div className="rounded-2xl border border-border p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-info-bg text-status-info-fg">
                Prepayments
              </span>
              <span className="text-sm text-muted-foreground">
                {sortedPrepayments.length} extra payment{sortedPrepayments.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Amount</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Method</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Reference</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPrepayments.map((prepayment, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="py-3">{formatDate(prepayment.date)}</td>
                      <td className="py-3 text-right font-mono font-medium">
                        {formatCurrency(prepayment.amount)}
                      </td>
                      <td className="py-3 capitalize hidden sm:table-cell">
                        {prepayment.method ? prepayment.method.replace(/_/g, ' ') : 'N/A'}
                      </td>
                      <td className="py-3 hidden md:table-cell">
                        {prepayment.reference || '-'}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {prepayment.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Early Settlement */}
        {earlySettlement && (
          <div className="rounded-2xl border border-border p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-success-bg text-status-success-fg">
                Early settlement
              </span>
              <span className="text-sm text-muted-foreground">Loan paid off early</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Settlement date</p>
                <p className="text-foreground">{formatDate(earlySettlement.date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount paid</p>
                <p className="font-mono font-medium text-foreground">
                  {formatCurrency(earlySettlement.amount)}
                </p>
              </div>
              {earlySettlement.penalty > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Prepayment penalty</p>
                  <p className="font-mono font-medium text-status-danger-fg">
                    {formatCurrency(earlySettlement.penalty)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Total paid</p>
                <p className="font-mono font-medium text-foreground">
                  {formatCurrency(earlySettlement.totalPaid)}
                </p>
              </div>
              {earlySettlement.method && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment method</p>
                  <p className="capitalize text-foreground">{earlySettlement.method.replace(/_/g, ' ')}</p>
                </div>
              )}
              {earlySettlement.reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Reference number</p>
                  <p className="text-foreground">{earlySettlement.reference}</p>
                </div>
              )}
              {earlySettlement.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm text-foreground">{earlySettlement.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentHistoryDialog;
