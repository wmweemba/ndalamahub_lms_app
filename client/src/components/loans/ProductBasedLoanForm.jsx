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
    monthlyIncome: ''
  });
  const [feeCalculation, setFeeCalculation] = useState(null);
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
      monthlyIncome: ''
    });
    setFeeCalculation(null);
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
      if (!selectedProduct.isAmountValid || amount < selectedProduct.amount.min || amount > selectedProduct.amount.max) {
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
        monthlyIncome: parseFloat(formData.monthlyIncome)
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
                      ).filter(n => n % 6 === 0 || n === selectedProduct?.term.default).map(months => (
                        <option key={months} value={months}>
                          {months} months
                        </option>
                      ))}
                    </select>
                  </div>
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
