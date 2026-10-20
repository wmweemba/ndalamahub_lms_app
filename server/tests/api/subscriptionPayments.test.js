const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const Company = require('../../models/Company');
const SubscriptionPayment = require('../../models/SubscriptionPayment');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe('Subscription payments (U3)', () => {
  let fx;
  const url = (id) => `/api/subscriptions/${id}/payments`;
  const setSub = (id, subscription) => Company.findByIdAndUpdate(id, { subscription });
  const post = async (id, body, user = fx.platformAdmin) =>
    request(app).post(url(id)).set(await authHeader(user)).send(body);

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });
  afterAll(async () => { await db.disconnect(); });

  it('extends an active lender by one month and writes a ledger row', async () => {
    const oldEnd = daysFromNow(10);
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: oldEnd });
    const res = await post(fx.lenderA._id, { amount: 500, method: 'cash', periodMonths: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Payment recorded');
    const end = new Date(res.body.data.company.subscription.currentPeriodEnd);
    expect(end.getTime()).toBeGreaterThan(oldEnd.getTime() + 27 * 24 * 3600 * 1000);
    expect(end.getTime()).toBeLessThan(oldEnd.getTime() + 32 * 24 * 3600 * 1000);
    expect(res.body.data.company.subscription.status).toBe('active');
    const row = await SubscriptionPayment.findById(res.body.data.payment._id);
    expect(new Date(row.previousPeriodEnd).getTime()).toBe(oldEnd.getTime());
    expect(row.previousStatus).toBe('active');
    expect(row.currency).toBe('ZMW');
  });

  it('accepts string periodMonths and amount', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    const res = await post(fx.lenderA._id, { amount: '100', method: 'other', periodMonths: '3' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.periodMonths).toBe(3);
  });

  it('unlocks a suspended lender', async () => {
    await setSub(fx.lenderA._id, { status: 'suspended', suspendedAt: new Date() });
    const before = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
    expect(before.status).toBe(402);
    const res = await post(fx.lenderA._id, { amount: 300, method: 'mobile_money', periodMonths: 1 });
    expect(res.status).toBe(201);
    const after = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
    expect(after.status).toBe(200);
  });

  it('extends a trialing lender from trialEndsAt', async () => {
    const trialEnd = daysFromNow(5);
    await setSub(fx.lenderB._id, { status: 'trialing', trialEndsAt: trialEnd });
    const res = await post(fx.lenderB._id, { amount: 200, method: 'bank_transfer', periodMonths: 1 });
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.payment.periodStart).getTime()).toBe(trialEnd.getTime());
    expect(res.body.data.company.subscription.status).toBe('active');
  });

  it('supports a custom end date', async () => {
    const custom = daysFromNow(45);
    const res = await post(fx.lenderA._id, { amount: 50, method: 'cash', customPeriodEnd: custom.toISOString() });
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.company.subscription.currentPeriodEnd).getTime()).toBe(custom.getTime());
    expect(res.body.data.payment.customPeriodEnd).toBe(true);
  });

  it('custom end not after current access date -> 400', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(60) });
    const res = await post(fx.lenderA._id, { amount: 10, method: 'cash', customPeriodEnd: daysFromNow(30).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/after the current access date/);
  });

  it('legacy lender with no persisted subscription.status can record a payment', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    await Company.collection.updateOne({ _id: fx.lenderA._id }, { $unset: { 'subscription.status': '' } });
    const res = await post(fx.lenderA._id, { amount: 10, method: 'cash', periodMonths: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.company.subscription.status).toBe('active');
  });

  describe('400s', () => {
    it.each([
      ['bad amount', { amount: 0, method: 'cash', periodMonths: 1 }],
      ['non-numeric amount', { amount: 'abc', method: 'cash', periodMonths: 1 }],
      ['bad method', { amount: 10, method: 'bitcoin', periodMonths: 1 }],
      ['neither period input', { amount: 10, method: 'cash' }],
      ['both period inputs', { amount: 10, method: 'cash', periodMonths: 1, customPeriodEnd: daysFromNow(10).toISOString() }],
      ['past custom date', { amount: 10, method: 'cash', customPeriodEnd: daysFromNow(-3).toISOString() }]
    ])('%s', async (_n, body) => {
      const count = await SubscriptionPayment.countDocuments({ lenderCompany: fx.lenderA._id });
      const res = await post(fx.lenderA._id, body);
      expect(res.status).toBe(400);
      expect(await SubscriptionPayment.countDocuments({ lenderCompany: fx.lenderA._id })).toBe(count);
    });

    it('non-lender company', async () => {
      const res = await post(fx.employerA._id, { amount: 10, method: 'cash', periodMonths: 1 });
      expect(res.status).toBe(400);
    });
  });

  it('duplicate reference -> 409 and period not extended twice', async () => {
    await setSub(fx.lenderB._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    const first = await post(fx.lenderB._id, { amount: 10, method: 'cash', periodMonths: 1, reference: 'REF-1' });
    expect(first.status).toBe(201);
    const endAfter = (await Company.findById(fx.lenderB._id)).subscription.currentPeriodEnd.getTime();
    const second = await post(fx.lenderB._id, { amount: 10, method: 'cash', periodMonths: 1, reference: 'REF-1' });
    expect(second.status).toBe(409);
    expect((await Company.findById(fx.lenderB._id)).subscription.currentPeriodEnd.getTime()).toBe(endAfter);
    expect(await SubscriptionPayment.countDocuments({ lenderCompany: fx.lenderB._id, reference: 'REF-1' })).toBe(1);
  });

  it('403 for lender_admin on all new routes', async () => {
    const h = await authHeader(fx.lenderAdminA);
    const id = fx.lenderA._id;
    expect((await request(app).post(url(id)).set(h).send({ amount: 1, method: 'cash', periodMonths: 1 })).status).toBe(403);
    expect((await request(app).get(url(id)).set(h)).status).toBe(403);
    expect((await request(app).get(`/api/subscriptions/${id}/audit`).set(h)).status).toBe(403);
  });

  it('404 for unknown company', async () => {
    const id = new mongoose.Types.ObjectId();
    const h = await authHeader(fx.platformAdmin);
    expect((await post(id, { amount: 1, method: 'cash', periodMonths: 1 })).status).toBe(404);
    expect((await request(app).get(url(id)).set(h)).status).toBe(404);
    expect((await request(app).get(`/api/subscriptions/${id}/audit`).set(h)).status).toBe(404);
  });

  it('GET returns payments newest first with recordedBy populated', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    await post(fx.lenderA._id, { amount: 11, method: 'cash', periodMonths: 1, note: 'older' });
    await new Promise((r) => setTimeout(r, 15));
    await post(fx.lenderA._id, { amount: 22, method: 'cash', periodMonths: 1, note: 'newer' });
    const res = await request(app).get(url(fx.lenderA._id)).set(await authHeader(fx.platformAdmin));
    expect(res.status).toBe(200);
    const { payments } = res.body.data;
    expect(payments[0].note).toBe('newer');
    expect(payments[1].note).toBe('older');
    expect(payments[0].recordedBy.username).toBe('platformadmin');
    const times = payments.map((p) => new Date(p.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('non-string reference -> 400', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    const res = await post(fx.lenderA._id, { amount: 10, method: 'cash', periodMonths: 1, reference: { $ne: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('reference must be a string');
  });

  it('concurrent change between read and update -> 409, no ledger row, no audit row', async () => {
    const BillingAuditLog = require('../../models/BillingAuditLog');
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    await SubscriptionPayment.deleteMany({ lenderCompany: fx.lenderA._id });
    await BillingAuditLog.collection.deleteMany({});
    const realCreate = SubscriptionPayment.create.bind(SubscriptionPayment);
    const spy = jest.spyOn(SubscriptionPayment, 'create').mockImplementationOnce(async (...args) => {
      await Company.updateOne({ _id: fx.lenderA._id }, { $set: { 'subscription.currentPeriodEnd': daysFromNow(99) } });
      return realCreate(...args);
    });
    const res = await post(fx.lenderA._id, { amount: 10, method: 'cash', periodMonths: 1 });
    spy.mockRestore();
    expect(res.status).toBe(409);
    expect(await SubscriptionPayment.countDocuments({ lenderCompany: fx.lenderA._id })).toBe(0);
    expect(await BillingAuditLog.countDocuments({})).toBe(0);
  });

  it('reminderSentFor cannot be written via PUT /api/companies/:id', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: daysFromNow(10) });
    const stamp = new Date('2030-01-01T00:00:00Z');
    await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.platformAdmin))
      .send({ subscription: { status: 'active', currentPeriodEnd: daysFromNow(10), reminderSentFor: stamp } });
    await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.platformAdmin))
      .send({ 'subscription.reminderSentFor': stamp });
    // lender_admin may not touch billing state at all
    await request(app).put(`/api/companies/${fx.lenderA._id}`).set(await authHeader(fx.lenderAdminA))
      .send({ subscription: { status: 'active', currentPeriodEnd: stamp, reminderSentFor: stamp } });
    const c = await Company.findById(fx.lenderA._id);
    expect(c.subscription.reminderSentFor).toBeUndefined();
    expect(new Date(c.subscription.currentPeriodEnd).getTime()).not.toBe(stamp.getTime());
  });
});
