import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * RecordPaymentDialog - Component for recording regular scheduled loan payments
 *
 * @param {Object} loan - The loan object
 * @param {Object} installment - The specific installment being paid
 * @param {boolean} open - Dialog open state
 * @param {Function} onClose - Function to call when dialog closes
 * @param {Function} onSuccess - Function to call after successful payment recording
 */
export function RecordPaymentDialog({ loan, installment, open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    referenceNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate remaining amount for partial payments
  const remainingAmount = installment ? installment.amount - (installment.paidAmount || 0) : 0;
  // Treat amounts less than 1 cent as fully paid (rounding error tolerance)
  const isPartiallyPaid = installment && installment.status === 'partial' && remainingAmount >= 0.01;
  const isFullyPaid = installment && remainingAmount < 0.01;

  // Reset form when dialog opens or installment changes
  useEffect(() => {
    if (open && installment) {
      const defaultAmount = isPartiallyPaid ? remainingAmount : installment.amount;

      setFormData({
        amount: defaultAmount.toFixed(2),
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        referenceNumber: '',
        notes: ''
      });
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error('Please enter a valid payment amount');
      }

      if (!formData.paymentDate) {
        throw new Error('Please select a payment date');
      }

      if (!formData.paymentMethod) {
        throw new Error('Please select a payment method');
      }

      if (!formData.referenceNumber.trim()) {
        throw new Error('Please enter a reference number');
      }

      const response = await api.put(`/loans/${loan._id}/repayment`, {
        installmentNumber: installment.installmentNumber,
        amount: parseFloat(formData.amount),
        paymentDate: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber.trim(),
        notes: formData.notes.trim()
      });

      if (response.data.success) {
        toast.success('Payment recorded');
        onSuccess?.();
        onClose();
      } else {
        throw new Error(response.data.message || 'Failed to record payment');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to record payment';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  if (!installment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record repayment — installment #{installment.installmentNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isFullyPaid && (
            <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
              <strong>Installment already paid:</strong> this installment has been fully paid. Please select a different installment or close this dialog.
            </div>
          )}

          {/* Payment Summary */}
          <div className="bg-status-info-bg rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-status-info-fg">Scheduled amount</span>
              <span className="text-base font-mono font-medium text-status-info-fg">
                {formatCurrency(installment.amount)}
              </span>
            </div>
            {isPartiallyPaid && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-status-info-fg">Already paid</span>
                  <span className="text-sm font-mono text-status-info-fg">
                    {formatCurrency(installment.paidAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-status-info-fg/20 pt-2">
                  <span className="text-sm text-status-info-fg">Remaining</span>
                  <span className="text-base font-mono font-medium text-status-info-fg">
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
              </>
            )}
            {isFullyPaid && (
              <div className="flex justify-between items-center border-t border-status-info-fg/20 pt-2">
                <span className="text-sm text-status-info-fg">Status</span>
                <span className="text-base font-medium text-status-info-fg">Fully paid</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-status-info-fg">Due date</span>
              <span className="text-status-info-fg">{formatDate(installment.dueDate)}</span>
            </div>
          </div>

          {!isFullyPaid && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={(isPartiallyPaid ? remainingAmount : installment.amount).toFixed(2)}
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="Enter payment amount"
                disabled={loading}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {isPartiallyPaid
                  ? `Enter amount up to ${formatCurrency(remainingAmount)} (remaining balance)`
                  : 'You can enter a partial amount if needed'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                disabled={loading}
                required
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Only today or past dates are allowed for payment recording.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment method *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => handleChange('paymentMethod', value)}
                disabled={loading}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="direct_debit">Direct debit</SelectItem>
                  <SelectItem value="standing_order">Standing order</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference number / transaction ID *</Label>
              <Input
                id="referenceNumber"
                type="text"
                value={formData.referenceNumber}
                onChange={(e) => handleChange('referenceNumber', e.target.value)}
                placeholder="e.g., TXN-2026-001234 or bank reference"
                disabled={loading}
                required
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Enter the transaction reference from the bank/payment system
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Add any additional notes about this payment..."
                disabled={loading}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.notes.length}/500 characters
              </p>
            </div>

            {error && (
              <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.paymentMethod || !formData.referenceNumber.trim()}
                className="flex-1"
              >
                {loading ? 'Recording…' : 'Record repayment'}
              </Button>
            </div>
          </form>
          )}

          {isFullyPaid && (
            <div className="flex gap-3 pt-4">
              <Button
                onClick={onClose}
                className="flex-1"
                variant="outline"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
