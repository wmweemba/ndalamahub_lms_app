const mongoose = require('mongoose');
const db = require('../../tests/helpers/db');
const BillingAuditLog = require('../../models/BillingAuditLog');
const { snapshotSubscription, diffSnapshots, logBillingChange } = require('../billingAudit');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clear);

describe('billingAudit', () => {
  test('snapshot picks exactly the six fields', () => {
    const s = snapshotSubscription({ status: 'active', plan: 'standard', extra: 1, _id: 'x' });
    expect(Object.keys(s).sort()).toEqual(
      ['currentPeriodEnd', 'notes', 'plan', 'status', 'suspendedAt', 'trialEndsAt']
    );
    expect(s.notes).toBeNull();
    expect(Object.keys(snapshotSubscription(undefined))).toHaveLength(6);
  });

  test('diff detects date change and ignores equal dates', () => {
    const a = snapshotSubscription({ status: 'active', currentPeriodEnd: new Date('2026-01-01') });
    const same = snapshotSubscription({ status: 'active', currentPeriodEnd: new Date('2026-01-01') });
    const moved = snapshotSubscription({ status: 'active', currentPeriodEnd: new Date('2026-02-01') });
    expect(diffSnapshots(a, same)).toEqual([]);
    expect(diffSnapshots(a, moved)).toEqual(['currentPeriodEnd']);
  });

  test("treats '' notes the same as unset", () => {
    const a = snapshotSubscription({ status: 'active', notes: '' });
    const b = snapshotSubscription({ status: 'active' });
    expect(a.notes).toBeNull();
    expect(diffSnapshots(a, b)).toEqual([]);
    expect(diffSnapshots({ notes: '' }, { notes: null })).toEqual([]);
    expect(diffSnapshots({ notes: '' }, { notes: 'x' })).toEqual(['notes']);
  });

  test('creates a row with correct changedFields', async () => {
    const id = new mongoose.Types.ObjectId();
    const row = await logBillingChange({
      companyId: id,
      action: 'subscription.adjusted',
      source: 'admin',
      before: { status: 'trialing' },
      after: { status: 'active', plan: 'pro' }
    });
    expect([...row.changedFields].sort()).toEqual(['plan', 'status']);
    expect(await BillingAuditLog.countDocuments({ lenderCompany: id })).toBe(1);
  });

  test('no-op adjusted is skipped', async () => {
    const r = await logBillingChange({
      companyId: new mongoose.Types.ObjectId(),
      action: 'subscription.adjusted',
      source: 'admin',
      before: { status: 'active' },
      after: { status: 'active' }
    });
    expect(r).toBeNull();
    expect(await BillingAuditLog.countDocuments()).toBe(0);
  });

  test('forced failure returns null without throwing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await logBillingChange({
      companyId: new mongoose.Types.ObjectId(),
      action: 'bogus',
      source: 'admin',
      before: { status: 'a' },
      after: { status: 'b' }
    });
    expect(r).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('model is append-only', async () => {
    const row = await logBillingChange({
      companyId: new mongoose.Types.ObjectId(),
      action: 'subscription.status_changed',
      source: 'system',
      before: { status: 'active' },
      after: { status: 'read_only' }
    });
    await expect(BillingAuditLog.updateOne({ _id: row._id }, { source: 'admin' })).rejects.toThrow(/append-only/);
    await expect(BillingAuditLog.deleteOne({ _id: row._id })).rejects.toThrow(/append-only/);
    await expect(BillingAuditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(BillingAuditLog.findOneAndUpdate({ _id: row._id }, { source: 'admin' })).rejects.toThrow(/append-only/);
    await expect(BillingAuditLog.findOneAndReplace({ _id: row._id }, { source: 'admin' })).rejects.toThrow(/append-only/);
    const loaded = await BillingAuditLog.findById(row._id);
    loaded.source = 'admin';
    await expect(loaded.save()).rejects.toThrow(/append-only/);
    expect((await BillingAuditLog.findById(row._id)).source).toBe('system');
    expect(await BillingAuditLog.countDocuments()).toBe(1);
  });
});
