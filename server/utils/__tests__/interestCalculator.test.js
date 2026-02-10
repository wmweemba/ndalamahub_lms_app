/**
 * Interest Calculator Tests
 * Week 1, Day 2 - Phase 0: Loan Engine Enhancement
 */

const {
  getDailyRate,
  getActualDays,
  getDaysInPeriod,
  get30_360Days,
  calculatePeriodInterest,
  getDaysInMonth,
  addMonths,
  addDays,
  getPeriodsPerYear,
  getNextPaymentDate
} = require('../interestCalculator');

describe('Interest Calculator', () => {
  describe('getDailyRate', () => {
    test('calculates daily rate for actual/365', () => {
      const dailyRate = getDailyRate(24, 'actual/365'); // 24% per annum
      expect(dailyRate).toBeCloseTo(0.00065753, 8); // 24/100/365
    });
    
    test('calculates daily rate for actual/360', () => {
      const dailyRate = getDailyRate(24, 'actual/360');
      expect(dailyRate).toBeCloseTo(0.00066667, 8); // 24/100/360
    });

    test('calculates daily rate for 30/360', () => {
      const dailyRate = getDailyRate(24, '30/360');
      expect(dailyRate).toBeCloseTo(0.00066667, 8); // 24/100/360
    });

    test('defaults to actual/365 when no basis specified', () => {
      const dailyRate = getDailyRate(12);
      expect(dailyRate).toBeCloseTo(0.00032877, 8); // 12/100/365
    });
  });
  
  describe('getActualDays', () => {
    test('calculates days between dates in January', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      expect(getActualDays(start, end)).toBe(30);
    });
    
    test('handles February correctly (non-leap year)', () => {
      const start = new Date('2026-02-01');
      const end = new Date('2026-02-28');
      expect(getActualDays(start, end)).toBe(27);
    });

    test('handles February correctly (leap year)', () => {
      const start = new Date('2024-02-01');
      const end = new Date('2024-02-29');
      expect(getActualDays(start, end)).toBe(28);
    });

    test('calculates full year correctly', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-12-31');
      expect(getActualDays(start, end)).toBe(364);
    });
  });

  describe('get30_360Days', () => {
    test('calculates 30 days for a standard month', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      expect(get30_360Days(start, end)).toBe(30);
    });

    test('adjusts 31st day to 30th', () => {
      const start = new Date('2026-03-31');
      const end = new Date('2026-04-30');
      expect(get30_360Days(start, end)).toBe(30);
    });
  });

  describe('getDaysInMonth', () => {
    test('returns 31 for January', () => {
      expect(getDaysInMonth(2026, 0)).toBe(31); // January
    });

    test('returns 28 for February (non-leap year)', () => {
      expect(getDaysInMonth(2026, 1)).toBe(28); // February 2026
    });

    test('returns 29 for February (leap year)', () => {
      expect(getDaysInMonth(2024, 1)).toBe(29); // February 2024
    });

    test('returns 30 for April', () => {
      expect(getDaysInMonth(2026, 3)).toBe(30); // April
    });
  });

  describe('calculatePeriodInterest', () => {
    test('calculates interest for 1 month with actual/365', () => {
      const principal = 10000;
      const annualRate = 24; // 24% per annum
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const interest = calculatePeriodInterest(principal, annualRate, start, end, 'actual/365');
      // 10000 * (24/100/365) * 30 days = 197.26
      expect(interest).toBeCloseTo(197.26, 2);
    });

    test('calculates interest for February with actual/365', () => {
      const principal = 10000;
      const annualRate = 24;
      const start = new Date('2026-02-01');
      const end = new Date('2026-02-28');
      
      const interest = calculatePeriodInterest(principal, annualRate, start, end, 'actual/365');
      // 10000 * (24/100/365) * 27 days = 177.53
      expect(interest).toBeCloseTo(177.53, 2);
    });

    test('calculates interest with actual/360', () => {
      const principal = 10000;
      const annualRate = 24;
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const interest = calculatePeriodInterest(principal, annualRate, start, end, 'actual/360');
      // 10000 * (24/100/360) * 30 days = 200.00
      expect(interest).toBeCloseTo(200.00, 2);
    });
  });

  describe('addMonths', () => {
    test('adds months correctly', () => {
      const start = new Date('2026-01-15');
      const result = addMonths(start, 1);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(15);
    });

    test('handles year overflow', () => {
      const start = new Date('2026-12-15');
      const result = addMonths(start, 2);
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('addDays', () => {
    test('adds days correctly', () => {
      const start = new Date('2026-01-15');
      const result = addDays(start, 10);
      expect(result.getDate()).toBe(25);
    });

    test('handles month overflow', () => {
      const start = new Date('2026-01-25');
      const result = addDays(start, 10);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });
  });

  describe('getPeriodsPerYear', () => {
    test('returns 12 for monthly', () => {
      expect(getPeriodsPerYear('monthly')).toBe(12);
    });

    test('returns 26 for bi-weekly', () => {
      expect(getPeriodsPerYear('bi_weekly')).toBe(26);
    });

    test('returns 52 for weekly', () => {
      expect(getPeriodsPerYear('weekly')).toBe(52);
    });

    test('returns 4 for quarterly', () => {
      expect(getPeriodsPerYear('quarterly')).toBe(4);
    });

    test('defaults to 12 for unknown frequency', () => {
      expect(getPeriodsPerYear('unknown')).toBe(12);
    });
  });

  describe('getNextPaymentDate', () => {
    test('adds 1 month for monthly frequency', () => {
      const start = new Date('2026-01-15');
      const next = getNextPaymentDate(start, 'monthly');
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(15);
    });

    test('adds 2 weeks for bi-weekly frequency', () => {
      const start = new Date('2026-01-15');
      const next = getNextPaymentDate(start, 'bi_weekly');
      expect(getActualDays(start, next)).toBe(14);
    });

    test('adds 1 week for weekly frequency', () => {
      const start = new Date('2026-01-15');
      const next = getNextPaymentDate(start, 'weekly');
      expect(getActualDays(start, next)).toBe(7);
    });

    test('adds 3 months for quarterly frequency', () => {
      const start = new Date('2026-01-15');
      const next = getNextPaymentDate(start, 'quarterly');
      expect(next.getMonth()).toBe(3); // April
      expect(next.getDate()).toBe(15);
    });
  });
});
