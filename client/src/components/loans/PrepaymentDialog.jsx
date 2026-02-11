import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/utils/api';
import { AlertCircle, TrendingDown, Clock, CheckCircle } from 'lucide-react';

export function PrepaymentDialog({ loan, open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState('reduce_term');
  const [notes, setNotes] = useState('');
  const [settlementQuote, setSettlementQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  const formatCurrency = (value) => {
    return `ZMW ${parseFloat(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fetch settlement quote when dialog opens
  useEffect(() => {
    if (open && loan) {
      fetchSettlementQuote();
    }
  }, [open, loan]);

  const fetchSettlementQuote = async () => {
    if (!loan) return;
    
    setLoadingQuote(true);
    try {
      const response = await api.get(`/loans/${loan._id}/settlement-quote`);
      if (response.data.success) {
        setSettlementQuote(response.data.data.settlement);
      }
    } catch (err) {
      console.error('Error fetching settlement quote:', err);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
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
        if (onSuccess) {
          onSuccess(response.data.data);
        }
        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record prepayment');
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
        if (onSuccess) {
          onSuccess(response.data.data);
        }
        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process early settlement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setStrategy('reduce_term');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prepayment & Early Settlement</DialogTitle>
          <DialogDescription>
            Record extra payment or settle loan completely for {loan.loanNumber}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Settlement Quote Card */}
        {loadingQuote ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 text-center">Loading settlement quote...</p>
            </CardContent>
          </Card>
        ) : settlementQuote && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Current Balance:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(settlementQuote.principalBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accrued Interest:</span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(settlementQuote.interestBalance)}
                  </span>
                </div>
                {settlementQuote.earlySettlementFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Early Settlement Fee:</span>
                    <span className="text-sm font-semibold text-orange-600">
                      {formatCurrency(settlementQuote.earlySettlementFee)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="font-medium text-gray-900">Total Payoff Amount:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(settlementQuote.totalPayoff)}
                  </span>
                </div>
                {settlementQuote.futureInterestSaved > 0 && (
                  <div className="bg-green-100 rounded-md p-3 mt-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Save {formatCurrency(settlementQuote.futureInterestSaved)}
                        </p>
                        <p className="text-xs text-green-700">
                          by settling early vs continuing with schedule
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                onClick={handleEarlySettlement}
                disabled={loading}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Processing...' : 'Settle Loan Completely'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="border-t my-4"></div>

        {/* Prepayment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount" className="text-base font-semibold">
              Partial Prepayment
            </Label>
            <p className="text-sm text-gray-500 mb-3">
              Make an extra payment to reduce your loan
            </p>
          </div>

          <div>
            <Label htmlFor="amount">Prepayment Amount (ZMW) *</Label>
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
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Any amount above your regular payment
            </p>
          </div>

          <div>
            <Label className="text-base mb-3 block">Allocation Strategy *</Label>
            <RadioGroup
              value={strategy}
              onValueChange={setStrategy}
              disabled={loading}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="reduce_term" id="reduce_term" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="reduce_term"
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-blue-600" />
                    Reduce Term (Pay Off Sooner)
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Keep the same monthly payment, reduce number of remaining installments.
                    Finish your loan earlier and save more interest.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="reduce_payment" id="reduce_payment" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="reduce_payment"
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    Reduce Payment (Lower Monthly Amount)
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Keep the same term, reduce your monthly payment amount.
                    Ease your monthly budget and cash flow.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
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
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Processing...' : 'Record Prepayment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
