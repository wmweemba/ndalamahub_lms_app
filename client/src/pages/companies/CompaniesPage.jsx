import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateCompanyDialog } from '@/components/companies/CreateCompanyDialog';
import { EditCompanyDialog } from '@/components/companies/EditCompanyDialog';
import api from '@/utils/api';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';

export function CompaniesPage() {
    const currentUser = getCurrentUser();
    const isLenderAdmin = currentUser?.role === ROLES.LENDER_ADMIN;
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const response = await api.get('/companies');
            setCompanies(response.data);
        } catch (err) {
            setError('Failed to load companies');
            console.error('Companies fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (company) => {
        setSelectedCompany(company);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this company?')) {
            try {
                await api.delete(`/companies/${id}`);
                setCompanies(companies.filter(company => company._id !== id));
            } catch (err) {
                setError('Failed to delete company');
            }
        }
    };

    if (loading) return <div className="p-4 md:p-8">Loading companies...</div>;

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
                <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                    {isLenderAdmin ? 'Create New Corporate Client' : 'Create New Company'}
                </Button>
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-6">
                    {error}
                </div>
            ) : (
                <>
                    {companies.length === 0 ? (
                        <Card className="p-8 text-center">
                            <div className="text-gray-500 mb-4">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
                            <p className="text-gray-500">Get started by creating your first company.</p>
                        </Card>
                    ) : (
                        <>
                            {/* Desktop Table View - Hidden on mobile */}
                            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
                                <table className="min-w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Contact Email
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {companies.map((company) => (
                                            <tr key={company._id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {company.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        company.type === 'lender' 
                                                            ? 'bg-blue-100 text-blue-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {company.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        company.isActive
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {company.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {company.contactInfo.email}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <Button
                                                        variant="ghost"
                                                        className="text-blue-600 hover:text-blue-900 mr-2"
                                                        onClick={() => handleEdit(company)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="text-red-600 hover:text-red-900"
                                                        onClick={() => handleDelete(company._id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View - Visible on mobile and tablet */}
                            <div className="lg:hidden space-y-4">
                                {companies.map((company) => (
                                    <Card key={company._id} className="p-4 hover:shadow-md transition-shadow">
                                        <div className="space-y-3">
                                            {/* Header with company name and status badges */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-lg text-gray-900 truncate">
                                                        {company.name}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-col gap-2 ml-3">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        company.type === 'lender' 
                                                            ? 'bg-blue-100 text-blue-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {company.type}
                                                    </span>
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        company.isActive
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {company.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Company Details */}
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-sm text-gray-500">Contact Email</p>
                                                    <p className="text-gray-900 text-sm">{company.contactInfo?.email || 'No email provided'}</p>
                                                </div>
                                                
                                                {company.contactInfo?.phone && (
                                                    <div>
                                                        <p className="text-sm text-gray-500">Phone</p>
                                                        <p className="text-gray-900 text-sm">{company.contactInfo.phone}</p>
                                                    </div>
                                                )}

                                                {company.contactInfo?.address && (
                                                    <div>
                                                        <p className="text-sm text-gray-500">Address</p>
                                                        <p className="text-gray-900 text-sm">{company.contactInfo.address}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 pt-3 border-t border-gray-100">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    onClick={() => handleEdit(company)}
                                                >
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                                    onClick={() => handleDelete(company._id)}
                                                >
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            <CreateCompanyDialog
                open={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    fetchCompanies();
                }}
            />

            <EditCompanyDialog
                company={selectedCompany}
                open={isEditDialogOpen}
                onClose={() => {
                    setIsEditDialogOpen(false);
                    setSelectedCompany(null);
                }}
                onSuccess={() => {
                    setIsEditDialogOpen(false);
                    setSelectedCompany(null);
                    fetchCompanies();
                }}
            />
        </div>
    );
}