import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/utils/api';
import { AlertCircle, CheckCircle2, DollarSign, Calendar, CreditCard, Hash, FileText } from 'lucide-react';

/**
 * RecordPaymentDialog - Component for recording regular scheduled loan payments
 * 
 * Features:
 * - Payment amount (pre-filled with installment amount)
 * - Payment date (PRODUCTION: Today or past dates only)
 * - Payment method (Bank Transfer, Cash, Cheque, Mobile Money, etc.)
 * - Reference number (transaction ID)
 * - Notes (optional)
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
    paymentDate: new Date().toISOString().split('T')[0], // Default to today
    paymentMethod: '',
    referenceNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate remaining amount for partial payments
  const remainingAmount = installment ? installment.amount - (installment.paidAmount || 0) : 0;
  // Treat amounts less than 1 cent as fully paid (rounding error tolerance)
  const isPartiallyPaid = installment && installment.status === 'partial' && remainingAmount >= 0.01;
  const isFullyPaid = installment && remainingAmount < 0.01;

  // Reset form when dialog opens or installment changes
  useEffect(() => {
    if (open && installment) {
      // Set initial amount based on remaining balance
      const defaultAmount = isPartiallyPaid ? remainingAmount : installment.amount;
      
      setFormData({
        amount: defaultAmount.toFixed(2),
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        referenceNumber: '',
        notes: ''
      });
      setError('');
      setSuccess('');
    }
  }, [open, installment, isPartiallyPaid, remainingAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validation
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

      // Call API
      const response = await api.put(`/loans/${loan._id}/repayment`, {
        installmentNumber: installment.installmentNumber,
        amount: parseFloat(formData.amount),
        paymentDate: formData.paymentDate,
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber.trim(),
        notes: formData.notes.trim()
      });

      if (response.data.success) {
        setSuccess('Payment recorded successfully!');
        
        // Wait a moment for user to see success message
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        throw new Error(response.data.message || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Record payment error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user makes changes
  };

  if (!installment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Record Payment - Installment #{installment.installmentNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Fully Paid Warning */}
          {isFullyPaid && (
            <Alert className="bg-red-50 border-red-300">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                <strong>Installment Already Paid:</strong> This installment has been fully paid. Please select a different installment or close this dialog.
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Summary */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Scheduled Amount:</span>
              <span className="text-lg font-bold text-gray-900">
                ZMW {installment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {isPartiallyPaid && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Already Paid:</span>
                  <span className="text-base text-gray-700">
                    ZMW {(installment.paidAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-blue-200 pt-2">
                  <span className="text-sm font-medium text-gray-600">Remaining:</span>
                  <span className="text-lg font-bold text-green-600">
                    ZMW {remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
            {isFullyPaid && (
              <div className="flex justify-between items-center border-t border-blue-200 pt-2">
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className="text-lg font-bold text-green-600">Fully Paid</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Due Date:</span>
              <span className="text-gray-900">{new Date(installment.dueDate).toLocaleDateString()}</span>
            </div>
          </div>

          {/* ...existing code... */}

          {/* Show form only if not fully paid */}
          {!isFullyPaid && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payment Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payment Amount (ZMW) *
              </Label>
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
              />
              <p className="text-xs text-gray-500">
                {isPartiallyPaid 
                  ? `Enter amount up to ZMW ${remainingAmount.toFixed(2)} (remaining balance)`
                  : 'You can enter a partial amount if needed'}
              </p>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Payment Date *
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                disabled={loading}
                required
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500">
                📅 Only today or past dates are allowed for payment recording.
              </p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Method *
              </Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => handleChange('paymentMethod', value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="direct_debit">Direct Debit</SelectItem>
                  <SelectItem value="standing_order">Standing Order</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Reference Number / Transaction ID *
              </Label>
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
              <p className="text-xs text-gray-500">
                Enter the transaction reference from the bank/payment system
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Add any additional notes about this payment..."
                disabled={loading}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500">
                {formData.notes.length}/500 characters
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 border-green-300">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
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
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
          )}

          {/* Show close button only when fully paid */}
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
