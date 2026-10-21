const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const BILLING_KEYS = ['status', 'plan', 'trialEndsAt', 'currentPeriodEnd'];

describe('GET /api/subscriptions/status field visibility', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
    await Company.findByIdAndUpdate(fx.lenderA._id, {
      subscription: { status: 'active', plan: 'standard', currentPeriodEnd: daysFromNow(30) }
    });
  });

  afterAll(async () => {
    await db.disconnect();
  });

  const getStatus = async (user) =>
    request(app).get('/api/subscriptions/status').set(await authHeader(user));

  it.each([['lenderAdminA'], ['lenderOfficerA']])('%s gets status and dates', async (name) => {
    const res = await getStatus(fx[name]);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.plan).toBe('standard');
    expect(res.body.data.currentPeriodEnd).toBeDefined();
    expect(res.body.data.effectiveStatus).toBe('active');
  });

  it.each([['borrowerA'], ['employerHrA']])('%s gets the lock flags but no billing details', async (name) => {
    const res = await getStatus(fx[name]);
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.effectiveStatus).toBe('active');
    expect(data.locked).toBe(false);
    expect(data.readOnly).toBe(false);
    expect(data.lenderCompanyName).toBeDefined();
    BILLING_KEYS.forEach((k) => expect(data).not.toHaveProperty(k));
  });

  it('a borrower of a locked lender still sees locked: true', async () => {
    await Company.findByIdAndUpdate(fx.lenderA._id, {
      subscription: { status: 'suspended', suspendedAt: new Date() }
    });
    const res = await getStatus(fx.borrowerA);
    expect(res.status).toBe(200);
    expect(res.body.data.locked).toBe(true);
    BILLING_KEYS.forEach((k) => expect(res.body.data).not.toHaveProperty(k));
  });
});
