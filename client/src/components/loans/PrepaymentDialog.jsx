import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Clock, TrendingDown, CheckCircle } from 'lucide-react';

export function PrepaymentDialog({ loan, open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState('reduce_term');
  const [notes, setNotes] = useState('');
  const [settlementQuote, setSettlementQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  const fetchSettlementQuote = async () => {
    if (!loan) return;

    setLoadingQuote(true);
    try {
      const response = await api.get(`/loans/${loan._id}/settlement-quote`);
      if (response.data.success) {
        setSettlementQuote(response.data.data.settlement);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch settlement quote';
      toast.error(message);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid prepayment amount');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/loans/${loan._id}/prepayment`, {
        amount: parseFloat(amount),
        allocationStrategy: strategy,
        notes: notes.trim()
      });

      if (response.data.success) {
        toast.success('Prepayment recorded');
        onSuccess?.(response.data.data);
        handleClose();
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to record prepayment';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEarlySettlement = async () => {
    if (!settlementQuote) return;

    if (!confirm(`Settle loan for ${formatCurrency(settlementQuote.totalPayoff)}?\n\nThis will close the loan completely.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/loans/${loan._id}/early-settlement`, {
        settlementDate: new Date().toISOString()
      });

      if (response.data.success) {
        toast.success('Loan settled');
        onSuccess?.(response.data.data);
        handleClose();
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to process early settlement';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setStrategy('reduce_term');
    setNotes('');
    setError(null);
    setShowQuote(false);
    setSettlementQuote(null);
    onClose();
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prepayment &amp; early settlement</DialogTitle>
          <DialogDescription>
            Record extra payment or settle loan completely for {loan.loanNumber}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Get Settlement Quote Button */}
        {!showQuote && (
          <Card className="rounded-2xl border-border bg-status-info-bg p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-card mb-2">
              <CheckCircle className="h-6 w-6 text-status-info-fg" />
            </div>
            <h3 className="text-[15px] font-medium text-status-info-fg">Early settlement quote</h3>
            <p className="text-sm text-status-info-fg max-w-md mx-auto">
              Get a detailed quote to settle this loan completely today.
              See exactly how much you&apos;ll pay and how much interest you&apos;ll save.
            </p>
            <Button
              onClick={() => {
                setShowQuote(true);
                fetchSettlementQuote();
              }}
              disabled={loadingQuote}
              className="mt-4"
            >
              {loadingQuote ? 'Loading…' : 'Get settlement quote'}
            </Button>
          </Card>
        )}

        {/* Settlement Quote Details */}
        {showQuote && loadingQuote && (
          <Card className="rounded-2xl border-border p-6">
            <p className="text-sm text-muted-foreground text-center">Loading settlement quote…</p>
          </Card>
        )}

        {showQuote && !loadingQuote && settlementQuote && (
          <Card className="rounded-2xl border-border bg-status-info-bg p-4">
            <h3 className="text-[15px] font-medium text-status-info-fg mb-4">Settlement quote details</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-status-info-fg">Settlement date</span>
                <span className="text-sm font-mono text-status-info-fg">{formatDate(new Date())}</span>
              </div>
              <div className="border-t border-status-info-fg/20" />
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-status-info-fg">Remaining principal</span>
                <span className="text-sm font-mono font-medium text-status-info-fg">
                  {formatCurrency(settlementQuote.principalBalance)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-status-info-fg">Accrued interest (to date)</span>
                <span className="text-sm font-mono font-medium text-status-info-fg">
                  {formatCurrency(settlementQuote.interestBalance)}
                </span>
              </div>
              {settlementQuote.earlySettlementFee > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-status-info-fg">Early settlement fee</span>
                  <span className="text-sm font-mono font-medium text-status-warning-fg">
                    {formatCurrency(settlementQuote.earlySettlementFee)}
                  </span>
                </div>
              )}
              <div className="border-t border-status-info-fg/20 pt-3 mt-2 flex justify-between items-center">
                <span className="font-medium text-status-info-fg">Total settlement amount</span>
                <span className="text-xl font-mono font-medium text-status-info-fg">
                  {formatCurrency(settlementQuote.totalPayoff)}
                </span>
              </div>

              {settlementQuote.futureInterestSaved > 0 && (
                <div className="bg-status-success-bg rounded-2xl p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-status-success-fg mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-status-success-fg">
                        You&apos;ll save {formatCurrency(settlementQuote.futureInterestSaved)}
                      </p>
                      <p className="text-xs text-status-success-fg mt-1">
                        By settling today vs continuing with the full repayment schedule
                      </p>
                      {settlementQuote.remainingInstallments > 0 && (
                        <p className="text-xs text-status-success-fg mt-1">
                          Skip {settlementQuote.remainingInstallments} remaining payment{settlementQuote.remainingInstallments !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setShowQuote(false)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleEarlySettlement}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Processing…' : 'Settle loan now'}
              </Button>
            </div>
          </Card>
        )}

        <div className="border-t border-border my-4" />

        {/* Prepayment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount" className="text-[15px] font-medium">
              Partial prepayment
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Make an extra payment to reduce your loan
            </p>
          </div>

          <div>
            <Label htmlFor="amount">Prepayment amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              disabled={loading}
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Any amount above your regular payment
            </p>
          </div>

          <div>
            <Label className="mb-3 block">Allocation strategy *</Label>
            <RadioGroup
              value={strategy}
              onValueChange={setStrategy}
              disabled={loading}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 border border-border rounded-2xl p-4 hover:bg-muted cursor-pointer">
                <RadioGroupItem value="reduce_term" id="reduce_term" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="reduce_term"
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-status-info-fg" />
                    Reduce term (pay off sooner)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep the same monthly payment, reduce number of remaining installments.
                    Finish your loan earlier and save more interest.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 border border-border rounded-2xl p-4 hover:bg-muted cursor-pointer">
                <RadioGroupItem value="reduce_payment" id="reduce_payment" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="reduce_payment"
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <TrendingDown className="h-4 w-4 text-status-success-fg" />
                    Reduce payment (lower monthly amount)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep the same term, reduce your monthly payment amount.
                    Ease your monthly budget and cash flow.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this prepayment..."
              rows={3}
              disabled={loading}
              className="mt-1"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Processing…' : 'Record prepayment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
