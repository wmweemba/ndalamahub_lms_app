import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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

const CATEGORIES = [
  { value: 'loan_inquiry', label: 'Loan Inquiry' },
  { value: 'repayment_issue', label: 'Repayment Issue' },
  { value: 'account_access', label: 'Account Access' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
];

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const HANDLER_ROLES = ['lender_admin', 'lender_officer', 'platform_admin'];

const statusBadgeColor = (status) => {
  const colors = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export function SupportPage() {
  const currentUser = getCurrentUser();
  const isHandler = HANDLER_ROLES.includes(currentUser?.role);
  const queryClient = useQueryClient();

  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newMessage, setNewMessage] = useState('');

  const [detailTicketId, setDetailTicketId] = useState(null);
  const [replyBody, setReplyBody] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const res = await api.get('/tickets');
      return res.data.data.tickets;
    },
  });

  const { data: detailTicket } = useQuery({
    queryKey: ['tickets', detailTicketId],
    queryFn: async () => {
      const res = await api.get(`/tickets/${detailTicketId}`);
      return res.data.data.ticket;
    },
    enabled: !!detailTicketId,
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      const res = await api.post('/tickets', {
        subject: newSubject,
        category: newCategory,
        message: newMessage,
      });
      return res.data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setNewTicketOpen(false);
      setNewSubject('');
      setNewCategory('other');
      setNewMessage('');
    },
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/tickets/${detailTicketId}/messages`, { body: replyBody });
      return res.data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', detailTicketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setReplyBody('');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status) => {
      const res = await api.put(`/tickets/${detailTicketId}/status`, { status });
      return res.data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', detailTicketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="mt-1 text-sm text-gray-600">Raise and track support tickets</p>
        </div>
        <Button onClick={() => setNewTicketOpen(true)}>New ticket</Button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Failed to load tickets
        </div>
      )}

      {(!data || data.length === 0) ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
          <p className="mt-1 text-sm text-gray-500">Raise a new ticket to get help.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDetailTicketId(ticket._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ticket.ticketNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ticket.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={statusBadgeColor(ticket.status)}>{ticket.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New ticket dialog */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" rows={4} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!newSubject.trim() || !newMessage.trim() || createTicket.isPending}
              onClick={() => createTicket.mutate()}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket detail dialog */}
      <Dialog open={!!detailTicketId} onOpenChange={(open) => !open && setDetailTicketId(null)}>
        <DialogContent>
          {detailTicket && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTicket.ticketNumber} — {detailTicket.subject}</DialogTitle>
              </DialogHeader>

              {isHandler && (
                <div className="mb-4">
                  <Label htmlFor="status">Status</Label>
                  <Select value={detailTicket.status} onValueChange={(status) => updateStatus.mutate(status)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Card>
                <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                  {detailTicket.messages.map((m) => (
                    <div key={m._id} className="border-b border-gray-100 pb-2 last:border-b-0">
                      <div className="text-xs text-gray-500">
                        {m.author.name} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-900">{m.body}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="mt-4 space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Write a reply..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={!replyBody.trim() || sendReply.isPending}
                    onClick={() => sendReply.mutate()}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupportPage;
