import { useState, useEffect } from 'react';
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
import { CreditCard, Edit } from 'lucide-react';

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'read_only', 'suspended', 'cancelled'];

const statusBadgeColor = (status) => {
  const colors = {
    trialing: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    read_only: 'bg-orange-100 text-orange-800',
    suspended: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : '—');

export default function SubscriptionManagement() {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchLenders();
  }, []);

  const fetchLenders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscriptions');
      if (response.data.success) {
        setLenders(response.data.data.lenders);
      }
    } catch (err) {
      setError('Failed to load subscriptions');
      console.error('Subscriptions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdated = (updatedCompany) => {
    setLenders((prev) => prev.map((l) => (l._id === updatedCompany._id ? updatedCompany : l)));
    setEditing(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading subscriptions...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Lender subscriptions
        </h3>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Lender</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Trial ends</th>
                <th className="py-2 pr-4">Period ends</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {lenders.map((lender) => (
                <tr key={lender._id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium text-gray-900">{lender.name}</td>
                  <td className="py-3 pr-4">
                    <Badge className={statusBadgeColor(lender.subscription?.status)}>
                      {(lender.subscription?.status || 'trialing').replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{lender.subscription?.plan || 'standard'}</td>
                  <td className="py-3 pr-4 text-gray-600">{formatDate(lender.subscription?.trialEndsAt)}</td>
                  <td className="py-3 pr-4 text-gray-600">{formatDate(lender.subscription?.currentPeriodEnd)}</td>
                  <td className="py-3 pr-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(lender)}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lenders.length === 0 && (
            <p className="text-center text-gray-500 py-6">No lender companies found.</p>
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
        onUpdated(response.data.data.company);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subscription');
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
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

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
                <p className="text-xs text-red-600 mt-1">Required to set status to active</p>
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
