import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoanDetailsDialog } from '@/components/loans/LoanDetailsDialog';
import ProductBasedLoanForm from '@/components/loans/ProductBasedLoanForm';
import api from '@/utils/api';
import { ROLES, canApplyForLoan } from '@/utils/roleUtils';

export default function LoansPage() {
    const [loans, setLoans] = useState([]);
    const [filteredLoans, setFilteredLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [isApplicationFormOpen, setIsApplicationFormOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Filter states
    const [statusFilter, setStatusFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [_companies, setCompanies] = useState([]);

    useEffect(() => {
        fetchLoans();
        fetchCurrentUser();
        fetchCompanies();
    }, []);

    // Apply filters whenever loans or filter criteria change
    useEffect(() => {
        applyFilters();
    }, [loans, statusFilter, companyFilter, searchTerm]);

    const fetchCurrentUser = async () => {
        try {
            const response = await api.get('/auth/me');
            if (response.data.success) {
                setCurrentUser(response.data.data.user);
            }
        } catch (err) {
            console.error('Failed to fetch current user:', err);
        }
    };

    const fetchCompanies = async () => {
        try {
            const response = await api.get('/companies');
            setCompanies(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Failed to fetch companies:', err);
        }
    };

    const fetchLoans = async () => {
        try {
            const response = await api.get('/loans');
            if (response.data.success && response.data.data) {
                setLoans(response.data.data.loans);
            } else {
                setError('Invalid response format from server');
            }
        } catch (err) {
            setError('Failed to load loans');
            console.error('Loans fetch error:', err);
            console.error('Error details:', err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...loans];

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(loan => loan.status === statusFilter);
        }

        // Company filter
        if (companyFilter !== 'all') {
            filtered = filtered.filter(loan => loan.company?._id === companyFilter);
        }

        // Search filter (loan number, applicant name, email)
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(loan => 
                loan.loanNumber?.toLowerCase().includes(search) ||
                loan.applicant?.firstName?.toLowerCase().includes(search) ||
                loan.applicant?.lastName?.toLowerCase().includes(search) ||
                loan.applicant?.email?.toLowerCase().includes(search)
            );
        }

        setFilteredLoans(filtered);
    };

    // Get unique companies from loans
    const getCompaniesWithLoans = () => {
        const companyMap = new Map();
        loans.forEach(loan => {
            if (loan.company && loan.company._id) {
                companyMap.set(loan.company._id, loan.company);
            }
        });
        return Array.from(companyMap.values());
    };

    const resetFilters = () => {
        setStatusFilter('all');
        setCompanyFilter('all');
        setSearchTerm('');
    };

    const handleLoanClick = async (loanId) => {
        try {
            const response = await api.get(`/loans/${loanId}`);
            if (response.data.success && response.data.data) {
                setSelectedLoan(response.data.data.loan);
                setIsDetailsDialogOpen(true);
            }
        } catch (err) {
            console.error('Failed to fetch loan details:', err);
            setError('Failed to load loan details');
        }
    };

    const getStatusColor = (status) => {
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'pending_approval': 'bg-orange-100 text-orange-800',
            'approved': 'bg-blue-100 text-blue-800',
            'disbursed': 'bg-green-100 text-green-800',
            'active': 'bg-green-100 text-green-800',
            'completed': 'bg-gray-100 text-gray-800',
            'rejected': 'bg-red-100 text-red-800',
            'defaulted': 'bg-red-200 text-red-900'
        };
        return statusColors[status] || 'bg-gray-100 text-gray-800';
    };

    const formatCurrency = (amount) => {
        return `K${amount?.toLocaleString() || '0'}`;
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleLoanApplicationSuccess = () => {
        setIsApplicationFormOpen(false);
        fetchLoans(); // Refresh the loans list
    };

    if (loading) return <div className="p-4 md:p-8">Loading loans...</div>;

    const displayLoans = filteredLoans.length > 0 ? filteredLoans : (statusFilter === 'all' && companyFilter === 'all' && !searchTerm ? loans : []);

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
                {/* Only show Apply for Loan button for borrowers */}
                {currentUser && canApplyForLoan(currentUser.role) && (
                    <Button 
                        onClick={() => setIsApplicationFormOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                    >
                        Apply for Loan
                    </Button>
                )}
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-6">
                    {error}
                </div>
            ) : null}

            {/* Filters Section */}
            <Card className="p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <Label htmlFor="search" className="text-sm font-medium mb-2 block">
                            Search
                        </Label>
                        <Input
                            id="search"
                            type="text"
                            placeholder="Loan #, Name, Email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    {/* Status Filter */}
                    <div>
                        <Label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
                            Status
                        </Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger id="status-filter">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="disbursed">Disbursed</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="defaulted">Defaulted</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Company Filter - Only show for platform admins and lender-side staff */}
                    {currentUser && [ROLES.PLATFORM_ADMIN, ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER].includes(currentUser.role) && (
                        <div>
                            <Label htmlFor="company-filter" className="text-sm font-medium mb-2 block">
                                Company
                            </Label>
                            <Select value={companyFilter} onValueChange={setCompanyFilter}>
                                <SelectTrigger id="company-filter">
                                    <SelectValue placeholder="All Companies" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Companies</SelectItem>
                                    {getCompaniesWithLoans().map((company) => (
                                        <SelectItem key={company._id} value={company._id}>
                                            {company.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Filter Actions */}
                    <div className="flex items-end gap-2">
                        <Button
                            variant="outline"
                            onClick={resetFilters}
                            className="w-full"
                        >
                            Reset Filters
                        </Button>
                    </div>
                </div>

                {/* Results Count */}
                <div className="mt-4 text-sm text-gray-600">
                    Showing <span className="font-medium">{displayLoans.length}</span> of{' '}
                    <span className="font-medium">{loans.length}</span> loans
                </div>
            </Card>

            {displayLoans.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-gray-500 mb-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {loans.length === 0 ? 'No loans found' : 'No loans match your filters'}
                    </h3>
                    <p className="text-gray-500">
                        {loans.length === 0 
                            ? 'There are no loan applications to display.' 
                            : 'Try adjusting your filters to see more results.'
                        }
                    </p>
                    {loans.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={resetFilters}
                            className="mt-4"
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop Table View - Hidden on mobile */}
                    <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Loan Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Applicant
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Loan Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Company
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Term
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Applied Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayLoans.map((loan) => (
                                    <tr 
                                        key={loan._id} 
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleLoanClick(loan._id)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                                            {loan.loanNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {loan.applicant?.firstName} {loan.applicant?.lastName}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {loan.applicant?.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                                                {loan.product?.category || loan.product?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {loan.company?.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(loan.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {loan.term} months
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(loan.status)}`}>
                                                {loan.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatDate(loan.applicationDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <Button
                                                variant="ghost"
                                                className="text-blue-600 hover:text-blue-900"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLoanClick(loan._id);
                                                }}
                                            >
                                                View Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Visible on mobile and tablet */}
                    <div className="lg:hidden space-y-4">
                        {displayLoans.map((loan) => (
                            <Card 
                                key={loan._id} 
                                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleLoanClick(loan._id)}
                            >
                                <div className="space-y-3">
                                    {/* Header with loan number and status */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-500">Loan Number</p>
                                            <p className="font-mono text-sm font-medium">{loan.loanNumber}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(loan.status)}`}>
                                            {loan.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {/* Applicant Info */}
                                    <div>
                                        <p className="text-sm text-gray-500">Applicant</p>
                                        <p className="font-medium text-gray-900">
                                            {loan.applicant?.firstName} {loan.applicant?.lastName}
                                        </p>
                                        <p className="text-sm text-gray-600">{loan.applicant?.email}</p>
                                    </div>

                                    {/* Loan Type */}
                                    <div>
                                        <p className="text-sm text-gray-500">Loan Type</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                                            {loan.product?.category || loan.product?.name || 'N/A'}
                                        </span>
                                    </div>

                                    {/* Company */}
                                    <div>
                                        <p className="text-sm text-gray-500">Company</p>
                                        <p className="text-gray-900">{loan.company?.name}</p>
                                    </div>

                                    {/* Amount and Term in a row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Amount</p>
                                            <p className="font-semibold text-lg text-gray-900">
                                                {formatCurrency(loan.amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Term</p>
                                            <p className="font-medium text-gray-900">{loan.term} months</p>
                                        </div>
                                    </div>

                                    {/* Date and Action Button */}
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                        <div>
                                            <p className="text-sm text-gray-500">Applied</p>
                                            <p className="text-sm text-gray-900">{formatDate(loan.applicationDate)}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-600 hover:text-blue-900"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLoanClick(loan._id);
                                            }}
                                        >
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            <LoanDetailsDialog
                loan={selectedLoan}
                open={isDetailsDialogOpen}
                onClose={() => {
                    setIsDetailsDialogOpen(false);
                    setSelectedLoan(null);
                }}
                onUpdate={fetchLoans}
            />

            <ProductBasedLoanForm
                open={isApplicationFormOpen}
                onClose={() => setIsApplicationFormOpen(false)}
                onSuccess={handleLoanApplicationSuccess}
            />
        </div>
    );
}
