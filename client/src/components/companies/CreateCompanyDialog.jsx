import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/utils/api';

export function CreateCompanyDialog({ open, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'corporate',
        lenderCompany: '',
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
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Fetch lender companies when dialog opens
    useEffect(() => {
        if (open) {
            fetchLenderCompanies();
        }
    }, [open]);

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
            type: 'corporate',
            lenderCompany: '',
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
        setError(null);
        setSuccess(false);
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
        setError(null);
        setSuccess(false);

        try {
            // Prepare submission data
            const submitData = { ...formData };
            
            // Only include lenderCompany for corporate companies
            if (formData.type !== 'corporate') {
                delete submitData.lenderCompany;
            }

            await api.post('/companies', submitData);
            setSuccess(true);
            
            // Show success message for 2 seconds then close and refresh
            setTimeout(() => {
                onSuccess();
                resetForm();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create company');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-md">
                    <div className="text-center py-8">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Company Created Successfully!</h3>
                        <p className="text-sm text-gray-500">The new company has been added to your system.</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Company</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Company Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter company name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Company Type *
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => handleTypeChange(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="corporate">Corporate</option>
                                        <option value="lender">Lender</option>
                                    </select>
                                </div>
                                
                                {/* Lender Selection - Only show for corporate companies */}
                                {formData.type === 'corporate' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Lender Company *
                                        </label>
                                        {loadingLenders ? (
                                            <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                                Loading lenders...
                                            </div>
                                        ) : (
                                            <select
                                                value={formData.lenderCompany}
                                                onChange={(e) => setFormData({...formData, lenderCompany: e.target.value})}
                                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                                            <p className="text-sm text-orange-600 mt-1">
                                                No lender companies found. Create a lender company first.
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
                            <h3 className="text-lg font-medium mb-4">Registration Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Registration Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.registrationNumber}
                                        onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter registration number"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tax Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.taxNumber}
                                        onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter tax number"
                                        required
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-medium mb-4">Contact Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.contactInfo.email}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            contactInfo: {...formData.contactInfo, email: e.target.value}
                                        })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter email address"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.contactInfo.phone}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            contactInfo: {...formData.contactInfo, phone: e.target.value}
                                        })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter phone number"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Website (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.contactInfo.website}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            contactInfo: {...formData.contactInfo, website: e.target.value}
                                        })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter website URL"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address Information */}
                    <Card>
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-medium mb-4">Address Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Street Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address.street}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            address: {...formData.address, street: e.target.value}
                                        })}
                                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter street address"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.address.city}
                                            onChange={(e) => setFormData({
                                                ...formData, 
                                                address: {...formData.address, city: e.target.value}
                                            })}
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter city"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Province
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.address.province}
                                            onChange={(e) => setFormData({
                                                ...formData, 
                                                address: {...formData.address, province: e.target.value}
                                            })}
                                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter province"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 pt-6 border-t">
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
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? (
                                <div className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </div>
                            ) : (
                                'Create Company'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}