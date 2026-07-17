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
import { StatusPill } from '@/components/ui/status-pill';
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
          <div className="h-8 w-8 rounded-full border-2 border-border border-t-foreground animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Raise and track support tickets</p>
        </div>
        <Button onClick={() => setNewTicketOpen(true)}>New ticket</Button>
      </div>

      {error && (
        <div className="mb-6 bg-status-danger-bg text-status-danger-fg rounded-2xl px-4 py-3 text-sm">
          Failed to load tickets
        </div>
      )}

      {(!data || data.length === 0) ? (
        <Card className="p-8 text-center rounded-2xl">
          <h3 className="text-base font-medium text-foreground mb-2">No tickets found</h3>
          <p className="text-sm text-muted-foreground">Raise a new ticket to get help.</p>
        </Card>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="border-b border-border last:border-0 hover:bg-muted cursor-pointer"
                    onClick={() => setDetailTicketId(ticket._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-foreground">{ticket.ticketNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{ticket.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusPill status={ticket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
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

              <Card className="rounded-2xl">
                <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                  {detailTicket.messages.map((m) => (
                    <div key={m._id} className="border-b border-border pb-2 last:border-b-0">
                      <div className="text-xs text-muted-foreground">
                        {m.author.name} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm text-foreground">{m.body}</div>
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
