const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');
const expireSubscriptions = require('../../jobs/expireSubscriptions');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('Subscription gate (Phase 10)', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  const setSub = async (companyId, subscription) => {
    await Company.findByIdAndUpdate(companyId, { subscription });
  };

  describe('suspended lender', () => {
    beforeAll(async () => {
      await setSub(fx.lenderA._id, { status: 'suspended', suspendedAt: new Date() });
    });

    it('lender_admin gets 402 on GET /api/loans', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('SUBSCRIPTION_LOCKED');
    });

    it('lender_admin still gets 200 on GET /api/tickets', async () => {
      const res = await request(app).get('/api/tickets').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
    });

    it('lender_admin can still log in via POST /api/auth/login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'lenderadmina', password: 'Test123!' });
      expect(res.status).toBe(200);
    });

    it('a borrower under that lender also 402s on loans (inheritance)', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.borrowerA));
      expect(res.status).toBe(402);
    });

    it('a second, active lender is unaffected', async () => {
      await setSub(fx.lenderB._id, { status: 'active', currentPeriodEnd: daysFromNow(30) });
      const res = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminB));
      expect(res.status).toBe(200);
    });

    it('platform_admin is never gated', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.platformAdmin));
      expect(res.status).toBe(200);
    });
  });

  describe('trialing past trialEndsAt locks even before the sweep runs', () => {
    it('computes the effective status live — a stale trialing doc past its date is treated as suspended once past the full staircase', async () => {
      await setSub(fx.lenderA._id, { status: 'trialing', trialEndsAt: daysAgo(20) });
      const res = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(402);
    });

    it('within the 7-day grace window, access is still full (past_due, not locked)', async () => {
      await setSub(fx.lenderA._id, { status: 'trialing', trialEndsAt: daysAgo(3) });
      const res = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
    });

    it('within the read-only window (8-14 days past), GET succeeds but a write is blocked', async () => {
      await setSub(fx.lenderA._id, { status: 'trialing', trialEndsAt: daysAgo(10) });

      const getRes = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
      expect(getRes.status).toBe(200);

      const writeRes = await request(app)
        .put(`/api/loans/${fx.loanA._id}/approve`)
        .set(await authHeader(fx.lenderAdminA))
        .send({});
      expect(writeRes.status).toBe(402);
    });
  });

  describe('expireSubscriptions sweep', () => {
    it('transitions trialing -> past_due, past_due -> read_only, read_only -> suspended, active -> past_due, and is idempotent', async () => {
      const trialLapsed = await Company.create({
        name: 'Sweep Trial Lapsed',
        type: 'lender',
        registrationNumber: 'SWEEP-1',
        address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
        contactInfo: { phone: '+260970000009', email: 'sweep1@example.com' },
        subscription: { status: 'trialing', trialEndsAt: daysAgo(1) }
      });
      const graceLapsed = await Company.create({
        name: 'Sweep Grace Lapsed',
        type: 'lender',
        registrationNumber: 'SWEEP-2',
        address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
        contactInfo: { phone: '+260970000009', email: 'sweep2@example.com' },
        subscription: { status: 'past_due', currentPeriodEnd: daysAgo(8) }
      });
      const readOnlyLapsed = await Company.create({
        name: 'Sweep Read Only Lapsed',
        type: 'lender',
        registrationNumber: 'SWEEP-3',
        address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
        contactInfo: { phone: '+260970000009', email: 'sweep3@example.com' },
        subscription: { status: 'read_only', currentPeriodEnd: daysAgo(15) }
      });
      const activeLapsed = await Company.create({
        name: 'Sweep Active Lapsed',
        type: 'lender',
        registrationNumber: 'SWEEP-4',
        address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
        contactInfo: { phone: '+260970000009', email: 'sweep4@example.com' },
        subscription: { status: 'active', currentPeriodEnd: daysAgo(1) }
      });

      const result = await expireSubscriptions();
      expect(result.trialToPastDue).toBeGreaterThanOrEqual(1);
      expect(result.pastDueToReadOnly).toBeGreaterThanOrEqual(1);
      expect(result.readOnlyToSuspended).toBeGreaterThanOrEqual(1);
      expect(result.activeToPastDue).toBeGreaterThanOrEqual(1);

      expect((await Company.findById(trialLapsed._id)).subscription.status).toBe('past_due');
      expect((await Company.findById(graceLapsed._id)).subscription.status).toBe('read_only');
      expect((await Company.findById(readOnlyLapsed._id)).subscription.status).toBe('suspended');
      expect((await Company.findById(activeLapsed._id)).subscription.status).toBe('past_due');

      // idempotent — none of the just-transitioned docs move again on a second run
      const second = await expireSubscriptions();
      expect((await Company.findById(trialLapsed._id)).subscription.status).toBe('past_due');
      expect((await Company.findById(graceLapsed._id)).subscription.status).toBe('read_only');
      expect((await Company.findById(readOnlyLapsed._id)).subscription.status).toBe('suspended');
      expect((await Company.findById(activeLapsed._id)).subscription.status).toBe('past_due');
      expect(second.readOnlyToSuspended).toBe(0);
    });
  });
});
