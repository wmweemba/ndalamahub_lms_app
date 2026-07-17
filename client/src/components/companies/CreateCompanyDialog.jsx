import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/utils/api';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';

const SELECT_CLASSES =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function CreateCompanyDialog({ open, onClose, onSuccess }) {
    const currentUser = getCurrentUser();
    const isLenderAdmin = currentUser?.role === ROLES.LENDER_ADMIN;
    const [formData, setFormData] = useState({
        name: '',
        type: isLenderAdmin ? 'corporate' : 'corporate', // Force corporate for lender admins
        lenderCompany: isLenderAdmin ? currentUser?.company : '',
        registrationNumber: '',
        taxNumber: '',
        address: {
            street: '',
            city: '',
            province: '',
            country: 'Zambia',
            postalCode: ''
        },
        contactInfo: {
            email: '',
            phone: '',
            website: ''
        }
    });
    const [lenderCompanies, setLenderCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingLenders, setLoadingLenders] = useState(false);

    // Fetch lender companies when dialog opens (only for platform_admin and non-lender admins)
    useEffect(() => {
        if (open && !isLenderAdmin) {
            fetchLenderCompanies();
        }
    }, [open, isLenderAdmin]);

    const fetchLenderCompanies = async () => {
        setLoadingLenders(true);
        try {
            const response = await api.get('/companies');
            // The companies endpoint returns companies directly as an array
            const companies = response.data;
            setLenderCompanies(companies.filter(company => company.type === 'lender'));
        } catch (err) {
            console.error('Failed to fetch lender companies:', err);
            // Don't show error for this, just continue with empty list
        } finally {
            setLoadingLenders(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: isLenderAdmin ? 'corporate' : 'corporate',
            lenderCompany: isLenderAdmin ? currentUser?.company : '',
            registrationNumber: '',
            taxNumber: '',
            address: {
                street: '',
                city: '',
                province: '',
                country: 'Zambia',
                postalCode: ''
            },
            contactInfo: {
                email: '',
                phone: '',
                website: ''
            }
        });
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleTypeChange = (type) => {
        setFormData({
            ...formData,
            type,
            lenderCompany: type === 'lender' ? '' : formData.lenderCompany
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Prepare submission data
            const submitData = { ...formData };

            // Only include lenderCompany for corporate companies
            if (formData.type !== 'corporate') {
                delete submitData.lenderCompany;
            }

            await api.post('/companies', submitData);
            toast.success(isLenderAdmin ? 'Employer client created' : 'Company created');
            onSuccess();
            resetForm();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create company');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isLenderAdmin ? 'Create employer client' : 'Create company'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-base font-medium text-foreground mb-4">Basic information</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Company name *</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter company name"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                {/* Company Type - Only show for platform_admin */}
                                {!isLenderAdmin && (
                                    <div>
                                        <Label htmlFor="type">Company type *</Label>
                                        <select
                                            id="type"
                                            value={formData.type}
                                            onChange={(e) => handleTypeChange(e.target.value)}
                                            className={`${SELECT_CLASSES} mt-1`}
                                            required
                                        >
                                            <option value="corporate">Employer client</option>
                                            <option value="lender">Lender</option>
                                        </select>
                                    </div>
                                )}

                                {/* Lender Company Information for Lender Admins */}
                                {isLenderAdmin && (
                                    <div>
                                        <Label>Company type</Label>
                                        <div className="mt-1 w-full p-3 border border-border rounded-md bg-muted text-foreground text-sm">
                                            Employer client
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            As a lender admin, you can only create employer client companies.
                                        </p>
                                    </div>
                                )}

                                {/* Lender Selection - Show for corporate companies or all lender admin companies */}
                                {(formData.type === 'corporate' || isLenderAdmin) && (
                                    <div>
                                        <Label>Lender company *</Label>
                                        {isLenderAdmin ? (
                                            <div className="mt-1 w-full p-3 border border-border rounded-md bg-muted text-foreground text-sm">
                                                Your lender company (auto-assigned)
                                            </div>
                                        ) : loadingLenders ? (
                                            <div className="mt-1 w-full p-3 border border-border rounded-md bg-muted text-muted-foreground text-sm">
                                                Loading lenders...
                                            </div>
                                        ) : (
                                            <select
                                                value={formData.lenderCompany}
                                                onChange={(e) => setFormData({ ...formData, lenderCompany: e.target.value })}
                                                className={`${SELECT_CLASSES} mt-1`}
                                                required
                                            >
                                                <option value="">Select a lender company</option>
                                                {lenderCompanies.map((lender) => (
                                                    <option key={lender._id} value={lender._id}>
                                                        {lender.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        {!isLenderAdmin && lenderCompanies.length === 0 && !loadingLenders && (
                                            <p className="text-sm text-status-warning-fg mt-1">
                                                No lender companies found. Create a lender company first.
                                            </p>
                                        )}
                                        {isLenderAdmin && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                This employer client will be automatically linked to your lender company.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Registration Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-base font-medium text-foreground mb-4">Registration information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="registrationNumber">Registration number *</Label>
                                    <Input
                                        id="registrationNumber"
                                        type="text"
                                        value={formData.registrationNumber}
                                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                                        placeholder="Enter registration number"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="taxNumber">Tax number *</Label>
                                    <Input
                                        id="taxNumber"
                                        type="text"
                                        value={formData.taxNumber}
                                        onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                                        placeholder="Enter tax number"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-base font-medium text-foreground mb-4">Contact information</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="email">Email address *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.contactInfo.email}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            contactInfo: { ...formData.contactInfo, email: e.target.value }
                                        })}
                                        placeholder="Enter email address"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone number *</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={formData.contactInfo.phone}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            contactInfo: { ...formData.contactInfo, phone: e.target.value }
                                        })}
                                        placeholder="Enter phone number"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="website">Website (optional)</Label>
                                    <Input
                                        id="website"
                                        type="url"
                                        value={formData.contactInfo.website}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            contactInfo: { ...formData.contactInfo, website: e.target.value }
                                        })}
                                        placeholder="Enter website URL"
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-base font-medium text-foreground mb-4">Address information</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="street">Street address</Label>
                                    <Input
                                        id="street"
                                        type="text"
                                        value={formData.address.street}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, street: e.target.value }
                                        })}
                                        placeholder="Enter street address"
                                        className="mt-1"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="city">City</Label>
                                        <Input
                                            id="city"
                                            type="text"
                                            value={formData.address.city}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                address: { ...formData.address, city: e.target.value }
                                            })}
                                            placeholder="Enter city"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="province">Province</Label>
                                        <Input
                                            id="province"
                                            type="text"
                                            value={formData.address.province}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                address: { ...formData.address, province: e.target.value }
                                            })}
                                            placeholder="Enter province"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 pt-6 border-t border-border">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create company'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
