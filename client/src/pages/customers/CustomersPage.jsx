import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { CreateCustomerDialog } from '@/components/customers/CreateCustomerDialog';
import { CustomerDetailDialog } from '@/components/customers/CustomerDetailDialog';
import { ApplicationsList } from '@/components/customers/ApplicationsList';
import { useCustomerApplications } from '@/hooks/useCustomerApplications';
import api from '@/utils/api';

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('customers');

    const { data: pendingApplications = [] } = useCustomerApplications('pending');

    const {
        data: customers = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const response = await api.get('/users?role=borrower');
            return Array.isArray(response.data) ? response.data : [];
        },
    });

    const invalidateCustomers = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

    const filteredCustomers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return customers;
        return customers.filter((customer) => {
            const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
            return (
                fullName.includes(term) ||
                customer.nrc?.toLowerCase().includes(term) ||
                customer.phone?.toLowerCase().includes(term)
            );
        });
    }, [customers, searchTerm]);

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-[22px] font-medium text-foreground">Customers</h1>
                {activeTab === 'customers' && (
                    <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        Add customer
                    </Button>
                )}
            </div>

            <div className="flex gap-2 mb-6">
                <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                        activeTab === 'customers'
                            ? 'bg-[--nh-sage] text-foreground'
                            : 'text-muted-foreground hover:bg-muted/40'
                    }`}
                >
                    Customers
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('applications')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                        activeTab === 'applications'
                            ? 'bg-[--nh-sage] text-foreground'
                            : 'text-muted-foreground hover:bg-muted/40'
                    }`}
                >
                    Applications
                    {pendingApplications.length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[--nh-accent] text-white text-xs font-medium">
                            {pendingApplications.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'applications' ? (
                <ApplicationsList />
            ) : isLoading ? (
                <div className="flex justify-center">
                    <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
                </div>
            ) : (
            <>
            <div className="mb-6">
                <Input
                    type="search"
                    placeholder="Search by name, NRC, or phone"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            {error ? (
                <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 mb-6 text-sm">
                    Failed to load customers
                </div>
            ) : filteredCustomers.length === 0 ? (
                <Card className="p-8 text-center rounded-2xl">
                    <h3 className="text-base font-medium text-foreground mb-2">No customers found</h3>
                    <p className="text-sm text-muted-foreground">
                        {customers.length === 0
                            ? 'Get started by adding your first customer.'
                            : 'No customers match your search.'}
                    </p>
                </Card>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">NRC</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer._id}
                                        className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
                                        onClick={() => setSelectedCustomer(customer)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                            {customer.firstName} {customer.lastName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                                            {customer.nrc}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {customer.phone}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {customer.email || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusPill status={customer.isActive ? 'active' : 'inactive'} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {filteredCustomers.map((customer) => (
                            <Card
                                key={customer._id}
                                className="p-4 rounded-2xl cursor-pointer"
                                onClick={() => setSelectedCustomer(customer)}
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-base text-foreground truncate">
                                            {customer.firstName} {customer.lastName}
                                        </h3>
                                        <p className="text-sm font-mono text-muted-foreground">{customer.nrc}</p>
                                    </div>
                                    <StatusPill status={customer.isActive ? 'active' : 'inactive'} />
                                </div>
                                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                                    <p>{customer.phone}</p>
                                    <p>{customer.email || 'No email on file'}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
            </>
            )}

            <CreateCustomerDialog
                open={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    invalidateCustomers();
                }}
            />

            <CustomerDetailDialog
                customer={selectedCustomer}
                open={!!selectedCustomer}
                onClose={() => setSelectedCustomer(null)}
                onUpdate={invalidateCustomers}
            />
        </div>
    );
}
