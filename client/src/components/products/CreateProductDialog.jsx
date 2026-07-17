import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/utils/api';

export function CreateProductDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'personal',
    interestRate: { min: 12, max: 24, default: 18 },
    term: { min: 6, max: 36, default: 12, unit: 'months' },
    amount: { min: 5000, max: 50000, currency: 'ZMW' },
    interestCalculation: {
      method: 'reducing_balance',
      rateBasis: 'per_annum',
      dayCountConvention: 'actual/365'
    },
    repaymentFrequency: ['monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 2.5 },
      latePenalty: { type: 'percentage', amount: 5 },
      earlySettlementFee: { type: 'percentage', amount: 2 },
      insuranceFee: { type: 'percentage', amount: 0, required: false }
    },
    collateralRequired: false,
    collateralTypes: [],
    gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'accrued' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    eligibilityCriteria: {
      minAge: 18,
      maxAge: 65,
      minIncome: 3000,
      minEmploymentMonths: 6,
      minCreditScore: 600,
      employmentTypes: ['permanent', 'contract']
    },
    isActive: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/products', formData);
      onSuccess?.();
      onOpenChange(false);
      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'personal',
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 36, default: 12, unit: 'months' },
        amount: { min: 5000, max: 50000, currency: 'ZMW' },
        interestCalculation: {
          method: 'reducing_balance',
          rateBasis: 'per_annum',
          dayCountConvention: 'actual/365'
        },
        repaymentFrequency: ['monthly'],
        fees: {
          processingFee: { type: 'percentage', amount: 2.5 },
          latePenalty: { type: 'percentage', amount: 5 },
          earlySettlementFee: { type: 'percentage', amount: 2 },
          insuranceFee: { type: 'percentage', amount: 0, required: false }
        },
        collateralRequired: false,
        collateralTypes: [],
        gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'accrued' },
        prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
        eligibilityCriteria: {
          minAge: 18,
          maxAge: 65,
          minIncome: 3000,
          minEmploymentMonths: 6,
          minCreditScore: 600,
          employmentTypes: ['permanent', 'contract']
        },
        isActive: true
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Loan Product</DialogTitle>
          <DialogDescription>
            Configure a new loan product with interest rates, terms, and eligibility criteria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Personal Loan - Standard"
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
                  placeholder="Brief description of the loan product"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            {/* Interest Rate */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Interest Rate (%)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interestMin">Minimum</Label>
                  <Input
                    id="interestMin"
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
                  <Label htmlFor="interestMax">Maximum</Label>
                  <Input
                    id="interestMax"
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
                  <Label htmlFor="interestDefault">Default</Label>
                  <Input
                    id="interestDefault"
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
              <h3 className="text-[15px] font-medium text-foreground">Loan Amount (K)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amountMin">Minimum</Label>
                  <Input
                    id="amountMin"
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
                  <Label htmlFor="amountMax">Maximum</Label>
                  <Input
                    id="amountMax"
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
              <h3 className="text-[15px] font-medium text-foreground">
                Loan Term ({formData.term.unit === 'days' ? 'Days' : formData.term.unit === 'weeks' ? 'Weeks' : 'Months'})
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="termMin">Minimum</Label>
                  <Input
                    id="termMin"
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
                  <Label htmlFor="termMax">Maximum</Label>
                  <Input
                    id="termMax"
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
                  <Label htmlFor="termDefault">Default</Label>
                  <Input
                    id="termDefault"
                    type="number"
                    value={formData.term.default}
                    onChange={(e) => setFormData({
                      ...formData,
                      term: { ...formData.term, default: parseInt(e.target.value) }
                    })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termUnit">Unit</Label>
                  <select
                    id="termUnit"
                    value={formData.term.unit}
                    onChange={(e) => setFormData({
                      ...formData,
                      term: { ...formData.term, unit: e.target.value }
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculation Method */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Interest Calculation</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Calculation Method</Label>
                  <select
                    id="method"
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
                  <Label htmlFor="rateBasis">Rate Basis</Label>
                  <select
                    id="rateBasis"
                    value={formData.interestCalculation.rateBasis}
                    onChange={(e) => setFormData({
                      ...formData,
                      interestCalculation: { ...formData.interestCalculation, rateBasis: e.target.value }
                    })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="per_annum">Per annum</option>
                    <option value="per_term">Per term</option>
                    <option value="per_period">Per period</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayCount">Day Count Convention</Label>
                  <select
                    id="dayCount"
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

            {/* Fees Section */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Fees</h3>
              
              {/* Processing Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="feeType">Processing Fee Type</Label>
                  <select
                    id="feeType"
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
                  <Label htmlFor="feeAmount">
                    Amount {formData.fees.processingFee.type === 'percentage' ? '(%)' : '(K)'}
                  </Label>
                  <Input
                    id="feeAmount"
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

              {/* Insurance Fee */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="insuranceType">Insurance Fee Type</Label>
                    <select
                      id="insuranceType"
                      value={formData.fees.insuranceFee.type}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, insuranceFee: { ...formData.fees.insuranceFee, type: e.target.value } }
                      })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceAmount">
                      Amount {formData.fees.insuranceFee.type === 'percentage' ? '(%)' : '(K)'}
                    </Label>
                    <Input
                      id="insuranceAmount"
                      type="number"
                      step="0.1"
                      value={formData.fees.insuranceFee.amount}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, insuranceFee: { ...formData.fees.insuranceFee, amount: parseFloat(e.target.value) } }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insuranceRequired" className="block">Required</Label>
                    <div className="flex items-center h-10">
                      <input
                        type="checkbox"
                        id="insuranceRequired"
                        checked={formData.fees.insuranceFee.required}
                        onChange={(e) => setFormData({
                          ...formData,
                          fees: { ...formData.fees, insuranceFee: { ...formData.fees.insuranceFee, required: e.target.checked } }
                        })}
                        className="h-4 w-4 rounded border-border"
                      />
                      <label htmlFor="insuranceRequired" className="ml-2 text-sm text-muted-foreground">
                        Mandatory
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Repayment Frequency */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Repayment Frequency</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['monthly', 'weekly', 'bi_weekly', 'quarterly', 'annually'].map(freq => (
                  <label key={freq} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.repaymentFrequency.includes(freq)}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...formData.repaymentFrequency, freq]
                          : formData.repaymentFrequency.filter(f => f !== freq);
                        setFormData({ ...formData, repaymentFrequency: updated });
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm capitalize">{freq.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Collateral */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Collateral Requirements</h3>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="collateralRequired"
                  checked={formData.collateralRequired}
                  onChange={(e) => setFormData({ ...formData, collateralRequired: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="collateralRequired">Collateral Required</Label>
              </div>
              {formData.collateralRequired && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pl-6">
                  {['property', 'vehicle', 'equipment', 'inventory', 'securities', 'guarantor', 'other'].map(type => (
                    <label key={type} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.collateralTypes || []).includes(type)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...(formData.collateralTypes || []), type]
                            : (formData.collateralTypes || []).filter(t => t !== type);
                          setFormData({ ...formData, collateralTypes: updated });
                        }}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Grace Period */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Grace Period</h3>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="gracePeriodAllowed"
                  checked={formData.gracePeriod?.allowed || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    gracePeriod: { ...formData.gracePeriod, allowed: e.target.checked }
                  })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="gracePeriodAllowed">Allow Grace Period</Label>
              </div>
              {formData.gracePeriod?.allowed && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="graceMaxMonths">Maximum Months</Label>
                    <Input
                      id="graceMaxMonths"
                      type="number"
                      min="0"
                      value={formData.gracePeriod?.maxMonths || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        gracePeriod: { ...formData.gracePeriod, maxMonths: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="graceInterest">Interest During Grace</Label>
                    <select
                      id="graceInterest"
                      value={formData.gracePeriod?.interestDuring || 'accrued'}
                      onChange={(e) => setFormData({
                        ...formData,
                        gracePeriod: { ...formData.gracePeriod, interestDuring: e.target.value }
                      })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="accrued">Accrued</option>
                      <option value="capitalized">Capitalized</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Prepayment */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Prepayment Settings</h3>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="prepaymentAllowed"
                  checked={formData.prepayment?.allowed ?? true}
                  onChange={(e) => setFormData({
                    ...formData,
                    prepayment: { ...formData.prepayment, allowed: e.target.checked }
                  })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="prepaymentAllowed">Allow Prepayment</Label>
              </div>
              {formData.prepayment?.allowed && (
                <div className="pl-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="prepaymentPenalty"
                      checked={formData.prepayment?.penalty || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        prepayment: { ...formData.prepayment, penalty: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="prepaymentPenalty">Prepayment Penalty</Label>
                  </div>
                  {formData.prepayment?.penalty && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="prepaymentRate">Penalty Rate (%)</Label>
                      <Input
                        id="prepaymentRate"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.prepayment?.penaltyRate || 0}
                        onChange={(e) => setFormData({
                          ...formData,
                          prepayment: { ...formData.prepayment, penaltyRate: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Eligibility */}
            <div className="space-y-4">
              <h3 className="text-[15px] font-medium text-foreground">Eligibility Criteria</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minAge">Minimum Age</Label>
                  <Input
                    id="minAge"
                    type="number"
                    value={formData.eligibilityCriteria.minAge}
                    onChange={(e) => setFormData({
                      ...formData,
                      eligibilityCriteria: { ...formData.eligibilityCriteria, minAge: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAge">Maximum Age</Label>
                  <Input
                    id="maxAge"
                    type="number"
                    value={formData.eligibilityCriteria.maxAge}
                    onChange={(e) => setFormData({
                      ...formData,
                      eligibilityCriteria: { ...formData.eligibilityCriteria, maxAge: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minIncome">Minimum Income (K)</Label>
                  <Input
                    id="minIncome"
                    type="number"
                    value={formData.eligibilityCriteria.minIncome}
                    onChange={(e) => setFormData({
                      ...formData,
                      eligibilityCriteria: { ...formData.eligibilityCriteria, minIncome: parseFloat(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minCreditScore">Min Credit Score</Label>
                  <Input
                    id="minCreditScore"
                    type="number"
                    value={formData.eligibilityCriteria.minCreditScore}
                    onChange={(e) => setFormData({
                      ...formData,
                      eligibilityCriteria: { ...formData.eligibilityCriteria, minCreditScore: parseInt(e.target.value) }
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
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProductDialog;
