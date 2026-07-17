import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { Building2, DollarSign, Settings, Percent, Calendar, Shield } from 'lucide-react';

export default function CompanySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [settings, setSettings] = useState({
    maxLoanAmount: 50000,
    interestRate: 15,
    repaymentPeriod: 12,
    allowMultipleLoans: false,
    requireGuarantor: false,
    autoApprovalThreshold: 0,
    minEmploymentPeriod: 6,
    maxLoanToSalaryRatio: 3
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.company) {
      fetchCompanySettings();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setCurrentUser(response.data.data.user);
      }
    } catch (err) {
      setError('Failed to fetch user information');
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/companies/${currentUser.company._id || currentUser.company}`);
      if (response.data.success) {
        setCompany(response.data.data);
        if (response.data.data.settings) {
          setSettings({
            ...settings,
            ...response.data.data.settings
          });
        }
      }
    } catch (err) {
      setError('Failed to load company settings');
      console.error('Company settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.put(`/companies/${company._id}/settings`, {
        settings: settings
      });

      if (response.data.success) {
        setSuccess('Company settings updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update company settings');
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (name, value) => {
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" /></div>;
  }

  if (!company) {
    return (
      <div className="p-6">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Company Found</h3>
          <p className="text-muted-foreground">Unable to load company settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-status-info-fg" />
            <h3 className="text-base font-medium text-foreground">Company Information</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-foreground mb-2">{company.name}</h4>
            <p className="text-sm text-muted-foreground mb-4">{company.description || 'No description available'}</p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{company.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registration Number:</span>
                <span className="font-medium">{company.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax Number:</span>
                <span className="font-medium">{company.taxNumber || 'Not specified'}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">Contact Information</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">
                  {company.address?.street}<br />
                  {company.address?.city}, {company.address?.province}<br />
                  {company.address?.postalCode}
                </p>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{company.contactInfo?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{company.contactInfo?.email}</span>
              </div>
              {company.contactInfo?.website && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website:</span>
                  <span className="font-medium">{company.contactInfo.website}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Loan Settings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-status-success-fg" />
            <h3 className="text-base font-medium text-foreground">Loan Settings</h3>
          </div>
          <Button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-status-success-bg text-status-success-fg rounded-2xl text-sm">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Financial Limits
            </h4>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Maximum Loan Amount (K)
              </label>
              <input
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={settings.maxLoanAmount}
                onChange={(e) => handleChange('maxLoanAmount', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Default Interest Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.interestRate}
                onChange={(e) => handleChange('interestRate', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Auto-Approval Threshold (K)
              </label>
              <input
                type="number"
                min="0"
                max={settings.maxLoanAmount}
                step="1000"
                value={settings.autoApprovalThreshold}
                onChange={(e) => handleChange('autoApprovalThreshold', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Loans below this amount are automatically approved
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Max Loan-to-Salary Ratio
              </label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.1"
                value={settings.maxLoanToSalaryRatio}
                onChange={(e) => handleChange('maxLoanToSalaryRatio', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum ratio of loan amount to monthly salary
              </p>
            </div>
          </div>

          {/* Term and Policy Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Terms & Policies
            </h4>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Default Repayment Period (months)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.repaymentPeriod}
                onChange={(e) => handleChange('repaymentPeriod', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Minimum Employment Period (months)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.minEmploymentPeriod}
                onChange={(e) => handleChange('minEmploymentPeriod', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum employment period required for loan eligibility
              </p>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-foreground flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Policy Settings
              </h5>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allowMultipleLoans}
                  onChange={(e) => handleChange('allowMultipleLoans', e.target.checked)}
                  className="h-4 w-4 text-foreground focus:ring-ring border-input rounded"
                />
                <span className="ml-2 text-sm text-foreground">Allow multiple active loans per employee</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.requireGuarantor}
                  onChange={(e) => handleChange('requireGuarantor', e.target.checked)}
                  className="h-4 w-4 text-foreground focus:ring-ring border-input rounded"
                />
                <span className="ml-2 text-sm text-foreground">Require guarantor for all loans</span>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
