const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Company = require('../models/Company');
const { authenticateToken } = require('../middleware/auth');
const {
  isPlatformAdmin,
  isLenderSide,
  isEmployerSide,
  idsEqual,
  canReadLoan,
  companyLenderId
} = require('../utils/tenantScope');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const { sendTelegramMessage } = require('../utils/telegram');

/** Mongo filter limiting a Ticket query to what the caller may see. */
function ticketScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) {
    return { $or: [{ createdBy: user.id }, { company: user.company }, { handlerCompany: user.company }] };
  }
  if (isEmployerSide(user)) {
    return { $or: [{ createdBy: user.id }, { company: user.company }] };
  }
  return { createdBy: user.id }; // borrower
}

/** Document-level read access to a single ticket. */
function canReadTicket(user, ticket) {
  if (isPlatformAdmin(user)) return true;
  if (idsEqual(ticket.createdBy, user.id)) return true;
  if (isLenderSide(user)) {
    return idsEqual(ticket.company, user.company) || idsEqual(ticket.handlerCompany, user.company);
  }
  if (isEmployerSide(user)) return idsEqual(ticket.company, user.company);
  return false;
}

/** Whether the caller is on the handling side for this ticket
 * (lender staff for lender-handled tickets, platform_admin for platform-level). */
function isHandler(user, ticket) {
  if (isPlatformAdmin(user)) return true;
  if (!ticket.handlerCompany) return false;
  return isLenderSide(user) && idsEqual(ticket.handlerCompany, user.company);
}

const populateOpts = [
  { path: 'createdBy', select: 'firstName lastName email' },
  { path: 'assignedTo', select: 'firstName lastName email' },
  { path: 'messages.author', select: 'firstName lastName' }
];

/**
 * Resolve who should be notified about a new message: the creator if a
 * handler wrote, or the assignee (falling back to a handler-side user,
 * since ticket.handlerCompany is a company, not a person) if the creator wrote.
 */
async function counterpartyForMessage(user, ticket) {
  if (isHandler(user, ticket)) {
    return ticket.createdBy || null;
  }
  if (ticket.assignedTo) return ticket.assignedTo;
  if (ticket.handlerCompany) {
    return User.findOne({ company: ticket.handlerCompany, role: { $in: ['lender_admin', 'lender_officer'] } }).select('firstName lastName email');
  }
  return User.findOne({ role: 'platform_admin' }).select('firstName lastName email');
}

const displayName = (u) => (u ? `${u.firstName} ${u.lastName}` : 'Deleted user');

const serializeTicket = (ticket) => ({
  _id: ticket._id,
  ticketNumber: ticket.ticketNumber,
  subject: ticket.subject,
  category: ticket.category,
  priority: ticket.priority,
  status: ticket.status,
  company: ticket.company,
  handlerCompany: ticket.handlerCompany,
  relatedLoan: ticket.relatedLoan,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  createdBy: { _id: ticket.createdBy?._id, name: displayName(ticket.createdBy) },
  assignedTo: ticket.assignedTo ? { _id: ticket.assignedTo._id, name: displayName(ticket.assignedTo) } : null,
  messages: ticket.messages.map((m) => ({
    _id: m._id,
    body: m.body,
    createdAt: m.createdAt,
    author: { _id: m.author?._id, name: displayName(m.author) }
  }))
});

