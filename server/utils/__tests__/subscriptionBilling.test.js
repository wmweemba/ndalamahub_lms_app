const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  addMonthsClamped, computePeriodExtension, applyPayment
} = require('../subscriptionBilling');
const SubscriptionPayment = require('../../models/SubscriptionPayment');

const NOW = new Date('2026-10-20T10:00:00.000Z');
const iso = (d) => d.toISOString();

describe('addMonthsClamped', () => {
  it('clamps 31 Jan to end of Feb (non-leap)', () => {
    expect(iso(addMonthsClamped(new Date('2026-01-31T08:30:00Z'), 1))).toBe('2026-02-28T08:30:00.000Z');
  });
  it('clamps 31 Jan to 29 Feb in a leap year', () => {
    expect(iso(addMonthsClamped(new Date('2028-01-31T00:00:00Z'), 1))).toBe('2028-02-29T00:00:00.000Z');
  });
  it('crosses year boundaries and does not mutate input', () => {
    const input = new Date('2026-11-15T12:00:00Z');
    expect(iso(addMonthsClamped(input, 3))).toBe('2027-02-15T12:00:00.000Z');
    expect(iso(input)).toBe('2026-11-15T12:00:00.000Z');
  });
});

describe('computePeriodExtension', () => {
  it('active with future period end extends from the period end', () => {
    const sub = { status: 'active', currentPeriodEnd: new Date('2026-12-10T00:00:00Z') };
    const r = computePeriodExtension(sub, { periodMonths: 1 }, NOW);
    expect(iso(r.periodStart)).toBe('2026-12-10T00:00:00.000Z');
    expect(iso(r.periodEnd)).toBe('2027-01-10T00:00:00.000Z');
  });
  it('lapsed active extends from now', () => {
    const sub = { status: 'active', currentPeriodEnd: new Date('2026-09-01T00:00:00Z') };
    const r = computePeriodExtension(sub, { periodMonths: 2 }, NOW);
    expect(iso(r.periodStart)).toBe(iso(NOW));
    expect(iso(r.periodEnd)).toBe('2026-12-20T10:00:00.000Z');
  });
  it('trialing with future trialEndsAt extends from trialEndsAt', () => {
    const sub = { status: 'trialing', trialEndsAt: new Date('2026-10-30T00:00:00Z') };
    const r = computePeriodExtension(sub, { periodMonths: 1 }, NOW);
    expect(iso(r.periodStart)).toBe('2026-10-30T00:00:00.000Z');
    expect(iso(r.periodEnd)).toBe('2026-11-30T00:00:00.000Z');
  });
  it('trialing with expired trial extends from now', () => {
    const sub = { status: 'trialing', trialEndsAt: new Date('2026-10-01T00:00:00Z') };
    const r = computePeriodExtension(sub, { periodMonths: 1 }, NOW);
    expect(iso(r.periodStart)).toBe(iso(NOW));
  });
  it('ignores trialEndsAt when not trialing', () => {
    const sub = { status: 'active', trialEndsAt: new Date('2027-05-01T00:00:00Z') };
    const r = computePeriodExtension(sub, { periodMonths: 1 }, NOW);
    expect(iso(r.periodStart)).toBe(iso(NOW));
  });
  it('customPeriodEnd overrides the calculation', () => {
    const sub = { status: 'active', currentPeriodEnd: new Date('2026-12-10T00:00:00Z') };
    const r = computePeriodExtension(sub, { customPeriodEnd: '2027-03-01T00:00:00Z' }, NOW);
    expect(iso(r.periodStart)).toBe('2026-12-10T00:00:00.000Z');
    expect(iso(r.periodEnd)).toBe('2027-03-01T00:00:00.000Z');
  });

  describe('INVALID_PERIOD', () => {
    const sub = { status: 'active' };
    const expectInvalid = (input) => {
      let err;
      try { computePeriodExtension(sub, input, NOW); } catch (e) { err = e; }
      expect(err).toBeDefined();
      expect(err.code).toBe('INVALID_PERIOD');
    };
    it('neither given', () => {
      expectInvalid({});
      expectInvalid({ periodMonths: null, customPeriodEnd: '' });
    });
    it('both given', () => expectInvalid({ periodMonths: 1, customPeriodEnd: '2027-01-01' }));
    it('periodMonths out of range or non-integer', () => {
      expectInvalid({ periodMonths: 0 });
      expectInvalid({ periodMonths: 37 });
      expectInvalid({ periodMonths: 1.5 });
      expectInvalid({ periodMonths: -2 });
    });
    it('customPeriodEnd invalid or not in the future', () => {
      expectInvalid({ customPeriodEnd: 'not-a-date' });
      expectInvalid({ customPeriodEnd: NOW });
      expectInvalid({ customPeriodEnd: '2026-01-01' });
    });
  });
});

