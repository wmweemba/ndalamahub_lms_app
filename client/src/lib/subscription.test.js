import { describe, it, expect } from 'vitest';
import { getAccessUntil, daysUntil, getExpiryStatus, previewPeriodEnd } from './subscription';

const now = new Date('2026-10-20T12:00:00Z');
const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('getAccessUntil', () => {
  it('uses currentPeriodEnd for an active lender with a stale trialEndsAt', () => {
    const sub = { status: 'active', trialEndsAt: inDays(-90), currentPeriodEnd: inDays(60) };
    expect(getAccessUntil(sub)).toEqual({ date: sub.currentPeriodEnd, kind: 'paid' });
  });

  it('uses trialEndsAt while trialing', () => {
    const sub = { status: 'trialing', trialEndsAt: inDays(10), currentPeriodEnd: inDays(60) };
    expect(getAccessUntil(sub)).toEqual({ date: sub.trialEndsAt, kind: 'trial' });
  });

  it('returns nulls when there is no date', () => {
    expect(getAccessUntil({ status: 'active' })).toEqual({ date: null, kind: null });
    expect(getAccessUntil(undefined)).toEqual({ date: null, kind: null });
  });
});

describe('daysUntil', () => {
  it('rounds partial days up', () => {
    expect(daysUntil(inDays(5), now)).toBe(5);
    expect(daysUntil(new Date(now.getTime() + 3600 * 1000), now)).toBe(1);
  });
});

describe('getExpiryStatus', () => {
  it('warns 5 days out', () => {
    const r = getExpiryStatus({ status: 'active', currentPeriodEnd: inDays(5) }, { now });
    expect(r).toEqual({ tone: 'warning', label: 'Expires in 5d' });
  });

  it('flags a lapsed period as danger', () => {
    const r = getExpiryStatus({ status: 'active', currentPeriodEnd: inDays(-3) }, { now });
    expect(r.tone).toBe('danger');
    expect(r.label).toMatch(/^Expired /);
  });

  it('returns null 30 days out', () => {
    expect(getExpiryStatus({ status: 'active', currentPeriodEnd: inDays(30) }, { now })).toBeNull();
  });

  it('returns null for suspended and cancelled', () => {
    expect(getExpiryStatus({ status: 'suspended', currentPeriodEnd: inDays(-3) }, { now })).toBeNull();
    expect(getExpiryStatus({ status: 'cancelled', currentPeriodEnd: inDays(2) }, { now })).toBeNull();
  });

  it('returns null with no date', () => {
    expect(getExpiryStatus({ status: 'active' }, { now })).toBeNull();
  });
});

describe('previewPeriodEnd', () => {
  it('clamps 31 Jan + 1 month to the end of Feb', () => {
    const d = previewPeriodEnd({ status: 'active' }, 1, new Date('2027-01-31T00:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2027-02-28');
    const leap = previewPeriodEnd({ status: 'active' }, 1, new Date('2028-01-31T00:00:00Z'));
    expect(leap.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('extends an active future period from its end', () => {
    const d = previewPeriodEnd({ status: 'active', currentPeriodEnd: '2026-12-15T00:00:00Z' }, 3, now);
    expect(d.toISOString().slice(0, 10)).toBe('2027-03-15');
  });

  it('extends a lapsed lender from today', () => {
    const d = previewPeriodEnd({ status: 'active', currentPeriodEnd: '2026-09-01T00:00:00Z' }, 1, now);
    expect(d.toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('extends a trialing lender from trialEndsAt', () => {
    const d = previewPeriodEnd({ status: 'trialing', trialEndsAt: '2026-11-10T00:00:00Z' }, 1, now);
    expect(d.toISOString().slice(0, 10)).toBe('2026-12-10');
  });
});