// @route   POST /api/tickets
// @desc    Raise a new support ticket
// @access  Private (any authenticated user)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { subject, category, priority, relatedLoan, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    if (relatedLoan) {
      const loan = await Loan.findById(relatedLoan);
      if (!loan) {
        return res.status(404).json({ success: false, message: 'Related loan not found' });
      }
      if (!canReadLoan(req.user, loan)) {
        return res.status(403).json({ success: false, message: 'Access denied to related loan' });
      }
    }

    const handlerCompany = isLenderSide(req.user)
      ? null
      : await companyLenderId(req.user.company);

    const ticket = new Ticket({
      subject: subject.trim(),
      category,
      priority,
      relatedLoan: relatedLoan || undefined,
      createdBy: req.user.id,
      company: req.user.company,
      handlerCompany,
      messages: [{ author: req.user.id, body: message.trim() }]
    });

    await ticket.save();
    await ticket.populate(populateOpts);

    {
      const company = await Company.findById(req.user.company).select('name');
      const creatorName = displayName(ticket.createdBy);
      const companyName = company ? company.name : 'Unknown company';

      if (process.env.OWNER_ALERT_EMAIL) {
        void sendEmail({
          to: process.env.OWNER_ALERT_EMAIL,
          ...emailTemplates.ticketCreated({
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority,
            creatorName,
            companyName
          })
        });
      }
      void sendTelegramMessage(`New ticket ${ticket.ticketNumber} [${ticket.priority}] from ${creatorName} (${companyName}): ${ticket.subject}`);
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket: serializeTicket(ticket) }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/tickets
// @desc    List tickets visible to the caller
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = ticketScopeFilter(req.user);
    const finalFilter = status ? { $and: [filter, { status }] } : filter;

    const tickets = await Ticket.find(finalFilter)
      .populate(populateOpts)
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Ticket.countDocuments(finalFilter);

    res.json({
      success: true,
      data: {
        tickets: tickets.map(serializeTicket),
        pagination: { page: Number(page), limit: Number(limit), total }
      }
    });
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tickets',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get a single ticket with full thread
// @access  Private (visible tickets only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate(populateOpts);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (!canReadTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
    }

    res.json({ success: true, data: { ticket: serializeTicket(ticket) } });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/tickets/:id/messages
// @desc    Append a message to a ticket's thread
// @access  Private (visible tickets only)
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (!canReadTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'Access denied to this ticket' });
    }

    ticket.messages.push({ author: req.user.id, body: body.trim() });

    if (ticket.status === 'resolved' && idsEqual(ticket.createdBy, req.user.id)) {
      ticket.status = 'in_progress';
    }

    await ticket.save();
    await ticket.populate(populateOpts);

    const recipient = await counterpartyForMessage(req.user, ticket);
    if (recipient && recipient.email) {
      void sendEmail({ to: recipient.email, ...emailTemplates.ticketUpdate(recipient, ticket, body.trim()) });
    }

    res.status(201).json({ success: true, message: 'Message added', data: { ticket: serializeTicket(ticket) } });
  } catch (error) {
    console.error('Add ticket message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/tickets/:id/status
// @desc    Transition a ticket's status
// @access  Private (handler side only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (!isHandler(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'Access denied: handler side only' });
    }

    if (ticket.status === 'closed' && status !== 'closed' && !isPlatformAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only platform_admin may reopen a closed ticket' });
    }

    ticket.status = status;
    await ticket.save();
    await ticket.populate(populateOpts);

    if (ticket.createdBy && ticket.createdBy.email) {
      void sendEmail({ to: ticket.createdBy.email, ...emailTemplates.ticketUpdate(ticket.createdBy, ticket, null) });
    }

    res.json({ success: true, message: 'Ticket status updated', data: { ticket: serializeTicket(ticket) } });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/tickets/:id/assign
// @desc    Assign a ticket to a handler-side user
// @access  Private (handler side only)
router.put('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'assignedTo is required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (!isHandler(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'Access denied: handler side only' });
    }

    const targetUser = await User.findById(assignedTo);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Assignee not found' });
    }

    const validAssignee = ticket.handlerCompany
      ? idsEqual(targetUser.company, ticket.handlerCompany)
      : targetUser.role === 'platform_admin';

    if (!validAssignee) {
      return res.status(400).json({ success: false, message: 'Assignee must belong to the handling company' });
    }

    ticket.assignedTo = targetUser._id;
    await ticket.save();
    await ticket.populate(populateOpts);

    res.json({ success: true, message: 'Ticket assigned', data: { ticket: serializeTicket(ticket) } });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
