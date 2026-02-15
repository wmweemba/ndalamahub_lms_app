import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/utils/api';
import { canApproveLoan, canDisburseLoan, getCurrentUser } from '@/utils/roleUtils';
import { PrepaymentDialog } from './PrepaymentDialog';
import PaymentHistoryDialog from './PaymentHistoryDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';

export function LoanDetailsDialog({ loan, open, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [prepaymentDialogOpen, setPrepaymentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [showDisbursementForm, setShowDisbursementForm] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [rejectionComment, setRejectionComment] = useState('');
  const [disbursementNotes, setDisbursementNotes] = useState('');

  if (!loan) return null;

  // Get current user to check permissions
  const currentUser = getCurrentUser();
  const userCanApprove = currentUser && canApproveLoan(currentUser.role);
  const userCanDisburse = currentUser && canDisburseLoan(currentUser.role);

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
    if (!approvalComment.trim()) {
      setActionError('Please provide a comment for approval');
      return;
    }
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/approve`, {
        approvalNotes: approvalComment
      });
      setShowApprovalForm(false);
      setApprovalComment('');
      onUpdate();
      onClose();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve loan');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionComment.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/reject`, {
        approvalNotes: rejectionComment
      });
      setShowRejectionForm(false);
      setRejectionComment('');
      onUpdate();
      onClose();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject loan');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!disbursementNotes.trim()) {
      setActionError('Please provide disbursement notes');
      return;
    }
    
    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/disburse`, {
        disbursementMethod: 'bank_transfer',
        disbursementNotes: disbursementNotes
      });
      setShowDisbursementForm(false);
      setDisbursementNotes('');
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
  const canPrepay = loan.status === 'active' || loan.status === 'disbursed' || loan.status === 'in_arrears';

  const handlePrepaymentSuccess = (data) => {
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <>
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

        {/* Repayment Schedule */}
        {loan.repaymentSchedule && loan.repaymentSchedule.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Repayment Schedule ({loan.repaymentSchedule.length} installments)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">#</th>
                      <th className="pb-2 font-semibold">Due Date</th>
                      <th className="pb-2 font-semibold text-right">Amount</th>
                      <th className="pb-2 font-semibold text-right hidden sm:table-cell">Principal</th>
                      <th className="pb-2 font-semibold text-right hidden sm:table-cell">Interest</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold hidden md:table-cell">Payment Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.repaymentSchedule.map((installment, index) => {
                      // Calculate display status considering rounding errors
                      const remaining = installment.amount - (installment.paidAmount || 0);
                      const displayStatus = remaining < 0.01 && installment.paidAmount > 0 ? 'paid' : installment.status;
                      
                      return (
                      <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">{installment.installmentNumber || index + 1}</td>
                        <td className="py-3">
                          {installment.dueDate ? new Date(installment.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 text-right font-medium">
                          K{(installment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-right hidden sm:table-cell text-gray-500">
                          K{(installment.principal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-right hidden sm:table-cell text-gray-500">
                          K{(installment.interest || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              displayStatus === 'paid' ? 'default' :
                              displayStatus === 'partial' ? 'secondary' :
                              displayStatus === 'overdue' ? 'destructive' :
                              'outline'
                            }
                            className={
                              displayStatus === 'paid' ? 'bg-green-600 hover:bg-green-700' :
                              displayStatus === 'partial' ? 'bg-yellow-600 hover:bg-yellow-700' :
                              ''
                            }
                          >
                            {displayStatus || 'pending'}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-gray-500 hidden md:table-cell">
                          {displayStatus === 'paid' && installment.paymentDate && (
                            <div className="space-y-0.5">
                              <div>Paid: {new Date(installment.paymentDate).toLocaleDateString()}</div>
                              {installment.paymentMethod && (
                                <div className="capitalize">{installment.paymentMethod.replace(/_/g, ' ')}</div>
                              )}
                              {installment.referenceNumber && (
                                <div>Ref: {installment.referenceNumber}</div>
                              )}
                            </div>
                          )}
                          {displayStatus === 'partial' && installment.paidAmount && installment.paidAmount > 0 && (
                            <div>
                              Partial: K{installment.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 mt-6 pt-6 border-t">
          {actionError && (
            <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">
              {actionError}
            </div>
          )}
          
          {/* Approval Form */}
          {userCanApprove && canApprove && showApprovalForm && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="approval-comment" className="text-sm font-medium">
                      Approval Comment <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="approval-comment"
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      placeholder="e.g., Verified employment and salary. Approved for processing."
                      rows={3}
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={loading || !approvalComment.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {loading ? 'Processing...' : 'Confirm Approval'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowApprovalForm(false);
                        setApprovalComment('');
                        setActionError(null);
                      }}
                      disabled={loading}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection Form */}
          {userCanApprove && canReject && showRejectionForm && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rejection-comment" className="text-sm font-medium">
                      Rejection Reason <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="rejection-comment"
                      value={rejectionComment}
                      onChange={(e) => setRejectionComment(e.target.value)}
                      placeholder="e.g., Loan amount exceeds 5x monthly salary policy. Please reapply for lower amount."
                      rows={3}
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReject}
                      disabled={loading || !rejectionComment.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {loading ? 'Processing...' : 'Confirm Rejection'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRejectionForm(false);
                        setRejectionComment('');
                        setActionError(null);
                      }}
                      disabled={loading}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disbursement Form */}
          {userCanDisburse && canDisburse && showDisbursementForm && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="disbursement-notes" className="text-sm font-medium">
                      Disbursement Notes <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="disbursement-notes"
                      value={disbursementNotes}
                      onChange={(e) => setDisbursementNotes(e.target.value)}
                      placeholder="e.g., Funds transferred to account ending 1234"
                      rows={3}
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Disbursement Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Principal Amount:</span>
                        <span className="font-medium">{formatCurrency(loan.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Processing Fee:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(loan.processingFee || 0)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium text-gray-700">Net Disbursement:</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency((loan.amount || 0) - (loan.processingFee || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDisburse}
                      disabled={loading || !disbursementNotes.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {loading ? 'Processing...' : 'Confirm Disbursement'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDisbursementForm(false);
                        setDisbursementNotes('');
                        setActionError(null);
                      }}
                      disabled={loading}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Action Buttons - Only show when forms are hidden */}
          {!showApprovalForm && !showRejectionForm && !showDisbursementForm && (
            <div className="flex flex-wrap gap-3">
              {userCanApprove && canApprove && (
                <Button
                  onClick={() => setShowApprovalForm(true)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve Loan
                </Button>
              )}
              
              {userCanApprove && canReject && (
                <Button
                  onClick={() => setShowRejectionForm(true)}
                  disabled={loading}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Reject Loan
                </Button>
              )}
              
              {userCanDisburse && canDisburse && (
                <Button
                  onClick={() => setShowDisbursementForm(true)}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Disburse Loan
                </Button>
              )}
              
              {userCanDisburse && canPrepay && (
                <>
                  <Button
                    onClick={() => setRecordPaymentDialogOpen(true)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Record Payment
                  </Button>
                  <Button
                    onClick={() => setPrepaymentDialogOpen(true)}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Make Prepayment
                  </Button>
                </>
              )}
              
              {canPrepay && (
                <Button
                  onClick={() => setHistoryDialogOpen(true)}
                  disabled={loading}
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  View Payment History
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
          )}
        </div>
      </DialogContent>
    </Dialog>

    <PrepaymentDialog
      loan={loan}
      open={prepaymentDialogOpen}
      onClose={() => setPrepaymentDialogOpen(false)}
      onSuccess={handlePrepaymentSuccess}
    />
    
    <PaymentHistoryDialog
      loan={loan}
      open={historyDialogOpen}
      onClose={() => setHistoryDialogOpen(false)}
    />
    
    <RecordPaymentDialog
      loan={loan}
      installment={selectedInstallment || (loan.repaymentSchedule && loan.repaymentSchedule.find(inst => {
        // Find first unpaid or partially paid installment with remaining balance
        if (inst.status === 'paid') return false;
        if (inst.status === 'partial') {
          const remaining = inst.amount - (inst.paidAmount || 0);
          // Skip if remaining is less than 1 cent (rounding error)
          return remaining >= 0.01;
        }
        return inst.status === 'pending' || inst.status === 'overdue';
      }))}
      open={recordPaymentDialogOpen}
      onClose={() => {
        setRecordPaymentDialogOpen(false);
        setSelectedInstallment(null);
      }}
      onSuccess={handlePrepaymentSuccess}
    />
  </>
  );
}