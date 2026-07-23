import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProductSelector from './ProductSelector';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { formatCurrency, formatTerm, formatRateBasis } from '@/lib/format';
import { ArrowLeft } from 'lucide-react';

export default function ProductBasedLoanForm({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Select Product, 2: Loan Details
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    term: '',
    purpose: '',
    description: '',
    monthlyIncome: '',
    collateralType: '',
    collateralOtherDescription: '',
    collateralValue: '',
    collateralDescription: '',
    gracePeriod: 0,
    graceType: 'none',
    moratoriumActive: false,
    moratoriumStart: '',
    moratoriumEnd: '',
    moratoriumReason: ''
  });
  const [feeCalculation, setFeeCalculation] = useState(null);
  const [paymentSchedule, setPaymentSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Phase 25: getCurrentUser() is the same in-memory cache the rest of the
  // app reads (hydrated by the time this dialog can even be opened, since
  // it only renders behind ProtectedRoute) — no need for this component's
  // own /auth/me fetch, which used to be a workaround for the old JWT
  // payload not carrying firstName/lastName at all.
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    // Auto-populate defaults when product selected
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        term: prev.term || selectedProduct.term.default.toString(),
        purpose: prev.purpose || `${selectedProduct.name} Application`
      }));
    }
  }, [selectedProduct]);

  // Fetch payment schedule preview when amount or term changes
  useEffect(() => {
    const fetchPaymentSchedule = async () => {
      if (!selectedProduct || !formData.amount || !formData.term) {
        setPaymentSchedule(null);
        return;
      }

      const amount = parseFloat(formData.amount);
      const term = parseInt(formData.term);

      // Validate amount and term
      if (amount < selectedProduct.amount.min || amount > selectedProduct.amount.max) {
        setPaymentSchedule(null);
        return;
      }

      if (term < selectedProduct.term.min || term > selectedProduct.term.max) {
        setPaymentSchedule(null);
        return;
      }

      try {
        const response = await api.post(`/products/${selectedProduct._id}/calculate-schedule`, {
          amount,
          term,
          repaymentFrequency: selectedProduct.repaymentFrequency[0] // Use default frequency
        });

        if (response.data.success) {
          setPaymentSchedule(response.data.data);
        }
      } catch {
        setPaymentSchedule(null);
      }
    };

    const timeoutId = setTimeout(fetchPaymentSchedule, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [selectedProduct, formData.amount, formData.term]);

  useEffect(() => {
    // Calculate fees when amount changes
    if (selectedProduct && formData.amount && parseFloat(formData.amount) > 0) {
      calculateFees();
    } else {
      setFeeCalculation(null);
    }
  }, [formData.amount, selectedProduct]);

  const resetForm = () => {
    setStep(1);
    setSelectedProduct(null);
    setFormData({
      amount: '',
      term: '',
      purpose: '',
      description: '',
      monthlyIncome: '',
      collateralType: '',
      collateralOtherDescription: '',
      collateralValue: '',
      collateralDescription: '',
      gracePeriod: 0,
      graceType: 'none',
      moratoriumActive: false,
      moratoriumStart: '',
      moratoriumEnd: '',
      moratoriumReason: ''
    });
    setFeeCalculation(null);
    setPaymentSchedule(null);
    setError(null);
  };

  const calculateFees = async () => {
    if (!selectedProduct || !formData.amount) return;

    try {
      const response = await api.post(
        `/products/${selectedProduct._id}/calculate-fees`,
        { loanAmount: parseFloat(formData.amount) }
      );
      if (response.data.success) {
        setFeeCalculation(response.data.data);
      }
    } catch {
      // fee preview is best-effort; leave feeCalculation unset on failure
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setStep(2);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.amount || !formData.term || !formData.purpose || !formData.monthlyIncome) {
        throw new Error('Please fill in all required fields');
      }

      const amount = parseFloat(formData.amount);
      const term = parseInt(formData.term);

      // Validate against product limits
      if (amount < selectedProduct.amount.min || amount > selectedProduct.amount.max) {
        throw new Error(`Loan amount must be between ${formatCurrency(selectedProduct.amount.min)} and ${formatCurrency(selectedProduct.amount.max)}`);
      }

      if (term < selectedProduct.term.min || term > selectedProduct.term.max) {
        throw new Error(`Loan term must be between ${formatTerm(selectedProduct.term.min, selectedProduct.term.unit)} and ${formatTerm(selectedProduct.term.max, selectedProduct.term.unit)}`);
      }

      if (selectedProduct.collateralRequired && !formData.collateralType) {
        throw new Error('This product requires collateral — please select a collateral type');
      }
      if (formData.collateralType === 'other' && !formData.collateralOtherDescription) {
        throw new Error('Please specify the "Other" collateral type');
      }

      // Prepare loan application data
      const loanData = {
        productId: selectedProduct._id,
        amount,
        term,
        purpose: formData.purpose,
        description: formData.description,
        monthlyIncome: parseFloat(formData.monthlyIncome),
        gracePeriod: parseInt(formData.gracePeriod) || 0,
        graceType: formData.graceType,
        moratorium: formData.moratoriumActive ? {
          isActive: true,
          startDate: formData.moratoriumStart || undefined,
          endDate: formData.moratoriumEnd || undefined,
          reason: formData.moratoriumReason || undefined
        } : undefined
      };

      const response = await api.post('/loans', loanData);

      if (response.data.success) {
        if (formData.collateralType) {
          const loanId = response.data.data.loan._id;
          await api.post(`/collateral/loans/${loanId}`, {
            type: formData.collateralType,
            otherDescription: formData.collateralType === 'other' ? formData.collateralOtherDescription : undefined,
            description: formData.collateralDescription,
            estimatedValue: parseFloat(formData.collateralValue) || 0
          });
        }
        toast.success('Application submitted');
        onSuccess();
        onClose();
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to submit loan application';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-medium">
            {step === 1 ? 'Select loan product' : 'Loan application'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Product Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <ProductSelector
              onSelect={handleProductSelect}
              selectedProduct={selectedProduct}
            />
          </div>
        )}

        {/* Step 2: Loan Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 sm:p-4 text-sm">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change product
            </Button>

            {/* Selected Product Summary */}
            <Card className="rounded-2xl border-border bg-status-info-bg p-4">
              <h4 className="text-[15px] font-medium text-foreground">{selectedProduct?.name}</h4>
              <p className="text-sm text-status-info-fg mt-1 font-mono">
                {selectedProduct && formatRateBasis(
                  selectedProduct.interestRate.default,
                  selectedProduct.interestCalculation.method,
                  selectedProduct.interestCalculation.rateBasis
                )}
                {' • '}
                {selectedProduct && formatTerm(selectedProduct.term.min, selectedProduct.term.unit)}–
                {selectedProduct && formatTerm(selectedProduct.term.max, selectedProduct.term.unit)}
                {' • '}
                {selectedProduct && formatCurrency(selectedProduct.amount.min)}–{selectedProduct && formatCurrency(selectedProduct.amount.max)}
              </p>
            </Card>

            {/* Applicant Information */}
            <Card className="rounded-2xl border-border p-3 sm:p-4">
              <h3 className="text-[15px] font-medium text-foreground mb-3">
                Applicant information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-foreground">Full name</Label>
                  <Input
                    value={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="monthlyIncome" className="text-sm font-medium text-foreground">
                    Monthly income ({selectedProduct?.amount.currency}) *
                  </Label>
                  <Input
                    id="monthlyIncome"
                    name="monthlyIncome"
                    type="number"
                    min="0"
                    step="100"
                    value={formData.monthlyIncome}
                    onChange={handleChange}
                    placeholder="e.g., 15000"
                    required
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            </Card>

            {/* Loan Details */}
            <Card className="rounded-2xl border-border p-3 sm:p-4">
              <h3 className="text-[15px] font-medium text-foreground mb-3">
                Loan details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="amount" className="text-sm font-medium text-foreground">
                      Loan amount ({selectedProduct?.amount.currency}) *
                    </Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      min={selectedProduct?.amount.min}
                      max={selectedProduct?.amount.max}
                      step="100"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder={`${selectedProduct?.amount.min} - ${selectedProduct?.amount.max}`}
                      required
                      className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Min: {selectedProduct && formatCurrency(selectedProduct.amount.min)} • Max: {selectedProduct && formatCurrency(selectedProduct.amount.max)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="term" className="text-sm font-medium text-foreground">
                      Loan term ({selectedProduct?.term.unit || 'months'}) *
                    </Label>
                    <Select
                      value={formData.term}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, term: value }))}
                    >
                      <SelectTrigger id="term" className="mt-1">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: (selectedProduct?.term.max || 0) - (selectedProduct?.term.min || 0) + 1 },
                          (_, i) => (selectedProduct?.term.min || 0) + i
                        ).filter(n => {
                          if ((selectedProduct?.term.max || 0) <= 12) return true;
                          return n % 6 === 0 || n === selectedProduct?.term.default;
                        }).map(term => (
                          <SelectItem key={term} value={term.toString()}>
                            {formatTerm(term, selectedProduct?.term.unit)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Grace Period & Moratorium Fields */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gracePeriod" className="text-sm font-medium text-foreground">Grace period (months)</Label>
                    <Input
                      id="gracePeriod"
                      name="gracePeriod"
                      type="number"
                      min="0"
                      max="12"
                      value={formData.gracePeriod}
                      onChange={handleChange}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="graceType" className="text-sm font-medium text-foreground">Grace type</Label>
                    <Select
                      value={formData.graceType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, graceType: value }))}
                    >
                      <SelectTrigger id="graceType" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="principal_only">Principal only</SelectItem>
                        <SelectItem value="full_moratorium">Full moratorium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="moratoriumActive"
                        checked={formData.moratoriumActive}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="ml-2 text-sm text-foreground">Apply moratorium</span>
                    </label>
                  </div>
                  {formData.moratoriumActive && (
                    <div className="grid grid-cols-1 gap-3">
                      <Label htmlFor="moratoriumStart" className="text-sm font-medium text-foreground">Moratorium start date</Label>
                      <Input
                        id="moratoriumStart"
                        name="moratoriumStart"
                        type="date"
                        value={formData.moratoriumStart}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <Label htmlFor="moratoriumEnd" className="text-sm font-medium text-foreground">Moratorium end date</Label>
                      <Input
                        id="moratoriumEnd"
                        name="moratoriumEnd"
                        type="date"
                        value={formData.moratoriumEnd}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <Label htmlFor="moratoriumReason" className="text-sm font-medium text-foreground">Moratorium reason</Label>
                      <Input
                        id="moratoriumReason"
                        name="moratoriumReason"
                        type="text"
                        value={formData.moratoriumReason}
                        onChange={handleChange}
                        placeholder="e.g., COVID-19, Emergency, etc."
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="purpose" className="text-sm font-medium text-foreground">
                    Loan purpose *
                  </Label>
                  <Input
                    id="purpose"
                    name="purpose"
                    type="text"
                    value={formData.purpose}
                    onChange={handleChange}
                    placeholder="e.g., Business expansion, Home renovation"
                    required
                    className="mt-1"
                    maxLength="200"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-foreground">
                    Additional details (optional)
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide any additional information about your loan request..."
                    className="mt-1 min-h-[80px]"
                    maxLength="500"
                  />
                </div>
              </div>
            </Card>

            {/* Collateral Information (optional for all products) */}
            {selectedProduct && (
              <Card className="rounded-2xl border-border p-3 sm:p-4">
                <h3 className="text-[15px] font-medium text-foreground mb-3">
                  Collateral details {selectedProduct.collateralRequired && <span className="text-destructive">*</span>} {!selectedProduct.collateralRequired && <span className="text-xs text-muted-foreground">(Optional)</span>}
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="collateralType" className="text-sm font-medium text-foreground">
                      Collateral type {selectedProduct.collateralRequired && '*'}
                    </Label>
                    <Select
                      value={formData.collateralType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, collateralType: value }))}
                    >
                      <SelectTrigger id="collateralType" className="mt-1">
                        <SelectValue placeholder="Select collateral type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vehicle">Vehicle</SelectItem>
                        <SelectItem value="business_equipment">Business equipment</SelectItem>
                        <SelectItem value="title_deed">Title deed</SelectItem>
                        <SelectItem value="other">Other — specify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.collateralType === 'other' && (
                    <div>
                      <Label htmlFor="collateralOtherDescription" className="text-sm font-medium text-foreground">
                        Specify collateral type *
                      </Label>
                      <Input
                        id="collateralOtherDescription"
                        name="collateralOtherDescription"
                        type="text"
                        value={formData.collateralOtherDescription}
                        onChange={handleChange}
                        placeholder="e.g., Livestock"
                        required
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="collateralValue" className="text-sm font-medium text-foreground">
                        Estimated value ({selectedProduct?.amount.currency}) {selectedProduct.collateralRequired && '*'}
                      </Label>
                      <Input
                        id="collateralValue"
                        name="collateralValue"
                        type="number"
                        min="0"
                        step="1000"
                        value={formData.collateralValue}
                        onChange={handleChange}
                        placeholder="e.g., 50000"
                        required={selectedProduct.collateralRequired}
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="collateralDescription" className="text-sm font-medium text-foreground">
                        Description {selectedProduct.collateralRequired && '*'}
                      </Label>
                      <Input
                        id="collateralDescription"
                        name="collateralDescription"
                        type="text"
                        value={formData.collateralDescription}
                        onChange={handleChange}
                        placeholder="e.g., Title deed for residential property"
                        required={selectedProduct.collateralRequired}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Fee Calculation */}
            {feeCalculation && (
              <Card className="rounded-2xl border-border p-3 sm:p-4">
                <h3 className="text-[15px] font-medium text-foreground mb-3">
                  Fee breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan amount</span>
                    <span className="font-mono font-medium text-foreground">{formatCurrency(feeCalculation.loanAmount)}</span>
                  </div>
                  {feeCalculation.fees.processingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span className="font-mono font-medium text-status-warning-fg">
                        {formatCurrency(feeCalculation.fees.processingFee)}
                      </span>
                    </div>
                  )}
                  {feeCalculation.fees.insuranceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance fee</span>
                      <span className="font-mono font-medium text-status-warning-fg">
                        {formatCurrency(feeCalculation.fees.insuranceFee)}
                      </span>
                    </div>
                  )}
                  {feeCalculation.fees.totalUpfrontFees > 0 && (
                    <>
                      <div className="border-t border-border pt-2 flex justify-between">
                        <span className="font-medium text-foreground">Net disbursement</span>
                        <span className="font-mono font-medium text-status-success-fg">
                          {formatCurrency(feeCalculation.netDisbursement)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground bg-status-info-bg text-status-info-fg p-2 rounded-2xl">
                        Fees will be deducted from the loan amount upon disbursement
                      </p>
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Payment Schedule Preview */}
            {paymentSchedule && (
              <Card className="rounded-2xl border-border p-3 sm:p-4">
                <h3 className="text-[15px] font-medium text-foreground mb-3">
                  Repayment preview
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="bg-status-info-bg rounded-2xl p-3">
                      <div className="text-status-info-fg text-xs mb-1">Payment</div>
                      <div className="font-mono font-medium text-status-info-fg text-lg">
                        {paymentSchedule.monthlyPayment !== undefined ? formatCurrency(paymentSchedule.monthlyPayment) : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-status-info-bg rounded-2xl p-3">
                      <div className="text-status-info-fg text-xs mb-1">Total repayment</div>
                      <div className="font-mono font-medium text-status-info-fg text-lg">
                        {paymentSchedule.totalRepayment !== undefined ? formatCurrency(paymentSchedule.totalRepayment) : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-status-info-bg rounded-2xl p-3">
                      <div className="text-status-info-fg text-xs mb-1">Total interest</div>
                      <div className="font-mono font-medium text-status-info-fg text-lg">
                        {paymentSchedule.totalInterest !== undefined ? formatCurrency(paymentSchedule.totalInterest) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* First 3 Installments Preview */}
                  {paymentSchedule.schedule && paymentSchedule.schedule.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">First 3 installments:</div>
                      <div className="overflow-x-auto rounded-2xl border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-2 py-1 text-left text-muted-foreground">#</th>
                              <th className="px-2 py-1 text-right text-muted-foreground">Principal</th>
                              <th className="px-2 py-1 text-right text-muted-foreground">Interest</th>
                              <th className="px-2 py-1 text-right text-muted-foreground">Payment</th>
                              <th className="px-2 py-1 text-right text-muted-foreground">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentSchedule.schedule.slice(0, 3).map((inst, idx) => (
                              <tr key={idx} className="border-b border-border last:border-0">
                                <td className="px-2 py-1">{inst.installmentNumber}</td>
                                <td className="px-2 py-1 text-right font-mono">{formatCurrency(inst.principalPayment)}</td>
                                <td className="px-2 py-1 text-right font-mono">{formatCurrency(inst.interestPayment)}</td>
                                <td className="px-2 py-1 text-right font-mono font-medium">{formatCurrency(inst.totalPayment)}</td>
                                <td className="px-2 py-1 text-right font-mono text-muted-foreground">{formatCurrency(inst.remainingBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {paymentSchedule.schedule.length > 3 && (
                        <div className="text-xs text-muted-foreground mt-1 text-center">
                          ... and {paymentSchedule.schedule.length - 3} more installments
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Submit Button */}
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
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
