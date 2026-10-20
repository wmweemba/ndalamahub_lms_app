import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/lib/format';

const METHOD_LABEL = {
  mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  other: 'Other',
};

const ACTION_LABEL = {
  'subscription.adjusted': 'Adjusted',
  'subscription.payment_recorded': 'Payment recorded',
  'subscription.status_changed': 'Automatic status change',
};

// Same tint mapping as the Billing table's status pill (UI_SPEC §3.2).
const STATUS_TINT = {
  trialing: 'bg-status-info-bg text-status-info-fg',
  active: 'bg-status-success-bg text-status-success-fg',
  past_due: 'bg-status-warning-bg text-status-warning-fg',
  read_only: 'bg-status-warning-bg text-status-warning-fg',
  suspended: 'bg-status-danger-bg text-status-danger-fg',
  cancelled: 'bg-status-danger-bg text-status-danger-fg',
};

const DATE_FIELDS = ['trialEndsAt', 'currentPeriodEnd', 'suspendedAt'];

function personName(user) {
  if (!user) return null;
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username || null;
}

function StatusValue({ value }) {
  if (!value) return <span className="font-mono">—</span>;
  return (
    <Badge className={`rounded-full ${STATUS_TINT[value] || 'bg-muted text-muted-foreground'}`}>
      {String(value).replace(/_/g, ' ')}
    </Badge>
  );
}

function ChangeValue({ field, value }) {
  if (field === 'status') return <StatusValue value={value} />;
  if (value === null || value === undefined || value === '') return <span className="font-mono">—</span>;
  if (DATE_FIELDS.includes(field)) return <span className="font-mono">{formatDate(value)}</span>;
  return <span className="font-mono">{String(value)}</span>;
}

function PaymentsTable({ companyId }) {
  const { data: payments = [], isLoading, isError } = useQuery({
    queryKey: ['subscription-payments', companyId],
    queryFn: async () => (await api.get(`/subscriptions/${companyId}/payments`)).data.data.payments,
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  if (isError) return <p className="py-6 text-center text-sm text-status-danger-fg">Failed to load payments</p>;
  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-4 text-xs font-medium">Date recorded</th>
            <th className="py-2 pr-4 text-xs font-medium text-right">Amount</th>
            <th className="py-2 pr-4 text-xs font-medium">Method</th>
            <th className="py-2 pr-4 text-xs font-medium">Reference</th>
            <th className="py-2 pr-4 text-xs font-medium">Period</th>
            <th className="py-2 text-xs font-medium">Recorded by</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p._id} className="border-b border-border last:border-0 align-top">
              <td className="py-3 pr-4 font-mono">{formatDate(p.createdAt)}</td>
              <td className="py-3 pr-4 font-mono text-right">{formatCurrency(p.amount)}</td>
              <td className="py-3 pr-4">{METHOD_LABEL[p.method] || p.method}</td>
              <td className="py-3 pr-4 font-mono">{p.reference || '—'}</td>
              <td className="py-3 pr-4 font-mono whitespace-nowrap">
                {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
              </td>
              <td className="py-3">{personName(p.recordedBy) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangesTable({ companyId }) {
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['subscription-audit', companyId],
    queryFn: async () => (await api.get(`/subscriptions/${companyId}/audit`)).data.data.entries,
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  if (isError) return <p className="py-6 text-center text-sm text-status-danger-fg">Failed to load changes</p>;
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No changes recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-4 text-xs font-medium">When</th>
            <th className="py-2 pr-4 text-xs font-medium">Action</th>
            <th className="py-2 pr-4 text-xs font-medium">By</th>
            <th className="py-2 text-xs font-medium">What changed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry._id} className="border-b border-border last:border-0 align-top">
              <td className="py-3 pr-4 font-mono whitespace-nowrap">{formatDate(entry.createdAt)}</td>
              <td className="py-3 pr-4">{ACTION_LABEL[entry.action] || entry.action}</td>
              <td className="py-3 pr-4">
                {entry.source === 'system' ? 'System' : personName(entry.performedBy) || '—'}
              </td>
              <td className="py-3">
                {(entry.changedFields || []).length === 0 ? (
                  <span className="font-mono">—</span>
                ) : (
                  <div className="space-y-1">
                    {entry.changedFields.map((field) => (
                      <div key={field}>
                        <span className="text-muted-foreground">{field}:</span>{' '}
                        <ChangeValue field={field} value={entry.before?.[field]} />{' '}
                        <span className="text-muted-foreground">→</span>{' '}
                        <ChangeValue field={field} value={entry.after?.[field]} />
                      </div>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SubscriptionHistoryDialog({ company, onClose }) {
  const [activeTab, setActiveTab] = useState('payments');

  const tabClass = (tab) =>
    `px-4 py-2 rounded-full text-sm font-medium ${
      activeTab === tab ? 'bg-nh-sage text-foreground' : 'text-muted-foreground hover:bg-muted/40'
    }`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Billing history — {company.name}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveTab('payments')} className={tabClass('payments')}>
            Payments
          </button>
          <button type="button" onClick={() => setActiveTab('changes')} className={tabClass('changes')}>
            Changes
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {activeTab === 'payments' ? (
            <PaymentsTable companyId={company._id} />
          ) : (
            <ChangesTable companyId={company._id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
