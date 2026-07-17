import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Download, FileText, Calendar } from 'lucide-react';
import api from '@/utils/api';

export default function ReportModal({ report, onClose }) {
  const [loading, setLoading] = useState(false);

  const exportReport = async (format) => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/${report.type}/export/${format}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Set filename based on format
      const fileExtension = format === 'excel' ? 'xlsx' : 'pdf';
      const fileName = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (err) {
      console.error(`Export ${format} error:`, err);

      if (err.response) {
        toast.error(`Failed to export as ${format.toUpperCase()}: ${err.response.data?.message || `Server error: ${err.response.status}`}`);
      } else if (err.request) {
        toast.error(`Failed to export as ${format.toUpperCase()}: Network error. Please check your connection.`);
      } else {
        toast.error(`Failed to export as ${format.toUpperCase()}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: 'ZMW',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const dueSoonClass = (days) =>
    days <= 3 ? 'text-status-danger-fg' : days <= 7 ? 'text-status-warning-fg' : 'text-status-success-fg';

  const renderReportContent = () => {
    switch (report.type) {
      case 'active-loans':
        return (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Borrower</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Monthly payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Next payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((loan) => (
                    <tr key={loan._id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                        {loan.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {loan.applicant?.firstName} {loan.applicant?.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {loan.company?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-foreground">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-foreground">
                        {formatCurrency(loan.monthlyPayment)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={loan.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {report.data.map((loan) => (
                <div key={loan._id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-mono font-medium text-foreground mb-1">
                          {loan.loanNumber}
                        </h3>
                        <p className="text-sm text-foreground">
                          {loan.applicant?.firstName} {loan.applicant?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {loan.company?.name}
                        </p>
                      </div>
                      <StatusPill status={loan.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <p className="font-mono font-medium text-foreground">{formatCurrency(loan.amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Monthly payment:</span>
                        <p className="font-mono font-medium text-foreground">{formatCurrency(loan.monthlyPayment)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Next payment:</span>
                        <p className="font-medium text-foreground">
                          {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'overdue-loans':
        return (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Borrower</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Amount overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Days overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Last payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((loan) => (
                    <tr key={loan._id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                        {loan.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {loan.applicant?.firstName} {loan.applicant?.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {loan.company?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-status-danger-fg">
                        {formatCurrency(loan.overdueAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-mono font-medium ${loan.daysOverdue > 90 ? 'text-status-danger-fg' : loan.daysOverdue > 30 ? 'text-status-warning-fg' : 'text-status-warning-fg'}`}>
                          {loan.daysOverdue || 0} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'None'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={loan.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {report.data.map((loan) => (
                <div key={loan._id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-mono font-medium text-foreground mb-1">
                          {loan.loanNumber}
                        </h3>
                        <p className="text-sm text-foreground">
                          {loan.applicant?.firstName} {loan.applicant?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {loan.company?.name}
                        </p>
                      </div>
                      <StatusPill status={loan.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount overdue:</span>
                        <p className="font-mono font-medium text-status-danger-fg">{formatCurrency(loan.overdueAmount || 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days overdue:</span>
                        <p className={`font-mono font-medium ${loan.daysOverdue > 90 ? 'text-status-danger-fg' : 'text-status-warning-fg'}`}>
                          {loan.daysOverdue || 0} days
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last payment:</span>
                        <p className="font-medium text-foreground">
                          {loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'None'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'upcoming-payments':
        return (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Loan number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Borrower</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Payment amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Due date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Days until due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((payment) => (
                    <tr key={`${payment.loanId}-${payment.installmentNumber}`} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">
                        {payment.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {payment.borrowerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {payment.companyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-right text-foreground">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(payment.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-mono font-medium ${dueSoonClass(payment.daysUntilDue)}`}>
                          {payment.daysUntilDue} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {payment.borrowerPhone || payment.borrowerEmail || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {report.data.map((payment) => (
                <div key={`${payment.loanId}-${payment.installmentNumber}`} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-mono font-medium text-foreground mb-1">
                          {payment.loanNumber}
                        </h3>
                        <p className="text-sm text-foreground">
                          {payment.borrowerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.companyName}
                        </p>
                      </div>
                      <span className={`text-xs font-mono font-medium ${dueSoonClass(payment.daysUntilDue)}`}>
                        {payment.daysUntilDue} days
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Payment amount:</span>
                        <p className="font-mono font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due date:</span>
                        <p className="font-medium text-foreground">{formatDate(payment.dueDate)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Contact:</span>
                        <p className="font-medium text-foreground">
                          {payment.borrowerPhone || payment.borrowerEmail || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      default:
        return (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base font-medium text-foreground mb-2">Unsupported report type</h3>
            <p className="text-sm text-muted-foreground">This report type is not yet supported for display.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base font-medium">
            <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
            {report.title}
            <span className="text-sm text-muted-foreground ml-2 font-normal">
              ({report.data.length} records)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Export Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportReport('pdf')}
            disabled={loading}
            className="flex items-center justify-center w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportReport('excel')}
            disabled={loading}
            className="flex items-center justify-center w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Excel
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {report.data.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base font-medium text-foreground mb-2">No data found</h3>
              <p className="text-sm text-muted-foreground">There are no records matching the criteria for this report.</p>
            </div>
          ) : (
            renderReportContent()
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-2">
            <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
              Generated on {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="flex items-center gap-4 order-1 sm:order-2">
              <span className="text-xs sm:text-sm text-muted-foreground">
                Total records: {report.data.length}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
