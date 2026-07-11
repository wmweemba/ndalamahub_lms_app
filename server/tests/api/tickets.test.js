const request = require('supertest');
const app = require('../../app');
const Ticket = require('../../models/Ticket');
const db = require('../helpers/db');
const { seedTwoTenants, createUser } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('Support tickets (Phase 08)', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('POST /api/tickets — routing', () => {
    it('borrower-created ticket routes to their lender as handlerCompany', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set(authHeader(fx.borrowerA))
        .send({ subject: 'Cannot see my schedule', category: 'technical', message: 'Help please' });

      expect(res.status).toBe(201);
      expect(res.body.data.ticket.ticketNumber).toMatch(/^TK\d{4}\d{4}$/);

      const ticket = await Ticket.findById(res.body.data.ticket._id);
      expect(ticket.company.toString()).toBe(fx.employerA._id.toString());
      expect(ticket.handlerCompany.toString()).toBe(fx.lenderA._id.toString());
    });

    it('lender_admin-created ticket has null handlerCompany (platform-level)', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set(authHeader(fx.lenderAdminA))
        .send({ subject: 'Need a platform feature', category: 'other', message: 'Please add X' });

      expect(res.status).toBe(201);

      const ticket = await Ticket.findById(res.body.data.ticket._id);
      expect(ticket.company.toString()).toBe(fx.lenderA._id.toString());
      expect(ticket.handlerCompany).toBeNull();
    });

    it('generates unique ticketNumbers across two rapid creates', async () => {
      const [r1, r2] = await Promise.all([
        request(app).post('/api/tickets').set(authHeader(fx.borrowerA)).send({ subject: 'A', message: 'msg a' }),
        request(app).post('/api/tickets').set(authHeader(fx.borrowerB)).send({ subject: 'B', message: 'msg b' })
      ]);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r1.body.data.ticket.ticketNumber).not.toBe(r2.body.data.ticket.ticketNumber);
    });
  });

  describe('Visibility matrix', () => {
    let borrowerATicket;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set(authHeader(fx.borrowerA))
        .send({ subject: 'Visibility test', category: 'account_access', message: 'Locked out' });
      borrowerATicket = res.body.data.ticket;
    });

    it('a colleague borrower cannot see another borrower\'s ticket', async () => {
      const otherBorrowerA = await createUser({ username: 'borrowera2', role: 'borrower', company: fx.employerA._id, department: 'Operations' });
      const res = await request(app)
        .get(`/api/tickets/${borrowerATicket._id}`)
        .set(authHeader(otherBorrowerA));

      expect(res.status).toBe(403);
    });

    it('employer_hr in the same company can see it', async () => {
      const res = await request(app)
        .get(`/api/tickets/${borrowerATicket._id}`)
        .set(authHeader(fx.employerHrA));

      expect(res.status).toBe(200);
    });

    it('the other lender\'s admin cannot see it', async () => {
      const res = await request(app)
        .get(`/api/tickets/${borrowerATicket._id}`)
        .set(authHeader(fx.lenderAdminB));

      expect(res.status).toBe(403);
    });

    it('the handling lender\'s admin (lenderAdminA) can see it', async () => {
      const res = await request(app)
        .get(`/api/tickets/${borrowerATicket._id}`)
        .set(authHeader(fx.lenderAdminA));

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/tickets/:id/status — handler-only', () => {
    let ticket;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set(authHeader(fx.borrowerA))
        .send({ subject: 'Status test', message: 'issue' });
      ticket = res.body.data.ticket;
    });

    it('denied to the ticket creator (borrower)', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticket._id}/status`)
        .set(authHeader(fx.borrowerA))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
    });

    it('allowed to the handling lender\'s admin', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticket._id}/status`)
        .set(authHeader(fx.lenderAdminA))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe('in_progress');
    });
  });

  describe('POST /api/tickets/:id/messages — reopen on reply', () => {
    it('a creator reply reopens a resolved ticket to in_progress', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set(authHeader(fx.borrowerA))
        .send({ subject: 'Reopen test', message: 'issue' });
      const ticketId = createRes.body.data.ticket._id;

      const resolveRes = await request(app)
        .put(`/api/tickets/${ticketId}/status`)
        .set(authHeader(fx.lenderAdminA))
        .send({ status: 'resolved' });
      expect(resolveRes.body.data.ticket.status).toBe('resolved');

      const replyRes = await request(app)
        .post(`/api/tickets/${ticketId}/messages`)
        .set(authHeader(fx.borrowerA))
        .send({ body: 'Actually still broken' });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body.data.ticket.status).toBe('in_progress');
    });
  });
});
