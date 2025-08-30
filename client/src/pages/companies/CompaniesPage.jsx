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

    if (loading) return <div className="p-8">Loading companies...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
                <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isLenderAdmin ? 'Create New Corporate Client' : 'Create New Company'}
                </Button>
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4">
                    {error}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
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