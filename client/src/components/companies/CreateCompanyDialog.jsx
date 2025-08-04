import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';

export function CreateCompanyDialog({ open, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'corporate',
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.post('/companies', formData);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create company');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Create New Company</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Company Name"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full p-2 border rounded"
                            required
                        />
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                            className="w-full p-2 border rounded"
                            required
                        >
                            <option value="corporate">Corporate</option>
                            <option value="lender">Lender</option>
                        </select>
                    </div>

                    {/* Registration Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Registration Number"
                            value={formData.registrationNumber}
                            onChange={(e) => setFormData({...formData, registrationNumber: e.target.value})}
                            className="w-full p-2 border rounded"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Tax Number"
                            value={formData.taxNumber}
                            onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <input
                            type="email"
                            placeholder="Email"
                            value={formData.contactInfo.email}
                            onChange={(e) => setFormData({
                                ...formData, 
                                contactInfo: {...formData.contactInfo, email: e.target.value}
                            })}
                            className="w-full p-2 border rounded"
                            required
                        />
                        <input
                            type="tel"
                            placeholder="Phone"
                            value={formData.contactInfo.phone}
                            onChange={(e) => setFormData({
                                ...formData, 
                                contactInfo: {...formData.contactInfo, phone: e.target.value}
                            })}
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm">{error}</div>
                    )}

                    <div className="flex justify-end space-x-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? 'Creating...' : 'Create Company'}
                        </Button>
                    </div>
                </form>
            </div>
        </Dialog>
    );
}