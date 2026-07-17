import { cn } from '@/lib/utils';

const TINT_CLASSES = {
  default: 'bg-muted',
  periwinkle: 'bg-status-info-bg',
  accent: 'bg-tint-accent',
};

const LABEL_CLASSES = {
  default: 'text-muted-foreground',
  periwinkle: 'text-status-info-fg',
  accent: 'text-tint-accent-fg',
};

const VALUE_CLASSES = {
  default: 'text-foreground',
  periwinkle: 'text-status-info-fg',
  accent: 'text-tint-accent-fg',
};

export function MetricCard({ label, value, sub, tint = 'default', mono = true }) {
  return (
    <div className={cn('rounded-[14px] p-[18px]', TINT_CLASSES[tint])}>
      <p className={cn('text-xs mb-2', LABEL_CLASSES[tint])}>{label}</p>
      <p className={cn('text-[22px] font-medium', mono && 'font-mono', VALUE_CLASSES[tint])}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default MetricCard;
