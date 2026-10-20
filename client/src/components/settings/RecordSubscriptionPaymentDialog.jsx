import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import api from '@/utils/api';
import { formatDate } from '@/lib/format';
import { previewPeriodEnd } from '@/lib/subscription';

const METHOD_OPTIONS = [
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: 'custom', label: 'Custom end date' },
];

export default function RecordSubscriptionPaymentDialog({ company, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amount: '',
    method: 'mobile_money',
    reference: '',
    period: '1',
    customEnd: '',
    plan: company.subscription?.plan || 'standard',
    note: '',
  });
  const [error, setError] = useState(null);

  const set = (key) => (value) => setFormData((p) => ({ ...p, [key]: value }));
  const onInput = (key) => (e) => set(key)(e.target.value);

  const isCustom = formData.period === 'custom';
  const previewDate = isCustom
    ? (formData.customEnd ? new Date(formData.customEnd) : null)
    : previewPeriodEnd(company.subscription, Number(formData.period));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        amount: Number(formData.amount),
        method: formData.method,
        plan: formData.plan || undefined,
      };
      if (formData.reference.trim()) body.reference = formData.reference.trim();
      if (formData.note.trim()) body.note = formData.note.trim();
      if (isCustom) body.customPeriodEnd = formData.customEnd;
      else body.periodMonths = Number(formData.period);
      const response = await api.post(`/subscriptions/${company._id}/payments`, body);
      return response.data;
    },
    onSuccess: (result) => {
      const end = result?.data?.company?.subscription?.currentPeriodEnd;
      toast.success(end ? `Payment recorded. Access runs until ${formatDate(end)}.` : 'Payment recorded.');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-payments', company._id] });
      queryClient.invalidateQueries({ queryKey: ['subscription-audit', company._id] });
      onClose();
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to record payment';
      setError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!(Number(formData.amount) > 0)) {
      setError('Enter an amount greater than 0');
      return;
    }
    if (isCustom && !formData.customEnd) {
      setError('Choose a custom end date');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment — {company.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sub-pay-amount">Amount (K)</Label>
              <Input
                id="sub-pay-amount"
                type="number"
                min="0"
                step="0.01"
                className="font-mono text-right"
                value={formData.amount}
                onChange={onInput('amount')}
              />
            </div>
            <div>
              <Label htmlFor="sub-pay-method">Method</Label>
              <Select value={formData.method} onValueChange={set('method')}>
                <SelectTrigger id="sub-pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="sub-pay-reference">Reference</Label>
            <Input
              id="sub-pay-reference"
              className="font-mono"
              value={formData.reference}
              onChange={onInput('reference')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sub-pay-period">Period</Label>
              <Select value={formData.period} onValueChange={set('period')}>
                <SelectTrigger id="sub-pay-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sub-pay-plan">Plan</Label>
              <Input id="sub-pay-plan" value={formData.plan} onChange={onInput('plan')} />
            </div>
          </div>

          {isCustom && (
            <div>
              <Label htmlFor="sub-pay-custom-end">Access ends</Label>
              <Input
                id="sub-pay-custom-end"
                type="date"
                className="font-mono"
                value={formData.customEnd}
                onChange={onInput('customEnd')}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Access will run until{' '}
            <span className="font-mono text-foreground" data-testid="period-preview">
              {previewDate ? formatDate(previewDate) : '—'}
            </span>
          </p>

          <div>
            <Label htmlFor="sub-pay-note">Note</Label>
            <Textarea id="sub-pay-note" rows={2} value={formData.note} onChange={onInput('note')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Recording...' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
