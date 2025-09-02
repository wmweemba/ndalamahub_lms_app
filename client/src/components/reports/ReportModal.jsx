import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, DollarSign } from 'lucide-react';
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
      
      console.log(`${format.toUpperCase()} export successful`);
    } catch (err) {
      console.error(`Export ${format} error:`, err);
      
      // Check if it's a network error or server error
      if (err.response) {
        // Server responded with error status
        const errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        alert(`Failed to export as ${format.toUpperCase()}: ${errorMessage}`);
      } else if (err.request) {
        // Request was made but no response received
        alert(`Failed to export as ${format.toUpperCase()}: Network error. Please check your connection.`);
      } else {
        // Something else happened
        alert(`Failed to export as ${format.toUpperCase()}: ${err.message}`);
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

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      approved: 'text-green-600 bg-green-100',
      rejected: 'text-red-600 bg-red-100',
      active: 'text-blue-600 bg-blue-100',
      disbursed: 'text-purple-600 bg-purple-100',
      in_arrears: 'text-orange-600 bg-orange-100',
      defaulted: 'text-red-600 bg-red-100',
      completed: 'text-gray-600 bg-gray-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const renderReportContent = () => {
    switch (report.type) {
      case 'active-loans':
        return (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.data.map((loan) => (
                    <tr key={loan._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {loan.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.applicant?.firstName} {loan.applicant?.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.company?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(loan.monthlyPayment)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.nextPaymentDate ? formatDate(loan.nextPaymentDate) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(loan.status)}`}>
                          {loan.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {report.data.map((loan) => (
                <div key={loan._id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                          {loan.loanNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {loan.applicant?.firstName} {loan.applicant?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loan.company?.name}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(loan.status)}`}>
                        {loan.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <p className="font-medium text-gray-900">{formatCurrency(loan.amount)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Monthly Payment:</span>
                        <p className="font-medium text-gray-900">{formatCurrency(loan.monthlyPayment)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Next Payment:</span>
                        <p className="font-medium text-gray-900">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Overdue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Overdue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.data.map((loan) => (
                    <tr key={loan._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {loan.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.applicant?.firstName} {loan.applicant?.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.company?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(loan.overdueAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`font-medium ${loan.daysOverdue > 90 ? 'text-red-600' : loan.daysOverdue > 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                          {loan.daysOverdue || 0} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'None'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(loan.status)}`}>
                          {loan.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {report.data.map((loan) => (
                <div key={loan._id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                          {loan.loanNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {loan.applicant?.firstName} {loan.applicant?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loan.company?.name}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(loan.status)}`}>
                        {loan.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Amount Overdue:</span>
                        <p className="font-medium text-red-600">{formatCurrency(loan.overdueAmount || 0)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Days Overdue:</span>
                        <p className={`font-medium ${loan.daysOverdue > 90 ? 'text-red-600' : loan.daysOverdue > 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                          {loan.daysOverdue || 0} days
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Last Payment:</span>
                        <p className="font-medium text-gray-900">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Until Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.data.map((payment) => (
                    <tr key={`${payment.loanId}-${payment.installmentNumber}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.loanNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.borrowerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.companyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`font-medium ${payment.daysUntilDue <= 3 ? 'text-red-600' : payment.daysUntilDue <= 7 ? 'text-orange-600' : 'text-green-600'}`}>
                          {payment.daysUntilDue} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                <div key={`${payment.loanId}-${payment.installmentNumber}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                          {payment.loanNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {payment.borrowerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {payment.companyName}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${payment.daysUntilDue <= 3 ? 'text-red-600 bg-red-100' : payment.daysUntilDue <= 7 ? 'text-orange-600 bg-orange-100' : 'text-green-600 bg-green-100'}`}>
                        {payment.daysUntilDue} days
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Payment Amount:</span>
                        <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Due Date:</span>
                        <p className="font-medium text-gray-900">{formatDate(payment.dueDate)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Contact:</span>
                        <p className="font-medium text-gray-900">
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
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unsupported Report Type</h3>
            <p className="text-gray-500">This report type is not yet supported for display.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg sm:text-xl">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
            {report.title}
            <span className="text-sm text-gray-500 ml-2">
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
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportReport('excel')}
            disabled={loading}
            className="flex items-center justify-center w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-1" />
            Export Excel
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {report.data.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
              <p className="text-sm sm:text-base text-gray-500">There are no records matching the criteria for this report.</p>
            </div>
          ) : (
            renderReportContent()
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-2">
            <div className="text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
              Generated on {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="flex items-center gap-4 order-1 sm:order-2">
              <span className="text-xs sm:text-sm text-gray-500">
                Total Records: {report.data.length}
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
