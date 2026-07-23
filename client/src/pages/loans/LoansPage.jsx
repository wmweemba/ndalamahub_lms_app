import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { StatusPill } from '@/components/ui/status-pill';
import { LoanDetailsDialog } from '@/components/loans/LoanDetailsDialog';
import ProductBasedLoanForm from '@/components/loans/ProductBasedLoanForm';
import api from '@/utils/api';
import { ROLES, canApplyForLoan, getCurrentUser } from '@/utils/roleUtils';
import { formatCurrency, formatDate, formatTerm } from '@/lib/format';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'in_arrears', label: 'In Arrears' },
  { value: 'completed', label: 'Completed' },
  { value: 'waived', label: 'Waived' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'defaulted', label: 'Defaulted' },
];

export default function LoansPage() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();

  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isApplicationFormOpen, setIsApplicationFormOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: loans = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await api.get('/loans');
      return res.data.data.loans;
    },
  });

  useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await api.get('/companies');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: selectedLoan } = useQuery({
    queryKey: ['loans', selectedLoanId],
    queryFn: async () => {
      const res = await api.get(`/loans/${selectedLoanId}`);
      return { ...res.data.data.loan, collateral: res.data.data.collateral || [] };
    },
    enabled: !!selectedLoanId,
  });

  const companiesWithLoans = useMemo(() => {
    const companyMap = new Map();
    loans.forEach((loan) => {
      if (loan.company && loan.company._id) {
        companyMap.set(loan.company._id, loan.company);
      }
    });
    return Array.from(companyMap.values());
  }, [loans]);

  const filteredLoans = useMemo(() => {
    let filtered = [...loans];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((loan) => loan.status === statusFilter);
    }

    if (companyFilter !== 'all') {
      filtered = filtered.filter((loan) => loan.company?._id === companyFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (loan) =>
          loan.loanNumber?.toLowerCase().includes(search) ||
          loan.applicant?.firstName?.toLowerCase().includes(search) ||
          loan.applicant?.lastName?.toLowerCase().includes(search) ||
          loan.applicant?.email?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [loans, statusFilter, companyFilter, searchTerm]);

  const resetFilters = () => {
    setStatusFilter('all');
    setCompanyFilter('all');
    setSearchTerm('');
  };

  const handleLoanClick = (loanId) => {
    setSelectedLoanId(loanId);
    setIsDetailsDialogOpen(true);
  };

  const handleDialogUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    if (selectedLoanId) {
      queryClient.invalidateQueries({ queryKey: ['loans', selectedLoanId] });
    }
  };

  const handleLoanApplicationSuccess = () => {
    setIsApplicationFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['loans'] });
  };

  const hasFiltersApplied = statusFilter !== 'all' || companyFilter !== 'all' || !!searchTerm;

  if (isLoading) return <div className="p-4 md:p-8 text-sm text-muted-foreground">Loading loans...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-[22px] font-medium text-foreground">Loans</h1>
        {currentUser && canApplyForLoan(currentUser.role) && (
          <Button onClick={() => setIsApplicationFormOpen(true)} className="w-full sm:w-auto">
            Apply for a loan
          </Button>
        )}
      </div>

      {error ? (
        <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 mb-6 text-sm">
          Failed to load loans
        </div>
      ) : null}

      {/* Filters */}
      <Card className="p-4 mb-6 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <div>
            <Label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentUser &&
            [ROLES.PLATFORM_ADMIN, ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER].includes(currentUser.role) && (
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
                    {companiesWithLoans.map((company) => (
                      <SelectItem key={company._id} value={company._id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Reset filters
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredLoans.length}</span> of{' '}
          <span className="font-medium text-foreground">{loans.length}</span> loans
        </div>
      </Card>

      {filteredLoans.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-medium text-foreground mb-2">
            {loans.length === 0 ? 'No loans yet' : 'No loans match your filters'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {loans.length === 0
              ? 'There are no loan applications to display.'
              : 'Try adjusting your filters to see more results.'}
          </p>
          {hasFiltersApplied && loans.length > 0 && (
            <Button variant="outline" onClick={resetFilters} className="mt-4">
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Applicant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Term</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Applied Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => (
                  <tr
                    key={loan._id}
                    className="border-b border-border last:border-0 hover:bg-muted cursor-pointer"
                    onClick={() => handleLoanClick(loan._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm pr-3">{loan.loanNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {loan.applicant?.firstName} {loan.applicant?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">{loan.applicant?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">
                      {loan.product?.category || loan.product?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {loan.company?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right pr-3 text-foreground">
                      {formatCurrency(loan.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatTerm(loan.term, loan.termUnit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusPill status={loan.status} />
                        {loan.rolloverCount >= 1 && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-warning-bg text-status-warning-fg">
                            Rolled over ×{loan.rolloverCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(loan.applicationDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-4">
            {filteredLoans.map((loan) => (
              <Card
                key={loan._id}
                className="p-4 cursor-pointer rounded-2xl"
                onClick={() => handleLoanClick(loan._id)}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-muted-foreground">Loan Number</p>
                      <p className="font-mono text-sm font-medium text-foreground">{loan.loanNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={loan.status} />
                      {loan.rolloverCount >= 1 && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-warning-bg text-status-warning-fg">
                          Rolled over ×{loan.rolloverCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Applicant</p>
                    <p className="font-medium text-foreground">
                      {loan.applicant?.firstName} {loan.applicant?.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{loan.applicant?.email}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="text-foreground">{loan.company?.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-mono font-medium text-base text-foreground">
                        {formatCurrency(loan.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Term</p>
                      <p className="font-medium text-foreground">{formatTerm(loan.term, loan.termUnit)}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <div>
                      <p className="text-sm text-muted-foreground">Applied</p>
                      <p className="text-sm text-foreground">{formatDate(loan.applicationDate)}</p>
                    </div>
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
          setSelectedLoanId(null);
        }}
        onUpdate={handleDialogUpdate}
      />

      <ProductBasedLoanForm
        open={isApplicationFormOpen}
        onClose={() => setIsApplicationFormOpen(false)}
        onSuccess={handleLoanApplicationSuccess}
      />
    </div>
  );
}
