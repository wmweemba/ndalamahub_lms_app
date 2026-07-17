import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { CreateCompanyDialog } from '@/components/companies/CreateCompanyDialog';
import { EditCompanyDialog } from '@/components/companies/EditCompanyDialog';
import api from '@/utils/api';
import { getCurrentUser, ROLES } from '@/utils/roleUtils';

const TYPE_TINT_CLASSES = {
    lender: 'bg-status-info-bg text-status-info-fg',
    corporate: 'bg-[#F0F0EE] text-[#5F5E5A]',
};

function TypePill({ type }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_TINT_CLASSES[type] || TYPE_TINT_CLASSES.corporate}`}
        >
            {type}
        </span>
    );
}

export function CompaniesPage() {
    const currentUser = getCurrentUser();
    const isLenderAdmin = currentUser?.role === ROLES.LENDER_ADMIN;
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);

    const {
        data: companies = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ['companies'],
        queryFn: async () => {
            const response = await api.get('/companies');
            return Array.isArray(response.data) ? response.data : [];
        },
    });

    const invalidateCompanies = () => queryClient.invalidateQueries({ queryKey: ['companies'] });

    const handleEdit = (company) => {
        setSelectedCompany(company);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this company?')) {
            try {
                await api.delete(`/companies/${id}`);
                toast.success('Company deleted');
                invalidateCompanies();
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to delete company');
            }
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-[22px] font-medium text-foreground">Companies</h1>
                <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="w-full sm:w-auto"
                >
                    {isLenderAdmin ? 'Create employer client' : 'Create company'}
                </Button>
            </div>

            {error ? (
                <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 mb-6 text-sm">
                    Failed to load companies
                </div>
            ) : companies.length === 0 ? (
                <Card className="p-8 text-center rounded-2xl">
                    <div className="mb-4">
                        <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-2">No companies found</h3>
                    <p className="text-sm text-muted-foreground">Get started by creating your first company.</p>
                </Card>
            ) : (
                <>
                    {/* Desktop Table View - Hidden on mobile */}
                    <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Contact email</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map((company) => (
                                    <tr key={company._id} className="border-b border-border last:border-0">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                            {company.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <TypePill type={company.type} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusPill status={company.isActive ? 'active' : 'inactive'} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {company.contactInfo?.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(company)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-status-danger-fg hover:text-status-danger-fg"
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
                            <Card key={company._id} className="p-4 rounded-2xl">
                                <div className="space-y-3">
                                    {/* Header with company name and status badges */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-base text-foreground truncate">
                                                {company.name}
                                            </h3>
                                        </div>
                                        <div className="flex flex-col gap-2 ml-3 items-end">
                                            <TypePill type={company.type} />
                                            <StatusPill status={company.isActive ? 'active' : 'inactive'} />
                                        </div>
                                    </div>

                                    {/* Company Details */}
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Contact email</p>
                                            <p className="text-foreground text-sm">{company.contactInfo?.email || 'No email provided'}</p>
                                        </div>

                                        {company.contactInfo?.phone && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Phone</p>
                                                <p className="text-foreground text-sm">{company.contactInfo.phone}</p>
                                            </div>
                                        )}

                                        {company.contactInfo?.address && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Address</p>
                                                <p className="text-foreground text-sm">{company.contactInfo.address}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-3 border-t border-border">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleEdit(company)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-status-danger-fg border-status-danger-fg/30 hover:bg-status-danger-bg"
                                            onClick={() => handleDelete(company._id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            <CreateCompanyDialog
                open={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    invalidateCompanies();
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
                    invalidateCompanies();
                }}
            />
        </div>
    );
}
