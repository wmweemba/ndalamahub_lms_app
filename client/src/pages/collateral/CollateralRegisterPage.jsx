import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import api from '@/utils/api';
import { formatCurrency } from '@/lib/format';

const TYPE_LABELS = {
  vehicle: 'Vehicle',
  business_equipment: 'Business equipment',
  title_deed: 'Title deed',
  other: 'Other',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'declared', label: 'Declared' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'business_equipment', label: 'Business equipment' },
  { value: 'title_deed', label: 'Title deed' },
  { value: 'other', label: 'Other' },
];

export default function CollateralRegisterPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const {
    data: records = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['collateral'],
    queryFn: async () => {
      const res = await api.get('/collateral');
      return res.data.data.collateral;
    },
  });

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      return true;
    });
  }, [records, statusFilter, typeFilter]);

  const totalVerifiedValue = useMemo(
    () => filtered.filter((r) => r.status === 'verified').reduce((sum, r) => sum + (r.estimatedValue || 0), 0),
    [filtered]
  );

  if (isLoading) return <div className="p-4 md:p-8 text-sm text-muted-foreground">Loading collateral register...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-[22px] font-medium text-foreground">Collateral register</h1>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total verified value</p>
          <p className="font-mono text-lg font-medium text-foreground">{formatCurrency(totalVerifiedValue)}</p>
        </div>
      </div>

      {error ? (
        <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 mb-6 text-sm">
          Failed to load the collateral register
        </div>
      ) : null}

      <Card className="p-4 mb-6 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of{' '}
          <span className="font-medium text-foreground">{records.length}</span> records
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl">
          <h3 className="text-base font-medium text-foreground mb-2">No collateral records</h3>
          <p className="text-sm text-muted-foreground">No collateral matches the current filters.</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Borrower</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Letter of sale</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record._id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                      {record.loan?.loanNumber ? (
                        <a href={`/loans?loan=${record.loan._id}`} className="text-status-info-fg hover:underline">
                          {record.loan.loanNumber}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {record.loan?.applicant
                        ? `${record.loan.applicant.firstName || ''} ${record.loan.applicant.lastName || ''}`.trim()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {record.type === 'other' ? record.otherDescription : TYPE_LABELS[record.type]}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{record.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right">
                      {formatCurrency(record.estimatedValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusPill status={record.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {record.letterOfSale?.onFile ? 'On file' : 'Not on file'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-4">
            {filtered.map((record) => (
              <Card key={record._id} className="p-4 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-mono text-sm font-medium text-foreground">
                    {record.loan?.loanNumber || 'N/A'}
                  </p>
                  <StatusPill status={record.status} />
                </div>
                <p className="text-sm text-foreground">
                  {record.loan?.applicant
                    ? `${record.loan.applicant.firstName || ''} ${record.loan.applicant.lastName || ''}`.trim()
                    : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {record.type === 'other' ? record.otherDescription : TYPE_LABELS[record.type]} — {record.description}
                </p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                  <span className="font-mono font-medium text-foreground">{formatCurrency(record.estimatedValue)}</span>
                  <span className="text-xs text-muted-foreground">
                    {record.letterOfSale?.onFile ? 'Letter on file' : 'Letter not on file'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
