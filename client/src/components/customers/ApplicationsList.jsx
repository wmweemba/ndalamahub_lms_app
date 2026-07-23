import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { ApplicationDetailDialog } from '@/components/customers/ApplicationDetailDialog';
import { useCustomerApplications } from '@/hooks/useCustomerApplications';
import { formatCurrency, formatDate } from '@/lib/format';

const COLLATERAL_LABEL = {
    vehicle: 'Vehicle',
    business_equipment: 'Business equipment',
    title_deed: 'Title deed',
    other: 'Other',
};

export function ApplicationsList() {
    const [selected, setSelected] = useState(null);
    const { data: applications = [], isLoading, error } = useCustomerApplications('pending');

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 text-sm">
                Failed to load applications
            </div>
        );
    }

    if (applications.length === 0) {
        return (
            <Card className="p-8 text-center rounded-2xl">
                <h3 className="text-base font-medium text-foreground mb-2">No pending applications</h3>
                <p className="text-sm text-muted-foreground">
                    Website applications will appear here for review.
                </p>
            </Card>
        );
    }

    return (
        <>
            {/* Desktop table */}
            <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Reference</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">NRC</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Requested</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Collateral</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Received</th>
                        </tr>
                    </thead>
                    <tbody>
                        {applications.map((app) => (
                            <tr
                                key={app._id}
                                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
                                onClick={() => setSelected(app)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                                    {app.reference || '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                    {app.applicant.fullName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                                    {app.applicant.nrc}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-foreground">
                                    {formatCurrency(app.loanRequest.amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                    {COLLATERAL_LABEL[app.collateral?.type] || '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusPill status={app.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                    {formatDate(app.createdAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-4">
                {applications.map((app) => (
                    <Card
                        key={app._id}
                        className="p-4 rounded-2xl cursor-pointer"
                        onClick={() => setSelected(app)}
                    >
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-base text-foreground truncate">
                                    {app.applicant.fullName}
                                </h3>
                                <p className="text-sm font-mono text-muted-foreground">{app.applicant.nrc}</p>
                            </div>
                            <StatusPill status={app.status} />
                        </div>
                        <div className="mt-3 flex justify-between text-sm text-muted-foreground">
                            <span className="font-mono text-foreground">{formatCurrency(app.loanRequest.amount)}</span>
                            <span>{COLLATERAL_LABEL[app.collateral?.type] || 'No collateral'}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Received {formatDate(app.createdAt)}</p>
                    </Card>
                ))}
            </div>

            <ApplicationDetailDialog
                application={selected}
                open={!!selected}
                onClose={() => setSelected(null)}
            />
        </>
    );
}
