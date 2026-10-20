const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const BillingAuditLog = require('../../models/BillingAuditLog');
const SubscriptionPayment = require('../../models/SubscriptionPayment');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('Billing audit (U3)', () => {
  let fx;
  const put = async (id, body) =>
    request(app).put(`/api/subscriptions/${id}`).set(await authHeader(fx.platformAdmin)).send(body);
  const post = async (id, body) =>
    request(app).post(`/api/subscriptions/${id}/payments`).set(await authHeader(fx.platformAdmin)).send(body);
  const count = (id) => BillingAuditLog.countDocuments({ lenderCompany: id });

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
    await Company.findByIdAndUpdate(fx.lenderA._id, { subscription: { status: 'active', currentPeriodEnd: daysFromNow(20) } });
  });
  afterAll(async () => { await db.disconnect(); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('PUT that changes status writes one adjusted row', async () => {
    const res = await put(fx.lenderA._id, { status: 'past_due' });
    expect(res.status).toBe(200);
    const rows = await BillingAuditLog.find({ lenderCompany: fx.lenderA._id, action: 'subscription.adjusted' });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].performedBy)).toBe(String(fx.platformAdmin._id));
    expect(rows[0].source).toBe('admin');
    expect(rows[0].changedFields).toContain('status');
  });

  it('PUT that changes nothing writes no row', async () => {
    const before = await count(fx.lenderA._id);
    const res = await put(fx.lenderA._id, { status: 'past_due' });
    expect(res.status).toBe(200);
    expect(await count(fx.lenderA._id)).toBe(before);
  });

  it('recorded payment writes one row matching the ledger', async () => {
    const res = await post(fx.lenderA._id, { amount: 99, method: 'cash', periodMonths: 1, reference: 'A-1' });
    expect(res.status).toBe(201);
    const rows = await BillingAuditLog.find({ lenderCompany: fx.lenderA._id, action: 'subscription.payment_recorded' });
    expect(rows).toHaveLength(1);
    expect(String(rows[0].meta.paymentId)).toBe(res.body.data.payment._id);
    expect(rows[0].meta.amount).toBe(99);
    expect(rows[0].meta.reference).toBe('A-1');
    expect(rows[0].changedFields).toContain('status');
  });

  it('rejected payments write no audit row', async () => {
    const before = await count(fx.lenderA._id);
    expect((await post(fx.lenderA._id, { amount: -1, method: 'cash', periodMonths: 1 })).status).toBe(400);
    expect((await post(fx.lenderA._id, { amount: 99, method: 'cash', periodMonths: 1, reference: 'A-1' })).status).toBe(409);
    expect(await count(fx.lenderA._id)).toBe(before);
  });

  it('audit write failure does not fail PUT or POST', async () => {
    const spy = jest.spyOn(BillingAuditLog, 'create').mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const p = await put(fx.lenderA._id, { status: 'read_only' });
    expect(p.status).toBe(200);
    const r = await post(fx.lenderA._id, { amount: 5, method: 'cash', periodMonths: 1, reference: 'A-2' });
    expect(r.status).toBe(201);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await SubscriptionPayment.countDocuments({ reference: 'A-2' })).toBe(1);
  });

  it('GET /audit returns newest first; lender_admin 403', async () => {
    const res = await request(app).get(`/api/subscriptions/${fx.lenderA._id}/audit`).set(await authHeader(fx.platformAdmin));
    expect(res.status).toBe(200);
    const { entries } = res.body.data;
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const times = entries.map((e) => new Date(e.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(entries[0].performedBy.username).toBe('platformadmin');
    const denied = await request(app).get(`/api/subscriptions/${fx.lenderA._id}/audit`).set(await authHeader(fx.lenderAdminA));
    expect(denied.status).toBe(403);
  });
});
