import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoanDetailsDialog } from '@/components/loans/LoanDetailsDialog';
import api from '@/utils/api';

export default function LoansPage() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    useEffect(() => {
        fetchLoans();
    }, []);

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

    if (loading) return <div className="p-8">Loading loans...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
                <Button 
                    onClick={() => {/* TODO: Add create loan functionality */}}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled
                >
                    Apply for Loan
                </Button>
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mb-6">
                    {error}
                </div>
            ) : null}

            {loans.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-gray-500 mb-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No loans found</h3>
                    <p className="text-gray-500">There are no loan applications to display.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
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
                            {loans.map((loan) => (
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
        </div>
    );
}
