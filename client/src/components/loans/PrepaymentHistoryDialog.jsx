import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/utils/api';
import { History, TrendingDown, Clock, CheckCircle } from 'lucide-react';

export function PrepaymentHistoryDialog({ loan, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);

  const formatCurrency = (value) => {
    return `ZMW ${parseFloat(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (open && loan) {
      fetchHistory();
    }
  }, [open, loan]);

  const fetchHistory = async () => {
    if (!loan) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/loans/${loan._id}/prepayment-history`);
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching prepayment history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Prepayment History
          </DialogTitle>
          <DialogDescription>
            All prepayments and early settlement for {loan.loanNumber}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading prepayment history...</p>
          </div>
        ) : history ? (
          <div className="space-y-6">
            {/* Summary Card */}
            {history.summary && history.summary.totalPrepayments > 0 && (
              <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Prepayments</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {history.summary.totalPrepayments}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(history.summary.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Principal Paid</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(history.summary.totalPrincipal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Interest Paid</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCurrency(history.summary.totalInterest)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Early Settlement Info */}
            {history.earlySettlement && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    Early Settlement Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Settlement Date</p>
                      <p className="font-semibold">{formatDate(history.earlySettlement.date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Settlement Amount</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(history.earlySettlement.amount)}
                      </p>
                    </div>
                    {history.earlySettlement.savingsRealized > 0 && (
                      <div>
                        <p className="text-sm text-gray-600">Interest Saved</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(history.earlySettlement.savingsRealized)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prepayments List */}
            {history.prepayments && history.prepayments.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Payment History</h3>
                {history.prepayments.map((prepayment, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              {prepayment.allocationStrategy === 'reduce_term' ? (
                                <Clock className="h-5 w-5 text-purple-600" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-lg">
                                {formatCurrency(prepayment.amount)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDate(prepayment.date)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="pl-13 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-green-50">
                                Principal: {formatCurrency(prepayment.principalPortion)}
                              </Badge>
                              {prepayment.interestPortion > 0 && (
                                <Badge variant="outline" className="bg-blue-50">
                                  Interest: {formatCurrency(prepayment.interestPortion)}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={prepayment.allocationStrategy === 'reduce_term' ? 'default' : 'secondary'}
                              >
                                {prepayment.allocationStrategy === 'reduce_term' 
                                  ? 'Reduced Term' 
                                  : 'Reduced Payment'}
                              </Badge>
                            </div>
                            
                            {prepayment.notes && (
                              <p className="text-sm text-gray-600 italic mt-2">
                                Note: {prepayment.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {prepayment.recordedBy && (
                          <div className="text-sm text-gray-500 md:text-right">
                            <p>Recorded by</p>
                            <p className="font-medium">
                              {prepayment.recordedBy.firstName} {prepayment.recordedBy.lastName}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No prepayments recorded yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
