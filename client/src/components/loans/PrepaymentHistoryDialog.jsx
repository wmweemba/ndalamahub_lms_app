import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { History, TrendingDown, Clock, CheckCircle } from 'lucide-react';

export function PrepaymentHistoryDialog({ loan, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (open && loan) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan]);

  const fetchHistory = async () => {
    if (!loan) return;

    setLoading(true);
    try {
      const response = await api.get(`/loans/${loan._id}/prepayment-history`);
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch prepayment history';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Prepayment history
          </DialogTitle>
          <DialogDescription>
            All prepayments and early settlement for {loan.loanNumber}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Loading prepayment history…
          </div>
        ) : history ? (
          <div className="space-y-6">
            {/* Summary Card */}
            {history.summary && history.summary.totalPrepayments > 0 && (
              <Card className="rounded-2xl border-border bg-status-info-bg p-4">
                <h3 className="text-[15px] font-medium text-status-info-fg mb-3">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-status-info-fg">Total prepayments</p>
                    <p className="text-lg font-mono font-medium text-status-info-fg">
                      {history.summary.totalPrepayments}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-status-info-fg">Total amount</p>
                    <p className="text-base font-mono font-medium text-status-info-fg">
                      {formatCurrency(history.summary.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-status-info-fg">Principal paid</p>
                    <p className="text-base font-mono font-medium text-status-info-fg">
                      {formatCurrency(history.summary.totalPrincipal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-status-info-fg">Interest paid</p>
                    <p className="text-base font-mono font-medium text-status-info-fg">
                      {formatCurrency(history.summary.totalInterest)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Early Settlement Info */}
            {history.earlySettlement && (
              <Card className="rounded-2xl border-border bg-status-success-bg p-4">
                <h3 className="text-[15px] font-medium flex items-center gap-2 text-status-success-fg mb-3">
                  <CheckCircle className="h-5 w-5" />
                  Early settlement completed
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-status-success-fg">Settlement date</p>
                    <p className="font-medium text-status-success-fg">{formatDate(history.earlySettlement.date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-status-success-fg">Settlement amount</p>
                    <p className="text-lg font-mono font-medium text-status-success-fg">
                      {formatCurrency(history.earlySettlement.amount)}
                    </p>
                  </div>
                  {history.earlySettlement.savingsRealized > 0 && (
                    <div>
                      <p className="text-sm text-status-success-fg">Interest saved</p>
                      <p className="text-lg font-mono font-medium text-status-success-fg">
                        {formatCurrency(history.earlySettlement.savingsRealized)}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Prepayments List */}
            {history.prepayments && history.prepayments.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-[15px] font-medium text-foreground">Payment history</h3>
                {history.prepayments.map((prepayment, index) => (
                  <Card key={index} className="rounded-2xl border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-status-info-bg flex items-center justify-center">
                            {prepayment.allocationStrategy === 'reduce_term' ? (
                              <Clock className="h-5 w-5 text-status-info-fg" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-status-success-fg" />
                            )}
                          </div>
                          <div>
                            <p className="text-base font-mono font-medium text-foreground">
                              {formatCurrency(prepayment.amount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(prepayment.date)}
                            </p>
                          </div>
                        </div>

                        <div className="pl-13 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-success-bg text-status-success-fg">
                              Principal: {formatCurrency(prepayment.principalPortion)}
                            </span>
                            {prepayment.interestPortion > 0 && (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-info-bg text-status-info-fg">
                                Interest: {formatCurrency(prepayment.interestPortion)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#F0F0EE] text-[#5F5E5A]">
                              {prepayment.allocationStrategy === 'reduce_term'
                                ? 'Reduced term'
                                : 'Reduced payment'}
                            </span>
                          </div>

                          {prepayment.notes && (
                            <p className="text-sm text-muted-foreground italic mt-2">
                              Note: {prepayment.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {prepayment.recordedBy && (
                        <div className="text-sm text-muted-foreground md:text-right">
                          <p>Recorded by</p>
                          <p className="font-medium text-foreground">
                            {prepayment.recordedBy.firstName} {prepayment.recordedBy.lastName}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl border-border py-8 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No prepayments recorded yet</p>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
