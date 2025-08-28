import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/utils/api';

export function LoanDetailsDialog({ loan, open, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!loan) return null;

  const formatCurrency = (amount) => {
    return `K${amount?.toLocaleString() || '0'}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'pending_approval': 'bg-orange-100 text-orange-800 border-orange-200',
      'approved': 'bg-blue-100 text-blue-800 border-blue-200',
      'disbursed': 'bg-green-100 text-green-800 border-green-200',
      'active': 'bg-green-100 text-green-800 border-green-200',
      'completed': 'bg-gray-100 text-gray-800 border-gray-200',
      'rejected': 'bg-red-100 text-red-800 border-red-200',
      'defaulted': 'bg-red-200 text-red-900 border-red-300'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this loan?')) return;
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/approve`, {
        approvalNotes: 'Approved via loan management interface'
      });
      onUpdate();
      onClose();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve loan');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/reject`, {
        approvalNotes: reason
      });
      onUpdate();
      onClose();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject loan');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!window.confirm('Are you sure you want to disburse this loan?')) return;
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/disburse`, {
        disbursementMethod: 'bank_transfer'
      });
      onUpdate();
      onClose();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to disburse loan');
    } finally {
      setLoading(false);
    }
  };

  const canApprove = loan.status === 'pending' || loan.status === 'pending_approval';
  const canReject = loan.status === 'pending' || loan.status === 'pending_approval';
  const canDisburse = loan.status === 'approved';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Loan Details - {loan.loanNumber}</span>
            <span className={`px-3 py-1 text-sm rounded-full border ${getStatusColor(loan.status)}`}>
              {loan.status.replace('_', ' ').toUpperCase()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Loan Number</label>
                <p className="font-mono">{loan.loanNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Amount</label>
                <p className="text-lg font-semibold">{formatCurrency(loan.amount)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Interest Rate</label>
                <p>{loan.interestRate}% per annum</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Term</label>
                <p>{loan.term} months</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Purpose</label>
                <p>{loan.purpose}</p>
              </div>
            </CardContent>
          </Card>

          {/* Applicant Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p>{loan.applicant?.firstName} {loan.applicant?.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p>{loan.applicant?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Employee ID</label>
                <p>{loan.applicant?.employeeId || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p>{loan.applicant?.department || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Company</label>
                <p>{loan.company?.name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Application Date</label>
                <p>{formatDate(loan.applicationDate)}</p>
              </div>
              {loan.approvedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Approved Date</label>
                  <p>{formatDate(loan.approvedAt)}</p>
                </div>
              )}
              {loan.disbursedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Disbursed Date</label>
                  <p>{formatDate(loan.disbursedAt)}</p>
                </div>
              )}
              {loan.startDate && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Start Date</label>
                  <p>{formatDate(loan.startDate)}</p>
                </div>
              )}
              {loan.endDate && (
                <div>
                  <label className="text-sm font-medium text-gray-500">End Date</label>
                  <p>{formatDate(loan.endDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Principal Amount</label>
                <p>{formatCurrency(loan.amount)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Interest Amount</label>
                <p>{formatCurrency(loan.totalInterest)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Amount</label>
                <p className="text-lg font-semibold">{formatCurrency(loan.totalAmount)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Monthly Payment</label>
                <p>{formatCurrency(loan.monthlyPayment)}</p>
              </div>
              {loan.remainingBalance !== undefined && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Remaining Balance</label>
                  <p>{formatCurrency(loan.remainingBalance)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Approval Notes */}
        {loan.approvalNotes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{loan.approvalNotes}</p>
              {loan.approvedBy && (
                <p className="text-sm text-gray-500 mt-2">
                  By: {loan.approvedBy.firstName} {loan.approvedBy.lastName}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guarantor Information */}
        {loan.guarantor && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Guarantor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p>{loan.guarantor.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p>{loan.guarantor.phone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Relationship</label>
                <p>{loan.guarantor.relationship}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
          {actionError && (
            <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">
              {actionError}
            </div>
          )}
          
          {canApprove && (
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Processing...' : 'Approve Loan'}
            </Button>
          )}
          
          {canReject && (
            <Button
              onClick={handleReject}
              disabled={loading}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {loading ? 'Processing...' : 'Reject Loan'}
            </Button>
          )}
          
          {canDisburse && (
            <Button
              onClick={handleDisburse}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Processing...' : 'Disburse Loan'}
            </Button>
          )}
          
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
