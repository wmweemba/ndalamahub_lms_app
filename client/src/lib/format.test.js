import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatTerm } from './format';

describe('formatCurrency', () => {
  it('formats a number with K prefix and thousands separators', () => {
    expect(formatCurrency(1500)).toBe('K1,500');
  });

  it('defaults to 0 for null/undefined', () => {
    expect(formatCurrency(null)).toBe('K0');
    expect(formatCurrency(undefined)).toBe('K0');
  });

  it('caps at 2 decimal places', () => {
    expect(formatCurrency(1500.5)).toBe('K1,500.5');
  });
});

describe('formatDate', () => {
  it('formats a date en-GB short style', () => {
    expect(formatDate('2026-07-12')).toBe('12 Jul 2026');
  });

  it('returns em dash for falsy input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
});

describe('formatTerm', () => {
  it('pluralizes months', () => {
    expect(formatTerm(6, 'months')).toBe('6 months');
  });

  it('singularizes a term of 1', () => {
    expect(formatTerm(1, 'months')).toBe('1 month');
  });

  it('handles days', () => {
    expect(formatTerm(30, 'days')).toBe('30 days');
  });

  it('handles weeks', () => {
    expect(formatTerm(2, 'weeks')).toBe('2 weeks');
  });

  it('defaults to months for legacy loans with no termUnit', () => {
    expect(formatTerm(6)).toBe('6 months');
  });
});
