import { describe, it, expect } from 'vitest';
import { getAccessUntil, daysUntil, getExpiryStatus } from './subscription';

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
