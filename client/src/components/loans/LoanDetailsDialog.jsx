import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/ui/status-pill';
import api from '@/utils/api';
import { canApproveLoan, canDisburseLoan, getCurrentUser } from '@/utils/roleUtils';
import { formatCurrency, formatDate, formatTerm } from '@/lib/format';
import { PrepaymentDialog } from './PrepaymentDialog';
import PaymentHistoryDialog from './PaymentHistoryDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground mt-0.5">{children}</p>
    </div>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`pt-4 border-t border-border first:pt-0 first:border-0 ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

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

  const currentUser = getCurrentUser();
  const userCanApprove = currentUser && canApproveLoan(currentUser.role);
  const userCanDisburse = currentUser && canDisburseLoan(currentUser.role);

  const handleApprove = async () => {
    if (!approvalComment.trim()) {
      setActionError('Please provide an approval comment');
      return;
    }

    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/approve`, {
        approvalNotes: approvalComment,
      });
      setShowApprovalForm(false);
      setApprovalComment('');
      toast.success('Loan approved');
      onUpdate();
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to approve loan';
      setActionError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionComment.trim()) {
      setActionError('Please provide a rejection reason');
      return;
    }

    setLoading(true);
    setActionError(null);
    try {
      await api.put(`/loans/${loan._id}/reject`, {
        approvalNotes: rejectionComment,
      });
      setShowRejectionForm(false);
      setRejectionComment('');
      toast.success('Loan rejected');
      onUpdate();
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reject loan';
      setActionError(message);
      toast.error(message);
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
        disbursementNotes: disbursementNotes,
      });
      setShowDisbursementForm(false);
      setDisbursementNotes('');
      toast.success('Loan disbursed');
      onUpdate();
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to disburse loan';
      setActionError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const canApprove = loan.status === 'pending' || loan.status === 'pending_approval';
  const canReject = loan.status === 'pending' || loan.status === 'pending_approval';
  const canDisburse = loan.status === 'approved';
  const canPrepay = loan.status === 'active' || loan.status === 'disbursed' || loan.status === 'in_arrears';

  const handlePrepaymentSuccess = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  const handleExportRepaymentSchedule = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await api.get(`/loans/${loan._id}/repayment-schedule/export/excel`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `repayment_schedule_${loan.loanNumber || loan._id}.xlsx`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to export repayment schedule';
      setActionError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl sm:max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="font-mono text-base">{loan.loanNumber}</DialogTitle>
              <StatusPill status={loan.status} />
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <Section title="Applicant" className="pt-0 border-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Name">
                  {loan.applicant?.firstName} {loan.applicant?.lastName}
                </Field>
                <Field label="Email">{loan.applicant?.email || 'N/A'}</Field>
                <Field label="Company">{loan.company?.name || 'N/A'}</Field>
              </div>
            </Section>

            <Section title="Terms">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Amount">
                  <span className="font-mono font-medium">{formatCurrency(loan.amount)}</span>
                </Field>
                <Field label="Interest rate">{loan.interestRate}%</Field>
                <Field label="Term">{formatTerm(loan.term, loan.termUnit)}</Field>
                <Field label="Product">{loan.product?.name || loan.product?.category || 'N/A'}</Field>
                <Field label="Total amount">
                  <span className="font-mono font-medium">{formatCurrency(loan.totalAmount)}</span>
                </Field>
                <Field label="Monthly payment">
                  <span className="font-mono">{formatCurrency(loan.monthlyPayment)}</span>
                </Field>
                {loan.remainingBalance !== undefined && (
                  <Field label="Remaining balance">
                    <span className="font-mono">{formatCurrency(loan.remainingBalance)}</span>
                  </Field>
                )}
              </div>
            </Section>

            <Section title="Dates">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Applied">{formatDate(loan.applicationDate)}</Field>
                {loan.approvedAt && <Field label="Approved">{formatDate(loan.approvedAt)}</Field>}
                {loan.disbursedAt && <Field label="Disbursed">{formatDate(loan.disbursedAt)}</Field>}
                {loan.endDate && <Field label="End date">{formatDate(loan.endDate)}</Field>}
              </div>
            </Section>

            {loan.approvalNotes && (
              <Section title="Notes">
                <p className="text-sm text-foreground">{loan.approvalNotes}</p>
                {loan.approvedBy && (
                  <p className="text-xs text-muted-foreground mt-2">
                    By: {loan.approvedBy.firstName} {loan.approvedBy.lastName}
                  </p>
                )}
              </Section>
            )}

            {loan.guarantor && (
              <Section title="Guarantor">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Name">{loan.guarantor.name}</Field>
                  <Field label="Phone">{loan.guarantor.phone}</Field>
                  <Field label="Relationship">{loan.guarantor.relationship}</Field>
                </div>
              </Section>
            )}

            {loan.repaymentSchedule && loan.repaymentSchedule.length > 0 && (
              <Section title={`Repayment schedule (${loan.repaymentSchedule.length} installments)`}>
                <Button variant="outline" size="sm" className="mb-3" onClick={handleExportRepaymentSchedule} disabled={loading}>
                  {loading ? 'Exporting...' : 'Export (Excel)'}
                </Button>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Due date</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Amount</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.repaymentSchedule.map((installment, index) => {
                        const remaining = installment.amount - (installment.paidAmount || 0);
                        const displayStatus = remaining < 0.01 && installment.paidAmount > 0 ? 'paid' : installment.status;
                        return (
                          <tr key={index} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-muted-foreground">{installment.installmentNumber || index + 1}</td>
                            <td className="px-3 py-2">{formatDate(installment.dueDate)}</td>
                            <td className="px-3 py-2 text-right font-mono pr-3">
                              {formatCurrency(installment.amount)}
                            </td>
                            <td className="px-3 py-2">
                              <StatusPill status={displayStatus || 'pending'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-border">
            {actionError && (
              <div className="w-full bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
                {actionError}
              </div>
            )}

            {userCanApprove && canApprove && showApprovalForm && (
              <div className="rounded-2xl border border-border bg-muted p-4 space-y-4">
                <div>
                  <Label htmlFor="approval-comment" className="text-sm font-medium">
                    Approval comment <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="approval-comment"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="e.g., Verified employment and salary. Approved for processing."
                    rows={3}
                    className="mt-2 bg-card"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleApprove} disabled={loading || !approvalComment.trim()}>
                    {loading ? 'Processing...' : 'Confirm approval'}
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
            )}

            {userCanApprove && canReject && showRejectionForm && (
              <div className="rounded-2xl border border-border bg-muted p-4 space-y-4">
                <div>
                  <Label htmlFor="rejection-comment" className="text-sm font-medium">
                    Rejection reason <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="rejection-comment"
                    value={rejectionComment}
                    onChange={(e) => setRejectionComment(e.target.value)}
                    placeholder="e.g., Loan amount exceeds 5x monthly salary policy. Please reapply for lower amount."
                    rows={3}
                    className="mt-2 bg-card"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleReject}
                    disabled={loading || !rejectionComment.trim()}
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-status-danger-bg"
                  >
                    {loading ? 'Processing...' : 'Confirm rejection'}
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
            )}

            {userCanDisburse && canDisburse && showDisbursementForm && (
              <div className="rounded-2xl border border-border bg-muted p-4 space-y-4">
                <div>
                  <Label htmlFor="disbursement-notes" className="text-sm font-medium">
                    Disbursement notes <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="disbursement-notes"
                    value={disbursementNotes}
                    onChange={(e) => setDisbursementNotes(e.target.value)}
                    placeholder="e.g., Funds transferred to account ending 1234"
                    rows={3}
                    className="mt-2 bg-card"
                  />
                </div>
                <div className="rounded-2xl bg-card p-4 border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Disbursement summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Principal amount</span>
                      <span className="font-mono">{formatCurrency(loan.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span className="font-mono text-destructive">-{formatCurrency(loan.processingFee || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="font-medium text-foreground">Net disbursement</span>
                      <span className="font-mono font-medium">
                        {formatCurrency((loan.amount || 0) - (loan.processingFee || 0))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDisburse} disabled={loading || !disbursementNotes.trim()}>
                    {loading ? 'Processing...' : 'Confirm disbursement'}
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
            )}

            {!showApprovalForm && !showRejectionForm && !showDisbursementForm && (
              <div className="flex flex-wrap gap-3">
                {userCanApprove && canApprove && (
                  <Button onClick={() => setShowApprovalForm(true)} disabled={loading}>
                    Approve application
                  </Button>
                )}

                {userCanApprove && canReject && (
                  <Button
                    onClick={() => setShowRejectionForm(true)}
                    disabled={loading}
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-status-danger-bg"
                  >
                    Reject
                  </Button>
                )}

                {userCanDisburse && canDisburse && (
                  <Button onClick={() => setShowDisbursementForm(true)} disabled={loading}>
                    Disburse loan
                  </Button>
                )}

                {userCanDisburse && canPrepay && (
                  <>
                    <Button variant="outline" onClick={() => setRecordPaymentDialogOpen(true)} disabled={loading}>
                      Record repayment
                    </Button>
                    <Button variant="outline" onClick={() => setPrepaymentDialogOpen(true)} disabled={loading}>
                      Make prepayment
                    </Button>
                  </>
                )}

                {canPrepay && (
                  <Button variant="outline" onClick={() => setHistoryDialogOpen(true)} disabled={loading}>
                    View payment history
                  </Button>
                )}

                <Button onClick={onClose} variant="outline" disabled={loading}>
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

      <PaymentHistoryDialog loan={loan} open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} />

      <RecordPaymentDialog
        loan={loan}
        installment={
          selectedInstallment ||
          (loan.repaymentSchedule &&
            loan.repaymentSchedule.find((inst) => {
              if (inst.status === 'paid') return false;
              if (inst.status === 'partial') {
                const remaining = inst.amount - (inst.paidAmount || 0);
                return remaining >= 0.01;
              }
              return inst.status === 'pending' || inst.status === 'overdue';
            }))
        }
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
