import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/utils/api';

export function EditProductDialog({ open, onOpenChange, onSuccess, product }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (product && open) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || 'personal',
        interestRate: product.interestRate || { min: 12, max: 24, default: 18 },
        term: product.term || { min: 6, max: 36, default: 12 },
        amount: product.amount || { min: 5000, max: 50000, currency: 'ZMW' },
        interestCalculation: product.interestCalculation || {
          method: 'reducing_balance',
          dayCountConvention: 'actual/365'
        },
        repaymentFrequency: product.repaymentFrequency || ['monthly'],
        fees: product.fees || {
          processingFee: { type: 'percentage', amount: 2.5 },
          latePenalty: { type: 'percentage', amount: 5 },
          earlySettlementFee: { type: 'percentage', amount: 2 },
          insuranceFee: { type: 'percentage', amount: 0, required: false }
        },
        collateralRequired: product.collateralRequired || false,
        collateralTypes: product.collateralTypes || [],
        gracePeriod: product.gracePeriod || { allowed: false, maxMonths: 0, interestDuring: 'accrued' },
        prepayment: product.prepayment || { allowed: true, penalty: false, penaltyRate: 0 },
        eligibilityCriteria: product.eligibilityCriteria || {
          minAge: 18,
          maxAge: 65,
          minIncome: 3000,
          minEmploymentMonths: 6,
          minCreditScore: 600,
          employmentTypes: ['permanent', 'contract']
        },
        isActive: product.isActive !== undefined ? product.isActive : true
      });
    }
  }, [product, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData || !product) return;

    setLoading(true);
    try {
      await api.put(`/products/${product._id}`, formData);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating product:', error);
      alert(error.response?.data?.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Loan Product</DialogTitle>
          <DialogDescription>
            Update the loan product configuration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                    <option value="payday">Payday</option>
                    <option value="bridge">Bridge</option>
                    <option value="microfinance">Microfinance</option>
                    <option value="auto">Auto</option>
                    <option value="education">Education</option>
                    <option value="mortgage">Mortgage</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Interest Rate */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Interest Rate (%)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Minimum</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.interestRate.min}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestRate: { ...formData.interestRate, min: parseFloat(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.interestRate.max}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestRate: { ...formData.interestRate, max: parseFloat(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.interestRate.default}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestRate: { ...formData.interestRate, default: parseFloat(e.target.value) }
                    })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Loan Amount */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Loan Amount (K)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum</Label>
                  <Input
                    type="number"
                    value={formData.amount.min}
                    onChange={(e) => setFormData({
                      ...formData,
                      amount: { ...formData.amount, min: parseFloat(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum</Label>
                  <Input
                    type="number"
                    value={formData.amount.max}
                    onChange={(e) => setFormData({
                      ...formData,
                      amount: { ...formData.amount, max: parseFloat(e.target.value) }
                    })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Loan Term */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Loan Term (Months)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Minimum</Label>
                  <Input
                    type="number"
                    value={formData.term.min}
                    onChange={(e) => setFormData({
                      ...formData,
                      term: { ...formData.term, min: parseInt(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum</Label>
                  <Input
                    type="number"
                    value={formData.term.max}
                    onChange={(e) => setFormData({
                      ...formData,
                      term: { ...formData.term, max: parseInt(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default</Label>
                  <Input
                    type="number"
                    value={formData.term.default}
                    onChange={(e) => setFormData({
                      ...formData,
                      term: { ...formData.term, default: parseInt(e.target.value) }
                    })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Calculation Method */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Interest Calculation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <select
                    value={formData.interestCalculation.method}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestCalculation: { ...formData.interestCalculation, method: e.target.value }
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="reducing_balance">Reducing Balance</option>
                    <option value="flat_rate">Flat Rate</option>
                    <option value="simple_interest">Simple Interest</option>
                    <option value="interest_only">Interest Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Day Count Convention</Label>
                  <select
                    value={formData.interestCalculation.dayCountConvention}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestCalculation: { ...formData.interestCalculation, dayCountConvention: e.target.value }
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="actual/365">Actual/365</option>
                    <option value="actual/360">Actual/360</option>
                    <option value="30/360">30/360</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fees */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Processing Fee</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={formData.fees.processingFee.type}
                    onChange={(e) => setFormData({
                      ...formData,
                      fees: { ...formData.fees, processingFee: { ...formData.fees.processingFee, type: e.target.value } }
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Amount {formData.fees.processingFee.type === 'percentage' ? '(%)' : '(K)'}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.fees.processingFee.amount}
                    onChange={(e) => setFormData({
                      ...formData,
                      fees: { ...formData.fees, processingFee: { ...formData.fees.processingFee, amount: parseFloat(e.target.value) } }
                    })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditProductDialog;
