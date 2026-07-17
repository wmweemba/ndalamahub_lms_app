export function DashboardLoading({ label = 'Loading dashboard...' }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function DashboardError({ message = 'Failed to load dashboard statistics' }) {
  return (
    <div className="p-8">
      <div className="rounded-2xl bg-status-danger-bg text-status-danger-fg px-5 py-4 text-sm">
        {message}
      </div>
    </div>
  );
}