describe('applyPayment', () => {
  it('activates, unsets suspendedAt, keeps trialEndsAt/notes, returns previous values', () => {
    const trialEndsAt = new Date('2026-09-01T00:00:00Z');
    const prevEnd = new Date('2026-10-01T00:00:00Z');
    const company = { subscription: {
      status: 'suspended', plan: 'standard', trialEndsAt, currentPeriodEnd: prevEnd,
      suspendedAt: new Date(), notes: 'keep me'
    } };
    const periodEnd = new Date('2026-12-01T00:00:00Z');
    const r = applyPayment(company, { periodEnd, plan: 'pro' });
    expect(r).toEqual({ previousStatus: 'suspended', previousPeriodEnd: prevEnd });
    expect(company.subscription.status).toBe('active');
    expect(company.subscription.currentPeriodEnd).toBe(periodEnd);
    expect(company.subscription.suspendedAt).toBeUndefined();
    expect(company.subscription.plan).toBe('pro');
    expect(company.subscription.trialEndsAt).toBe(trialEndsAt);
    expect(company.subscription.notes).toBe('keep me');
  });
  it('leaves plan alone when not provided', () => {
    const company = { subscription: { status: 'trialing', plan: 'standard' } };
    const r = applyPayment(company, { periodEnd: new Date('2026-12-01') });
    expect(company.subscription.plan).toBe('standard');
    expect(r.previousStatus).toBe('trialing');
    expect(r.previousPeriodEnd).toBeUndefined();
  });
});

describe('SubscriptionPayment model', () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await SubscriptionPayment.init();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });
  afterEach(async () => { await SubscriptionPayment.deleteMany({}); });

  const base = () => ({
    lenderCompany: new mongoose.Types.ObjectId(),
    amount: 500, method: 'cash',
    periodStart: new Date(), periodEnd: new Date(Date.now() + 86400000),
    recordedBy: new mongoose.Types.ObjectId()
  });

  it('requires core fields and rejects bad method/amount', async () => {
    await expect(new SubscriptionPayment({}).validate()).rejects.toThrow();
    await expect(new SubscriptionPayment({ ...base(), amount: 0 }).validate()).rejects.toThrow();
    await expect(new SubscriptionPayment({ ...base(), method: 'barter' }).validate()).rejects.toThrow();
    await expect(new SubscriptionPayment(base()).validate()).resolves.toBeUndefined();
  });

  it('enforces unique non-empty reference per lender, allows blanks', async () => {
    const b = base();
    await SubscriptionPayment.create({ ...b, reference: 'REF1' });
    await expect(SubscriptionPayment.create({ ...b, reference: 'REF1' })).rejects.toThrow(/duplicate/i);
    await SubscriptionPayment.create({ ...base(), reference: 'REF1' });
    await SubscriptionPayment.create({ ...b, reference: '' });
    await SubscriptionPayment.create({ ...b, reference: '' });
    await SubscriptionPayment.create({ ...b });
    await SubscriptionPayment.create({ ...b });
  });
});
