import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
          type: 'Regular Payment',
          installmentNumber: installment.installmentNumber || 0,
          amount: installment.paidAmount || installment.amount || 0, // Use paidAmount for partial payments
          fullAmount: installment.amount || 0, // Keep full amount for reference
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

  // Sort regular payments by date (most recent first)
  regularPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Sort prepayments by date (most recent first)
  const sortedPrepayments = [...prepayments].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Check if there are any payments at all
  const hasPayments = regularPayments.length > 0 || sortedPrepayments.length > 0 || earlySettlement;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Payment History</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Loan: {loan.loanNumber || 'N/A'} | Total Paid: K{(loan.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </DialogHeader>

        {!hasPayments && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No payments recorded yet</p>
          </div>
        )}

        {/* Regular Installment Payments */}
        {regularPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className="bg-green-600">Regular Payments</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {regularPayments.length} installment{regularPayments.length !== 1 ? 's' : ''} paid
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">#</th>
                      <th className="pb-2 font-semibold">Due Date</th>
                      <th className="pb-2 font-semibold">Payment Date</th>
                      <th className="pb-2 font-semibold text-right">Amount</th>
                      <th className="pb-2 font-semibold hidden sm:table-cell">Method</th>
                      <th className="pb-2 font-semibold hidden md:table-cell">Reference</th>
                      <th className="pb-2 font-semibold hidden lg:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularPayments.map((payment, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          #{payment.installmentNumber}
                          {payment.isPartial && (
                            <Badge variant="secondary" className="ml-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs">
                              Partial
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 text-gray-500">
                          {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3">
                          {payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 text-right font-medium">
                          <div>
                            K{(payment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {payment.isPartial && payment.fullAmount && (
                            <div className="text-xs text-gray-500">
                              of K{payment.fullAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 capitalize hidden sm:table-cell">
                          {payment.method ? payment.method.replace(/_/g, ' ') : 'N/A'}
                        </td>
                        <td className="py-3 hidden md:table-cell">
                          {payment.reference || '-'}
                        </td>
                        <td className="py-3 text-xs text-gray-500 hidden lg:table-cell">
                          {payment.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prepayments (Extra Payments) */}
        {sortedPrepayments.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className="bg-purple-600">Prepayments</Badge>
                <span className="text-sm font-normal text-gray-500">
                  {sortedPrepayments.length} extra payment{sortedPrepayments.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">Date</th>
                      <th className="pb-2 font-semibold text-right">Amount</th>
                      <th className="pb-2 font-semibold hidden sm:table-cell">Method</th>
                      <th className="pb-2 font-semibold hidden md:table-cell">Reference</th>
                      <th className="pb-2 font-semibold hidden lg:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPrepayments.map((prepayment, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          {prepayment.date ? new Date(prepayment.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 text-right font-medium">
                          K{(prepayment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 capitalize hidden sm:table-cell">
                          {prepayment.method ? prepayment.method.replace(/_/g, ' ') : 'N/A'}
                        </td>
                        <td className="py-3 hidden md:table-cell">
                          {prepayment.reference || '-'}
                        </td>
                        <td className="py-3 text-xs text-gray-500 hidden lg:table-cell">
                          {prepayment.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Early Settlement */}
        {earlySettlement && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className="bg-blue-600">Early Settlement</Badge>
                <span className="text-sm font-normal text-gray-500">
                  Loan paid off early
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Settlement Date</label>
                  <p>{earlySettlement.date ? new Date(earlySettlement.date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount Paid</label>
                  <p className="font-medium">
                    K{(earlySettlement.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {earlySettlement.penalty && earlySettlement.penalty > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Prepayment Penalty</label>
                    <p className="text-red-600 font-medium">
                      K{earlySettlement.penalty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Paid</label>
                  <p className="font-medium">
                    K{(earlySettlement.totalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {earlySettlement.method && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Method</label>
                    <p className="capitalize">{earlySettlement.method.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {earlySettlement.reference && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reference Number</label>
                    <p>{earlySettlement.reference}</p>
                  </div>
                )}
                {earlySettlement.notes && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-sm">{earlySettlement.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentHistoryDialog;
