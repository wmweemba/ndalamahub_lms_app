import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import api from '@/utils/api';
import { X, DollarSign, Calendar, FileText, User } from 'lucide-react';

export default function LoanApplicationForm({ open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '',
    term: '',
    purpose: '',
    description: '',
    monthlyIncome: '',
    hasCollateral: false,
    collateralValue: '',
    collateralDescription: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (open) {
      fetchCurrentUser();
      resetForm();
    }
  }, [open]);

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
    setFormData({
      amount: '',
      term: '',
      purpose: '',
      description: '',
      monthlyIncome: '',
      hasCollateral: false,
      collateralValue: '',
      collateralDescription: ''
    });
    setError(null);
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

      // Prepare loan application data
      const loanData = {
        amount: parseFloat(formData.amount),
        term: parseInt(formData.term),
        purpose: formData.purpose,
        description: formData.description,
        monthlyIncome: parseFloat(formData.monthlyIncome),
        collateral: formData.hasCollateral ? {
          value: parseFloat(formData.collateralValue),
          description: formData.collateralDescription
        } : null
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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Apply for Loan
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4">
                {error}
              </div>
            )}

            {/* Applicant Information */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Applicant Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                  <Input 
                    value={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Company</Label>
                  <Input 
                    value={currentUser?.company?.name || ''}
                    disabled
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>

            {/* Loan Details */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                Loan Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                    Loan Amount (ZMW) *
                  </Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="1000"
                    max="100000"
                    step="100"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="e.g., 15000"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="term" className="text-sm font-medium text-gray-700">
                    Repayment Term (months) *
                  </Label>
                  <Input
                    id="term"
                    name="term"
                    type="number"
                    min="6"
                    max="60"
                    value={formData.term}
                    onChange={handleChange}
                    placeholder="e.g., 12"
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="purpose" className="text-sm font-medium text-gray-700">
                  Loan Purpose *
                </Label>
                <select
                  id="purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select loan purpose</option>
                  <option value="business_expansion">Business Expansion</option>
                  <option value="equipment_purchase">Equipment Purchase</option>
                  <option value="working_capital">Working Capital</option>
                  <option value="inventory_financing">Inventory Financing</option>
                  <option value="debt_consolidation">Debt Consolidation</option>
                  <option value="emergency_funding">Emergency Funding</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mt-4">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                <textarea
                  id="description"
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Provide additional details about how you plan to use the loan..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </Card>

            {/* Financial Information */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Financial Information
              </h3>
              <div>
                <Label htmlFor="monthlyIncome" className="text-sm font-medium text-gray-700">
                  Monthly Income (ZMW) *
                </Label>
                <Input
                  id="monthlyIncome"
                  name="monthlyIncome"
                  type="number"
                  min="1000"
                  step="100"
                  value={formData.monthlyIncome}
                  onChange={handleChange}
                  placeholder="e.g., 8000"
                  required
                  className="mt-1"
                />
              </div>
            </Card>

            {/* Collateral Information */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Collateral (Optional)</h3>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="hasCollateral"
                    checked={formData.hasCollateral}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">I have collateral to secure this loan</span>
                </label>

                {formData.hasCollateral && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="collateralValue" className="text-sm font-medium text-gray-700">
                        Collateral Value (ZMW)
                      </Label>
                      <Input
                        id="collateralValue"
                        name="collateralValue"
                        type="number"
                        min="0"
                        step="100"
                        value={formData.collateralValue}
                        onChange={handleChange}
                        placeholder="e.g., 25000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="collateralDescription" className="text-sm font-medium text-gray-700">
                        Collateral Description
                      </Label>
                      <Input
                        id="collateralDescription"
                        name="collateralDescription"
                        value={formData.collateralDescription}
                        onChange={handleChange}
                        placeholder="e.g., Vehicle, Property, Equipment"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
