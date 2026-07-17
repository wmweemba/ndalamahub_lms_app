import { StatusPill } from '@/components/ui/status-pill';

export function StatusBreakdownCard({ title, rows }) {
  return (
    <div className="rounded-2xl bg-muted p-5">
      <h3 className="text-[15px] font-medium mb-4">{title}</h3>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium">{row.count}</span>
              <StatusPill status={row.pill} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusBreakdownCard;
