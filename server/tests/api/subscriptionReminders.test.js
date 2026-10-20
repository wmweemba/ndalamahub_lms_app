jest.mock('../../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue({ sent: true }) }));

const Company = require('../../models/Company');
const BillingAuditLog = require('../../models/BillingAuditLog');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { sendEmail } = require('../../utils/email');
const expireSubscriptions = require('../../jobs/expireSubscriptions');

const DAY = 24 * 60 * 60 * 1000;
const at = (base, n) => new Date(base.getTime() + n * DAY);

describe('Subscription reminders and transition audit (U4)', () => {
  let fx;
  const asOf = new Date('2026-11-10T08:00:00Z');

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  const setSub = (id, subscription) => Company.findByIdAndUpdate(id, { subscription });
  const getSub = async () => (await Company.findById(fx.lenderA._id)).subscription;

  beforeEach(async () => {
    jest.clearAllMocks();
    await BillingAuditLog.collection.deleteMany({});
    await setSub(fx.lenderB._id, { status: 'cancelled' });
    await setSub(fx.lenderA._id, { status: 'cancelled' });
  });

  it('active lender 5 days out gets one reminder, a stamp, and no audit row; rerun is idempotent', async () => {
    const end = at(asOf, 5);
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: end });

    const result = await expireSubscriptions(asOf);
    expect(result.renewalReminders).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe(fx.lenderAdminA.email);
    expect(mail.subject).toBe(`Lender A: your NdalamaHub subscription renews on ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lusaka' })}`);
    expect((await getSub()).reminderSentFor.getTime()).toBe(end.getTime());
    expect(await BillingAuditLog.countDocuments({})).toBe(0);

    sendEmail.mockClear();
    const again = await expireSubscriptions(asOf);
    expect(again.renewalReminders).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('re-arms after the period is extended', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: at(asOf, 5) });
    await expireSubscriptions(asOf);
    sendEmail.mockClear();

    const newEnd = at(asOf, 35);
    await Company.findByIdAndUpdate(fx.lenderA._id, { 'subscription.currentPeriodEnd': newEnd });
    const later = at(asOf, 30);
    const result = await expireSubscriptions(later);
    expect(result.renewalReminders).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((await getSub()).reminderSentFor.getTime()).toBe(newEnd.getTime());
  });

  it('10 days out sends nothing', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: at(asOf, 10) });
    const result = await expireSubscriptions(asOf);
    expect(result.renewalReminders).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('trialing 3 days out gets trial_ending', async () => {
    await setSub(fx.lenderA._id, { status: 'trialing', trialEndsAt: at(asOf, 3) });
    const result = await expireSubscriptions(asOf);
    expect(result.renewalReminders).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/your NdalamaHub trial ends on/);
  });

  it('suspended and past_due lenders get no reminder', async () => {
    await setSub(fx.lenderA._id, { status: 'suspended', currentPeriodEnd: at(asOf, 3), suspendedAt: asOf });
    expect((await expireSubscriptions(asOf)).renewalReminders).toBe(0);
    await setSub(fx.lenderA._id, { status: 'past_due', currentPeriodEnd: at(asOf, 3) });
    expect((await expireSubscriptions(asOf)).renewalReminders).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('existing transitions keep their counts', async () => {
    await setSub(fx.lenderA._id, { status: 'trialing', trialEndsAt: at(asOf, -1) });
    await setSub(fx.lenderB._id, { status: 'past_due', currentPeriodEnd: at(asOf, -10) });
    const result = await expireSubscriptions(asOf);
    expect(result).toEqual({
      trialToPastDue: 1, activeToPastDue: 0, pastDueToReadOnly: 1, readOnlyToSuspended: 0, renewalReminders: 0
    });
  });

  it('active -> past_due writes one system audit row and no reminder; second sweep writes none', async () => {
    await setSub(fx.lenderA._id, { status: 'active', currentPeriodEnd: at(asOf, -1) });
    const result = await expireSubscriptions(asOf);
    expect(result.activeToPastDue).toBe(1);
    expect(result.renewalReminders).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const rows = await BillingAuditLog.find({});
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('subscription.status_changed');
    expect(rows[0].source).toBe('system');
    expect(rows[0].performedBy).toBeNull();
    expect(rows[0].meta.kind).toBe('renewal_due');
    expect(rows[0].changedFields).toContain('status');

    await expireSubscriptions(asOf);
    expect(await BillingAuditLog.countDocuments({})).toBe(1);
  });
});
