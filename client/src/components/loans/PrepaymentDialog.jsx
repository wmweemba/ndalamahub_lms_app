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
  const [showQuote, setShowQuote] = useState(false);

  const formatCurrency = (value) => {
    return `ZMW ${parseFloat(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
    setShowQuote(false);
    setSettlementQuote(null);
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

        {/* Get Settlement Quote Button */}
        {!showQuote && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-2">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Early Settlement Quote</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Get a detailed quote to settle this loan completely today. 
                  See exactly how much you'll pay and how much interest you'll save.
                </p>
                <Button
                  onClick={() => {
                    setShowQuote(true);
                    fetchSettlementQuote();
                  }}
                  disabled={loadingQuote}
                  className="bg-blue-600 hover:bg-blue-700 mt-4"
                  size="lg"
                >
                  {loadingQuote ? 'Loading...' : 'Get Settlement Quote'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settlement Quote Details */}
        {showQuote && loadingQuote && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 text-center">Loading settlement quote...</p>
            </CardContent>
          </Card>
        )}

        {showQuote && !loadingQuote && settlementQuote && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4 text-gray-900">Settlement Quote Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Settlement Date:</span>
                  <span className="text-sm font-medium">
                    {new Date().toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="border-t border-blue-200"></div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Remaining Principal:</span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatCurrency(settlementQuote.principalBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Accrued Interest (to date):</span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatCurrency(settlementQuote.interestBalance)}
                  </span>
                </div>
                {settlementQuote.earlySettlementFee > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Early Settlement Fee:</span>
                    <span className="text-base font-semibold text-orange-600">
                      {formatCurrency(settlementQuote.earlySettlementFee)}
                    </span>
                  </div>
                )}
                <div className="border-t-2 border-blue-300 pt-3 mt-2 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Settlement Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(settlementQuote.totalPayoff)}
                  </span>
                </div>
                
                {settlementQuote.futureInterestSaved > 0 && (
                  <div className="bg-green-100 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800">
                          You'll Save {formatCurrency(settlementQuote.futureInterestSaved)}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          By settling today vs continuing with the full repayment schedule
                        </p>
                        {settlementQuote.remainingInstallments > 0 && (
                          <p className="text-xs text-green-700 mt-1">
                            • Skip {settlementQuote.remainingInstallments} remaining payment{settlementQuote.remainingInstallments !== 1 ? 's' : ''}
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Processing...' : 'Settle Loan Now'}
                </Button>
              </div>
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
