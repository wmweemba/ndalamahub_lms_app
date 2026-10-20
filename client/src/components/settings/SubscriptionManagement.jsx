import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import api from '@/utils/api';
import { formatDate } from '@/lib/format';
import { getAccessUntil, getExpiryStatus } from '@/lib/subscription';
import RecordSubscriptionPaymentDialog from './RecordSubscriptionPaymentDialog';
import SubscriptionHistoryDialog from './SubscriptionHistoryDialog';
import { CreditCard, Edit, Wallet, History } from 'lucide-react';

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'read_only', 'suspended', 'cancelled'];

// Subscription status -> pill tint mapping, UI_SPEC §17 Step 2.
const statusBadgeColor = (status) => {
  const colors = {
    trialing: 'bg-status-info-bg text-status-info-fg',
    active: 'bg-status-success-bg text-status-success-fg',
    past_due: 'bg-status-warning-bg text-status-warning-fg',
    read_only: 'bg-status-warning-bg text-status-warning-fg',
    suspended: 'bg-status-danger-bg text-status-danger-fg',
    cancelled: 'bg-status-danger-bg text-status-danger-fg',
  };
  return colors[status] || 'bg-[#F0F0EE] text-[#5F5E5A]';
};

const EXPIRY_TONE_CLASS = {
  danger: 'bg-status-danger-bg text-status-danger-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  neutral: 'bg-muted text-muted-foreground',
};

function AccessUntilCell({ subscription }) {
  const { date, kind } = getAccessUntil(subscription);
  const expiry = getExpiryStatus(subscription);
  if (!date) return <span className="font-mono text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div>
        <div className="font-mono text-foreground">{formatDate(date)}</div>
        <div className="text-xs text-muted-foreground">{kind === 'trial' ? 'Trial' : 'Paid'}</div>
      </div>
      {expiry && (
        <Badge className={`rounded-full ${EXPIRY_TONE_CLASS[expiry.tone]}`}>{expiry.label}</Badge>
      )}
    </div>
  );
}

export default function SubscriptionManagement() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [recording, setRecording] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);

  const { data: lenders = [], isLoading: loading, isError } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await api.get('/subscriptions');
      return response.data.success ? response.data.data.lenders : [];
    },
  });
  const error = isError ? 'Failed to load subscriptions' : null;

  const handleUpdated = (updatedCompany) => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-audit', updatedCompany._id] });
    setEditing(null);
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 rounded-2xl">
        <h3 className="text-base font-medium text-foreground mb-4 flex items-center">
          <CreditCard className="w-4 h-4 mr-2 text-muted-foreground" />
          Lender subscriptions
        </h3>

        {error && (
          <div className="mb-4 p-4 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 text-xs font-medium">Lender</th>
                <th className="py-2 pr-4 text-xs font-medium">Status</th>
                <th className="py-2 pr-4 text-xs font-medium">Plan</th>
                <th className="py-2 pr-4 text-xs font-medium">Access until</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {lenders.map((lender) => (
                <tr key={lender._id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">{lender.name}</td>
                  <td className="py-3 pr-4">
                    <Badge className={`rounded-full ${statusBadgeColor(lender.subscription?.status)}`}>
                      {(lender.subscription?.status || 'trialing').replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{lender.subscription?.plan || 'standard'}</td>
                  <td className="py-3 pr-4">
                    <AccessUntilCell subscription={lender.subscription} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(lender)}>
                        <Edit className="w-3.5 h-3.5 mr-1" /> Adjust
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRecording(lender)}>
                        <Wallet className="w-3.5 h-3.5 mr-1" /> Record payment
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setViewingHistory(lender)}>
                        <History className="w-3.5 h-3.5 mr-1" /> View history
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lenders.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">No lender companies found.</p>
          )}
        </div>
      </Card>

      {editing && (
        <EditSubscriptionDialog
          company={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      )}

      {recording && (
        <RecordSubscriptionPaymentDialog company={recording} onClose={() => setRecording(null)} />
      )}

      {viewingHistory && (
        <SubscriptionHistoryDialog company={viewingHistory} onClose={() => setViewingHistory(null)} />
      )}
    </div>
  );
}

function EditSubscriptionDialog({ company, onClose, onUpdated }) {
  const toInputDate = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

  const [formData, setFormData] = useState({
    status: company.subscription?.status || 'trialing',
    plan: company.subscription?.plan || 'standard',
    trialEndsAt: toInputDate(company.subscription?.trialEndsAt),
    currentPeriodEnd: toInputDate(company.subscription?.currentPeriodEnd),
    notes: company.subscription?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const response = await api.put(`/subscriptions/${company._id}`, {
        status: formData.status,
        plan: formData.plan,
        trialEndsAt: formData.trialEndsAt || null,
        currentPeriodEnd: formData.currentPeriodEnd || null,
        notes: formData.notes,
      });
      if (response.data.success) {
        toast.success('Subscription updated');
        onUpdated(response.data.data.company);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update subscription';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit subscription — {company.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">{error}</div>}

          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData((p) => ({ ...p, status: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Plan</Label>
            <Input value={formData.plan} onChange={(e) => setFormData((p) => ({ ...p, plan: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trial ends</Label>
              <Input
                type="date"
                value={formData.trialEndsAt}
                onChange={(e) => setFormData((p) => ({ ...p, trialEndsAt: e.target.value }))}
              />
            </div>
            <div>
              <Label>Current period ends</Label>
              <Input
                type="date"
                value={formData.currentPeriodEnd}
                onChange={(e) => setFormData((p) => ({ ...p, currentPeriodEnd: e.target.value }))}
              />
              {formData.status === 'active' && !formData.currentPeriodEnd && (
                <p className="text-xs text-status-danger-fg mt-1">Required to set status to active</p>
              )}
            </div>
          </div>

          <div>
            <Label>Notes (manual billing bookkeeping)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
