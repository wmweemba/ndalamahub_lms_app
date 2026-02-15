import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import ProductSelector from './ProductSelector';
import api from '@/utils/api';
import { DollarSign, FileText, ArrowLeft, Calculator, Info } from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (open) {
      fetchCurrentUser();
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
      } catch (err) {
        console.error('Error fetching payment schedule:', err);
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

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setCurrentUser(response.data.data.user);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

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
      collateralValue: '',
      collateralDescription: ''
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
    } catch (err) {
      console.error('Failed to calculate fees:', err);
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setStep(2);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
        throw new Error(`Loan amount must be between ${selectedProduct.amount.currency} ${selectedProduct.amount.min.toLocaleString()} and ${selectedProduct.amount.currency} ${selectedProduct.amount.max.toLocaleString()}`);
      }

      if (term < selectedProduct.term.min || term > selectedProduct.term.max) {
        throw new Error(`Loan term must be between ${selectedProduct.term.min} and ${selectedProduct.term.max} months`);
      }

      // Prepare loan application data
      const loanData = {
        productId: selectedProduct._id,
        amount,
        term,
        purpose: formData.purpose,
        description: formData.description,
        monthlyIncome: parseFloat(formData.monthlyIncome),
        collateral: formData.collateralType ? {
          type: formData.collateralType,
          value: parseFloat(formData.collateralValue) || 0,
          description: formData.collateralDescription
        } : undefined,
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
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit loan application');
      console.error('Loan application error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg sm:text-xl">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
            {step === 1 ? 'Select Loan Product' : 'Loan Application'}
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
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 sm:p-4 text-sm">
                {error}
              </div>
            )}

            {/* Back Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Product
            </Button>

            {/* Selected Product Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-blue-900">{selectedProduct?.name}</h4>
                    <CardDescription className="text-sm text-blue-700 mt-1">
                      {selectedProduct?.interestRate.default}% APR • {selectedProduct?.term.min}-{selectedProduct?.term.max} months • {selectedProduct?.amount.currency} {selectedProduct?.amount.min.toLocaleString()}-{selectedProduct?.amount.max.toLocaleString()}
                    </CardDescription>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applicant Information */}
            <Card className="p-3 sm:p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">
                Applicant Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                  <Input 
                    value={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="monthlyIncome" className="text-sm font-medium text-gray-700">
                    Monthly Income ({selectedProduct?.amount.currency}) *
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
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>

            {/* Loan Details */}
            <Card className="p-3 sm:p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
                Loan Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                      Loan Amount ({selectedProduct?.amount.currency}) *
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
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min: {selectedProduct?.amount.currency} {selectedProduct?.amount.min.toLocaleString()} • Max: {selectedProduct?.amount.currency} {selectedProduct?.amount.max.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="term" className="text-sm font-medium text-gray-700">
                      Loan Term (months) *
                    </Label>
                    <select
                      id="term"
                      name="term"
                      value={formData.term}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select term</option>
                      {Array.from(
                        { length: selectedProduct?.term.max - selectedProduct?.term.min + 1 },
                        (_, i) => selectedProduct?.term.min + i
                      ).filter(n => {
                        // For short-term loans (≤12 months), show all options
                        if (selectedProduct?.term.max <= 12) return true;
                        // For long-term loans, show multiples of 6 or default
                        return n % 6 === 0 || n === selectedProduct?.term.default;
                      }).map(months => (
                        <option key={months} value={months}>
                          {months} months
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grace Period & Moratorium Fields */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gracePeriod" className="text-sm font-medium text-gray-700">Grace Period (months)</Label>
                    <Input
                      id="gracePeriod"
                      name="gracePeriod"
                      type="number"
                      min="0"
                      max="12"
                      value={formData.gracePeriod}
                      onChange={handleChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="graceType" className="text-sm font-medium text-gray-700">Grace Type</Label>
                    <select
                      id="graceType"
                      name="graceType"
                      value={formData.graceType}
                      onChange={handleChange}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="principal_only">Principal Only</option>
                      <option value="full_moratorium">Full Moratorium</option>
                    </select>
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Apply Moratorium</span>
                    </label>
                  </div>
                  {formData.moratoriumActive && (
                    <div className="grid grid-cols-1 gap-3">
                      <Label htmlFor="moratoriumStart" className="text-sm font-medium text-gray-700">Moratorium Start Date</Label>
                      <Input
                        id="moratoriumStart"
                        name="moratoriumStart"
                        type="date"
                        value={formData.moratoriumStart}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <Label htmlFor="moratoriumEnd" className="text-sm font-medium text-gray-700">Moratorium End Date</Label>
                      <Input
                        id="moratoriumEnd"
                        name="moratoriumEnd"
                        type="date"
                        value={formData.moratoriumEnd}
                        onChange={handleChange}
                        className="mt-1"
                      />
                      <Label htmlFor="moratoriumReason" className="text-sm font-medium text-gray-700">Moratorium Reason</Label>
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
                  <Label htmlFor="purpose" className="text-sm font-medium text-gray-700">
                    Loan Purpose *
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
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                    Additional Details (Optional)
                  </Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide any additional information about your loan request..."
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]"
                    maxLength="500"
                  />
                </div>
              </div>
            </Card>

            {/* Collateral Information (optional for all products) */}
            {selectedProduct && (
              <Card className="p-3 sm:p-4">
                <h3 className="text-base font-medium text-gray-900 mb-3">
                  Collateral Details {selectedProduct.collateralRequired && <span className="text-red-500">*</span>} {!selectedProduct.collateralRequired && <span className="text-xs text-gray-500">(Optional)</span>}
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="collateralType" className="text-sm font-medium text-gray-700">
                      Collateral Type {selectedProduct.collateralRequired && '*'}
                    </Label>
                    <select
                      id="collateralType"
                      name="collateralType"
                      value={formData.collateralType}
                      onChange={handleChange}
                      required={selectedProduct.collateralRequired}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select collateral type</option>
                      <option value="property">Property</option>
                      <option value="vehicle">Vehicle</option>
                      <option value="equipment">Equipment</option>
                      <option value="inventory">Inventory</option>
                      <option value="securities">Securities</option>
                      <option value="guarantor">Guarantor</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="collateralValue" className="text-sm font-medium text-gray-700">
                        Estimated Value ({selectedProduct?.amount.currency}) {selectedProduct.collateralRequired && '*'}
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
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="collateralDescription" className="text-sm font-medium text-gray-700">
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
              <Card className="p-3 sm:p-4 bg-gray-50">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <Calculator className="w-4 h-4 mr-2 text-blue-600" />
                  Fee Breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Amount:</span>
                    <span className="font-medium">{feeCalculation.currency} {feeCalculation.loanAmount.toLocaleString()}</span>
                  </div>
                  {feeCalculation.fees.processingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processing Fee:</span>
                      <span className="font-medium text-orange-600">
                        {feeCalculation.currency} {feeCalculation.fees.processingFee.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {feeCalculation.fees.insuranceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Insurance Fee:</span>
                      <span className="font-medium text-orange-600">
                        {feeCalculation.currency} {feeCalculation.fees.insuranceFee.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {feeCalculation.fees.totalUpfrontFees > 0 && (
                    <>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span className="text-gray-900">Net Disbursement:</span>
                        <span className="text-green-600">
                          {feeCalculation.currency} {feeCalculation.netDisbursement.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Fees will be deducted from the loan amount upon disbursement</span>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Payment Schedule Preview */}
            {paymentSchedule && (
              <Card className="p-3 sm:p-4 bg-green-50 border-green-200">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <Info className="w-4 h-4 mr-2 text-green-600" />
                  Repayment Preview
                </h3>
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white p-3 rounded border border-green-200">
                      <div className="text-gray-600 text-xs mb-1">Monthly Payment</div>
                      <div className="font-bold text-green-700 text-lg">
                        {feeCalculation?.currency || 'ZMW'} {paymentSchedule.monthlyPayment?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-green-200">
                      <div className="text-gray-600 text-xs mb-1">Total Repayment</div>
                      <div className="font-bold text-blue-700 text-lg">
                        {feeCalculation?.currency || 'ZMW'} {paymentSchedule.totalRepayment?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-green-200">
                      <div className="text-gray-600 text-xs mb-1">Total Interest</div>
                      <div className="font-bold text-orange-700 text-lg">
                        {feeCalculation?.currency || 'ZMW'} {paymentSchedule.totalInterest?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* First 3 Installments Preview */}
                  {paymentSchedule.schedule && paymentSchedule.schedule.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">First 3 Installments:</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-gray-200 rounded">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left">#</th>
                              <th className="px-2 py-1 text-right">Principal</th>
                              <th className="px-2 py-1 text-right">Interest</th>
                              <th className="px-2 py-1 text-right">Payment</th>
                              <th className="px-2 py-1 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {paymentSchedule.schedule.slice(0, 3).map((inst, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="px-2 py-1">{inst.installmentNumber}</td>
                                <td className="px-2 py-1 text-right">{inst.principalPayment?.toLocaleString()}</td>
                                <td className="px-2 py-1 text-right">{inst.interestPayment?.toLocaleString()}</td>
                                <td className="px-2 py-1 text-right font-medium">{inst.totalPayment?.toLocaleString()}</td>
                                <td className="px-2 py-1 text-right text-gray-600">{inst.remainingBalance?.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {paymentSchedule.schedule.length > 3 && (
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          ... and {paymentSchedule.schedule.length - 3} more installments
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Submit Button */}
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
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
