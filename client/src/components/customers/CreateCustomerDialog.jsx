import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';

// Username can only contain letters, numbers, underscores (server-enforced) —
// NRCs contain slashes, so the auto-derived username strips everything else.
function usernameFromNrc(nrc) {
    return nrc.replace(/[^a-zA-Z0-9]/g, '');
}

function randomTempPassword() {
    // Only ever used for the with-email path, where the customer sets their
    // own password via the invite link and never sees this value.
    return `Tmp${Math.random().toString(36).slice(-8)}1!`;
}

const initialFormData = {
    firstName: '',
    lastName: '',
    nrc: '',
    phone: '',
    email: '',
    tempPassword: '',
};

export function CreateCustomerDialog({ open, onClose, onSuccess }) {
    const currentUser = getCurrentUser();
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const hasEmail = formData.email.trim().length > 0;
    const derivedUsername = formData.nrc ? usernameFromNrc(formData.nrc) : '';

    const resetForm = () => {
        setFormData(initialFormData);
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleChange = (field) => (e) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!hasEmail && formData.tempPassword.length < 6) {
            setError('Temporary password must be at least 6 characters long');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                username: derivedUsername,
                nrc: formData.nrc,
                phone: formData.phone,
                role: 'borrower',
                company: currentUser?.company,
                password: hasEmail ? randomTempPassword() : formData.tempPassword,
            };
            if (hasEmail) {
                payload.email = formData.email;
            }

            const createRes = await api.post('/users', payload);
            const createdUser = createRes.data?.data;

            if (hasEmail && createdUser?._id) {
                await api.post(`/users/${createdUser._id}/invite`);
                toast.success('Customer created — invite emailed');
            } else {
                toast.success('Customer created');
            }

            onSuccess();
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create customer');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add customer</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="firstName">First name *</Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={handleChange('firstName')}
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="lastName">Last name *</Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                onChange={handleChange('lastName')}
                                required
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="nrc">NRC *</Label>
                        <Input
                            id="nrc"
                            value={formData.nrc}
                            onChange={handleChange('nrc')}
                            placeholder="e.g. 123456/10/1"
                            required
                            className="mt-1 font-mono"
                        />
                        {error && /nrc already exists/i.test(error) && (
                            <p className="text-xs text-status-danger-fg mt-1">{error}</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleChange('phone')}
                            required
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="email">Email (optional)</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange('email')}
                            placeholder="for account invite + reminders"
                            className="mt-1"
                        />
                    </div>

                    <div className="rounded-2xl border border-border p-4 space-y-3">
                        {hasEmail ? (
                            <p className="text-sm text-muted-foreground">
                                An invite to set their password will be emailed to {formData.email}.
                            </p>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="tempPassword">Temporary password *</Label>
                                    <Input
                                        id="tempPassword"
                                        type="text"
                                        value={formData.tempPassword}
                                        onChange={handleChange('tempPassword')}
                                        placeholder="Hand this to the customer in person"
                                        required
                                        minLength={6}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        The customer should change this after their first login.
                                    </p>
                                </div>
                                <div>
                                    <Label>Username (auto-set from NRC)</Label>
                                    <Input value={derivedUsername} readOnly className="mt-1 bg-muted font-mono" />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create customer'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
