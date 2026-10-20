const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

// Hotfix 2026-10-20: a lender_admin must not be able to rewrite its own
// subscription (e.g. push currentPeriodEnd forward) via PUT /api/companies/:id.
describe('PUT /api/companies/:id cannot touch billing state for lender_admin', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('ignores a nested subscription object and dotted subscription keys', async () => {
    const before = (await Company.findById(fx.lenderA._id)).toObject().subscription || {};
    const farFuture = new Date('2099-01-01T00:00:00Z');

    const res1 = await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.lenderAdminA))
      .send({ description: 'still editable', subscription: { status: 'active', currentPeriodEnd: farFuture } });
    expect(res1.status).toBe(200);
    const res2 = await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.lenderAdminA))
      .send({ 'subscription.status': 'active', 'subscription.currentPeriodEnd': farFuture });
    expect(res2.status).toBe(200);

    const after = await Company.findById(fx.lenderA._id);
    expect(after.description).toBe('still editable');
    expect(after.subscription?.status).toBe(before.status);
    expect(after.subscription?.currentPeriodEnd?.getTime?.()).toBe(before.currentPeriodEnd?.getTime?.());
  });

  it('also strips subscription changes from platform_admin (billing goes through /api/subscriptions)', async () => {
    const before = (await Company.findById(fx.lenderA._id)).toObject().subscription || {};
    const farFuture = new Date('2099-01-01T00:00:00Z');
    const res1 = await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.platformAdmin))
      .send({ description: 'by platform', subscription: { status: 'active', currentPeriodEnd: farFuture } });
    expect(res1.status).toBe(200);
    const res2 = await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.platformAdmin))
      .send({ 'subscription.status': 'active', 'subscription.currentPeriodEnd': farFuture });
    expect(res2.status).toBe(200);
    const after = await Company.findById(fx.lenderA._id);
    expect(after.description).toBe('by platform');
    expect(after.subscription?.status).toBe(before.status);
    expect(after.subscription?.currentPeriodEnd?.getTime?.()).toBe(before.currentPeriodEnd?.getTime?.());
  });
});
