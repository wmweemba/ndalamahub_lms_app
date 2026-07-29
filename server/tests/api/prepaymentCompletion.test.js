const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants, PASSWORD } = require('../helpers/fixtures');

// Phase 27 follow-up: POST /:id/prepayment recorded the extra payment and
// recalculated the schedule, but never checked whether the remaining balance
// had actually reached zero — a prepayment covering the full balance left
// the loan stuck 'active' with an empty schedule and no further action
// available (found live in production, 2026-07-29).
describe('POST /api/loans/:id/prepayment completion (Phase 27 follow-up)', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('marks the loan completed when a prepayment covers the full remaining balance', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminA.username, password: PASSWORD });

    const res = await agent
      .post(`/api/loans/${fx.loanA._id}/prepayment`)
      .send({ amount: fx.loanA.totalAmount, allocationStrategy: 'reduce_term' });

    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe('completed');
  });

  it('leaves the loan active when a partial prepayment does not cover the full balance', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminB.username, password: PASSWORD });

    const res = await agent
      .post(`/api/loans/${fx.loanB._id}/prepayment`)
      .send({ amount: 100, allocationStrategy: 'reduce_term' });

    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe('active');
  });
});
