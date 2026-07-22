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

export function EditCompanyDialog({ company, open, onClose, onSuccess }) {
    const currentUser = getCurrentUser();
    const isPlatformAdmin = currentUser?.role === ROLES.PLATFORM_ADMIN;
    const [formData, setFormData] = useState({
        name: '',
        type: 'corporate',
        lendingModel: 'employer',
        lenderCompany: '',
        registrationNumber: '',
        taxNumber: '',
        isActive: true,
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

    // Load company data when component opens
    useEffect(() => {
        if (open && company) {
            setFormData({
                name: company.name || '',
                type: company.type || 'corporate',
                lendingModel: company.lendingModel || 'employer',
                lenderCompany: company.lenderCompany?._id || company.lenderCompany || '',
                registrationNumber: company.registrationNumber || '',
                taxNumber: company.taxNumber || '',
                isActive: company.isActive !== undefined ? company.isActive : true,
                address: {
                    street: company.address?.street || '',
                    city: company.address?.city || '',
                    province: company.address?.province || '',
                    country: company.address?.country || 'Zambia',
                    postalCode: company.address?.postalCode || ''
                },
                contactInfo: {
                    email: company.contactInfo?.email || '',
                    phone: company.contactInfo?.phone || '',
                    website: company.contactInfo?.website || ''
                }
            });
            fetchLenderCompanies();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, company]);

    const fetchLenderCompanies = async () => {
        setLoadingLenders(true);
        try {
            const response = await api.get('/companies');
            const companies = response.data;
            setLenderCompanies(companies.filter(comp => comp.type === 'lender' && comp._id !== company?._id));
        } catch (err) {
            console.error('Failed to fetch lender companies:', err);
        } finally {
            setLoadingLenders(false);
        }
    };

    const handleClose = () => {
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
        if (!company) return;

        setLoading(true);

        try {
            // Prepare submission data
            const submitData = { ...formData };

            // Only include lenderCompany for corporate companies
            if (formData.type !== 'corporate') {
                delete submitData.lenderCompany;
            }

            // lendingModel: only meaningful for lender companies, and only
            // platform_admin may change it (server-enforced; also stripped
            // here so a non-platform-admin's PUT doesn't even try)
            if (formData.type !== 'lender' || !isPlatformAdmin) {
                delete submitData.lendingModel;
            }

            await api.put(`/companies/${company._id}`, submitData);
            toast.success('Company updated');
            onSuccess();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update company');
        } finally {
            setLoading(false);
        }
    };

    if (!company) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit company — {company.name}</DialogTitle>
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

                                {/* Lending model - platform_admin only, lender companies only */}
                                {formData.type === 'lender' && isPlatformAdmin && (
                                    <div>
                                        <Label htmlFor="lendingModel">Lending model *</Label>
                                        <select
                                            id="lendingModel"
                                            value={formData.lendingModel}
                                            onChange={(e) => setFormData({ ...formData, lendingModel: e.target.value })}
                                            className={`${SELECT_CLASSES} mt-1`}
                                            required
                                        >
                                            <option value="employer">Employer-based</option>
                                            <option value="direct">Direct-to-customer</option>
                                        </select>
                                    </div>
                                )}

                                {/* Lender Selection - Only show for corporate companies */}
                                {formData.type === 'corporate' && (
                                    <div>
                                        <Label>Lender company *</Label>
                                        {loadingLenders ? (
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
                                        {lenderCompanies.length === 0 && !loadingLenders && (
                                            <p className="text-sm text-status-warning-fg mt-1">
                                                No lender companies found. Create a lender company first.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="status">Status *</Label>
                                    <select
                                        id="status"
                                        value={formData.isActive ? 'active' : 'inactive'}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                                        className={`${SELECT_CLASSES} mt-1`}
                                        required
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
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
                                    <Label htmlFor="taxNumber">Tax number</Label>
                                    <Input
                                        id="taxNumber"
                                        type="text"
                                        value={formData.taxNumber}
                                        onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                                        placeholder="Enter tax number"
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
                                    <Label htmlFor="street">Street address *</Label>
                                    <Input
                                        id="street"
                                        type="text"
                                        value={formData.address.street}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, street: e.target.value }
                                        })}
                                        placeholder="Enter street address"
                                        required
                                        className="mt-1"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="city">City *</Label>
                                        <Input
                                            id="city"
                                            type="text"
                                            value={formData.address.city}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                address: { ...formData.address, city: e.target.value }
                                            })}
                                            placeholder="Enter city"
                                            required
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="province">Province *</Label>
                                        <Input
                                            id="province"
                                            type="text"
                                            value={formData.address.province}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                address: { ...formData.address, province: e.target.value }
                                            })}
                                            placeholder="Enter province"
                                            required
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
                            {loading ? 'Updating...' : 'Update company'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
