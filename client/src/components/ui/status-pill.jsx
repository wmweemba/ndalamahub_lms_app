import { cn } from '@/lib/utils';

// Canonical status -> pill tint mapping, UI_SPEC.md §3.2. Keep in sync with any new statuses.
export const STATUS_PILL_MAP = {
  pending: 'warning',
  pending_approval: 'warning',
  pending_documents: 'warning',
  under_review: 'warning',
  pending_disbursement: 'warning',
  approved: 'info',
  disbursed: 'success',
  active: 'success',
  in_arrears: 'warning',
  defaulted: 'danger',
  rejected: 'danger',
  completed: 'neutral',
  waived: 'neutral',
  closed: 'neutral',
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  // installment statuses (loan detail repayment schedule)
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
};

const TINT_CLASSES = {
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-[#F0F0EE] text-[#5F5E5A]',
};

export function statusToTint(status) {
  return STATUS_PILL_MAP[status] || 'neutral';
}

export function StatusPill({ status, className }) {
  const tint = statusToTint(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TINT_CLASSES[tint],
        className
      )}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

export default StatusPill;
