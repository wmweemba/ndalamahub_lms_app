import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusPill } from '@/components/ui/status-pill';
import api from '@/utils/api';
import { formatCurrency, formatDate, formatTerm } from '@/lib/format';

const COLLATERAL_LABEL = {
    vehicle: 'Vehicle',
    business_equipment: 'Business equipment',
    title_deed: 'Title deed',
    other: 'Other',
};

export function ApplicationDetailDialog({ application, open, onClose }) {
    const queryClient = useQueryClient();
    const [attachChoice, setAttachChoice] = useState(null);
    const [tempPassword, setTempPassword] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(null);

    if (!application) return null;

    const dedupe = application.dedupe;
    const applicant = application.applicant;
    const loanRequest = application.loanRequest;
    const collateral = application.collateral;
    const creatingNew = !dedupe || attachChoice === 'new';
    const needsTempPassword = creatingNew && !applicant.email;

    const resetLocalState = () => {
        setAttachChoice(null);
        setTempPassword('');
        setShowRejectForm(false);
        setRejectionReason('');
        setActionError(null);
    };

    const handleClose = () => {
        resetLocalState();
        onClose();
    };

    const invalidateAfterDecision = () => {
        queryClient.invalidateQueries({ queryKey: ['customer-applications'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['loans'] });
    };

    const handleApprove = async () => {
        setActionError(null);

        if (dedupe && !attachChoice) {
            setActionError('Choose whether to create a new customer or attach to the matched one');
            return;
        }
        if (needsTempPassword && tempPassword.trim().length < 6) {
            setActionError('Temporary password must be at least 6 characters long');
            return;
        }

        setBusy(true);
        try {
            const payload = {};
            if (dedupe && attachChoice === 'attach') {
                payload.attachToUserId = dedupe.userId;
            } else if (needsTempPassword) {
                payload.temporaryPassword = tempPassword;
            }

            const res = await api.put(`/customer-applications/${application._id}/approve`, payload);
            const { loan } = res.data.data;
            toast.success(
                payload.attachToUserId
                    ? `Loan ${loan.loanNumber} created for the matched customer`
                    : `Customer + loan ${loan.loanNumber} created — collateral awaiting verification`
            );
            invalidateAfterDecision();
            handleClose();
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to approve application';
            setActionError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            setActionError('Please provide a rejection reason');
            return;
        }
        setBusy(true);
        setActionError(null);
        try {
            await api.put(`/customer-applications/${application._id}/reject`, { reason: rejectionReason });
            toast.success('Application rejected');
            invalidateAfterDecision();
            handleClose();
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to reject application';
            setActionError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {applicant.fullName}
                        <StatusPill status={application.status} />
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {dedupe && (
                        <div className="bg-status-warning-bg text-status-warning-fg rounded-2xl p-3 text-sm">
                            Possible existing customer: <span className="font-medium">{dedupe.name}</span>{' '}
                            (matched on {dedupe.matchType})
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-medium text-foreground mb-2">Applicant</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">NRC</p>
                                <p className="font-mono text-foreground">{applicant.nrc}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Phone</p>
                                <p className="text-foreground">{applicant.phone}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Email</p>
                                <p className="text-foreground">{applicant.email || '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Employment</p>
                                <p className="text-foreground">{applicant.employmentStatus}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-muted-foreground">Address</p>
                                <p className="text-foreground">{applicant.address}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-foreground mb-2">Loan request</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Amount</p>
                                <p className="font-mono text-foreground">{formatCurrency(loanRequest.amount)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Term</p>
                                <p className="text-foreground">{formatTerm(loanRequest.termDays, 'days')}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-muted-foreground">Purpose</p>
                                <p className="text-foreground">{loanRequest.purpose}</p>
                            </div>
                        </div>
                    </div>

                    {collateral?.type && (
                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-2">Collateral</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Type</p>
                                    <p className="text-foreground">{COLLATERAL_LABEL[collateral.type] || collateral.type}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Estimated value</p>
                                    <p className="font-mono text-foreground">{formatCurrency(collateral.estimatedValue)}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-muted-foreground">Description</p>
                                    <p className="text-foreground">
                                        {collateral.description || collateral.otherDescription || '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Source: {application.source}</span>
                        <span>Received {formatDate(application.createdAt)}</span>
                    </div>

                    {application.status === 'pending' && (
                        <div className="border-t border-border pt-4 space-y-3">
                            {actionError && (
                                <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
                                    {actionError}
                                </div>
                            )}

                            {dedupe && (
                                <div className="space-y-2">
                                    <Label>How should this be approved?</Label>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="attachChoice"
                                                checked={attachChoice === 'new'}
                                                onChange={() => setAttachChoice('new')}
                                            />
                                            Create new customer
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="attachChoice"
                                                checked={attachChoice === 'attach'}
                                                onChange={() => setAttachChoice('attach')}
                                            />
                                            Attach loan to {dedupe.name}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {needsTempPassword && (
                                <div>
                                    <Label htmlFor="app-temp-password">Temporary password *</Label>
                                    <Input
                                        id="app-temp-password"
                                        type="text"
                                        value={tempPassword}
                                        onChange={(e) => setTempPassword(e.target.value)}
                                        placeholder="Hand this to the customer in person"
                                        minLength={6}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        No email on file — a walk-in temporary password is required.
                                    </p>
                                </div>
                            )}

                            {!showRejectForm ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={handleApprove} disabled={busy}>
                                        {busy ? 'Approving...' : 'Approve'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-status-danger-fg border-status-danger-fg/30"
                                        onClick={() => setShowRejectForm(true)}
                                        disabled={busy}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="reject-reason">Rejection reason *</Label>
                                    <Textarea
                                        id="reject-reason"
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="text-status-danger-fg border-status-danger-fg/30"
                                            onClick={handleReject}
                                            disabled={busy || !rejectionReason.trim()}
                                        >
                                            {busy ? 'Rejecting...' : 'Confirm rejection'}
                                        </Button>
                                        <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={busy}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
