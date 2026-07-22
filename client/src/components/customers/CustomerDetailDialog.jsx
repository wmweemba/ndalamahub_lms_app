import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { StatusPill } from '@/components/ui/status-pill';
import { LoanDetailsDialog } from '@/components/loans/LoanDetailsDialog';
import api from '@/utils/api';
import { formatCurrency } from '@/lib/format';

export function CustomerDetailDialog({ customer, open, onClose, onUpdate }) {
    const queryClient = useQueryClient();
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [showResetField, setShowResetField] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const { data: loans = [] } = useQuery({
        queryKey: ['loans'],
        queryFn: async () => {
            const res = await api.get('/loans');
            return res.data.data.loans;
        },
        enabled: open,
    });

    const customerLoans = useMemo(() => {
        if (!customer) return [];
        return loans.filter((loan) => loan.applicant?._id === customer._id);
    }, [loans, customer]);

    if (!customer) return null;

    const invalidateLoans = () => queryClient.invalidateQueries({ queryKey: ['loans'] });

    const handleClose = () => {
        setShowResetField(false);
        setNewPassword('');
        onClose();
    };

    const handleInvite = async () => {
        setBusy(true);
        try {
            await api.post(`/users/${customer._id}/invite`);
            toast.success('Invite emailed');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send invite');
        } finally {
            setBusy(false);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            toast.error('New password must be at least 6 characters long');
            return;
        }
        setBusy(true);
        try {
            await api.patch(`/users/${customer._id}/reset-password`, { newPassword });
            toast.success('Password reset');
            setShowResetField(false);
            setNewPassword('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleActive = async () => {
        setBusy(true);
        try {
            await api.patch(`/users/${customer._id}/status`, { isActive: !customer.isActive });
            toast.success(customer.isActive ? 'Customer deactivated' : 'Customer activated');
            onUpdate?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Dialog open={open && !selectedLoan} onOpenChange={handleClose}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {customer.firstName} {customer.lastName}
                            <StatusPill status={customer.isActive ? 'active' : 'inactive'} />
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">NRC</p>
                                <p className="font-mono text-foreground">{customer.nrc}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Phone</p>
                                <p className="text-foreground">{customer.phone}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-muted-foreground">Email</p>
                                <p className="text-foreground">{customer.email || '—'}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-2">Loans</h3>
                            {customerLoans.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No loans yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {customerLoans.map((loan) => (
                                        <button
                                            key={loan._id}
                                            type="button"
                                            onClick={() => setSelectedLoan(loan)}
                                            className="w-full flex items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted/40"
                                        >
                                            <span className="font-mono text-foreground">{loan.loanNumber}</span>
                                            <span className="font-mono text-foreground">{formatCurrency(loan.amount)}</span>
                                            <StatusPill status={loan.status} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border pt-4 space-y-3">
                            <h3 className="text-sm font-medium text-foreground">Account actions</h3>
                            <div className="flex flex-wrap gap-2">
                                {customer.email && (
                                    <Button variant="outline" size="sm" onClick={handleInvite} disabled={busy}>
                                        Send password invite
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowResetField((v) => !v)}
                                    disabled={busy}
                                >
                                    Reset password
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={customer.isActive ? 'text-status-danger-fg border-status-danger-fg/30' : ''}
                                    onClick={handleToggleActive}
                                    disabled={busy}
                                >
                                    {customer.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                            </div>

                            {showResetField && (
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="newPassword">New password</Label>
                                        <Input
                                            id="newPassword"
                                            type="text"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            minLength={6}
                                            className="mt-1"
                                        />
                                    </div>
                                    <Button size="sm" onClick={handleResetPassword} disabled={busy}>
                                        Set
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <LoanDetailsDialog
                loan={selectedLoan}
                open={!!selectedLoan}
                onClose={() => setSelectedLoan(null)}
                onUpdate={invalidateLoans}
            />
        </>
    );
}
