const mongoose = require('mongoose');
const Loan = require('../../models/Loan');

describe('Grace Period & Moratorium Schedule Generation', () => {
  const testApplicantId = new mongoose.Types.ObjectId();
  const testCompanyId = new mongoose.Types.ObjectId();

  test('should skip principal for grace period (principal_only)', () => {
    const loan = new Loan({
      applicant: testApplicantId,
      company: testCompanyId,
      amount: 12000,
      interestRate: 18,
      term: 12,
      repaymentFrequency: 'monthly',
      gracePeriod: 3,
      graceType: 'principal_only',
      interestCalculation: {
        method: 'reducing_balance',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });
    loan.calculateLoanDetails();
    loan.generateRepaymentSchedule();
    // Targeted debug: print the actual repaymentSchedule for inspection
    // eslint-disable-next-line no-console
    console.log('[TEST_DEBUG_REPAYMENT_SCHEDULE]', JSON.stringify(loan.repaymentSchedule, null, 2));
    // First 3 installments should have principal = 0, interest > 0
    for (let i = 0; i < 3; i++) {
      expect(loan.repaymentSchedule[i].principal).toBe(0);
      expect(loan.repaymentSchedule[i].interest).toBeGreaterThan(0);
      expect(loan.repaymentSchedule[i].amount).toBeCloseTo(loan.repaymentSchedule[i].interest, 2);
      expect(!!loan.repaymentSchedule[i].isGrace).toBe(true);
    }
    // 4th installment should have principal > 0
    expect(loan.repaymentSchedule[3].principal).toBeGreaterThan(0);
    expect(!!loan.repaymentSchedule[3].isGrace).toBe(false);
  });

  test('should skip both principal and interest for full moratorium', () => {
    const loan = new Loan({
      applicant: testApplicantId,
      company: testCompanyId,
      amount: 12000,
      interestRate: 18,
      term: 12,
      repaymentFrequency: 'monthly',
      gracePeriod: 2,
      graceType: 'full_moratorium',
      interestCalculation: {
        method: 'reducing_balance',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      }
    });
    loan.calculateLoanDetails();
    loan.generateRepaymentSchedule();
    // First 2 installments should have principal = 0, interest = 0
    for (let i = 0; i < 2; i++) {
      expect(loan.repaymentSchedule[i].principal).toBe(0);
      expect(loan.repaymentSchedule[i].interest).toBe(0);
      expect(loan.repaymentSchedule[i].amount).toBe(0);
      expect(!!loan.repaymentSchedule[i].isGrace).toBe(true);
    }
    // 3rd installment should have principal > 0, interest > 0
    expect(loan.repaymentSchedule[2].principal).toBeGreaterThan(0);
    expect(loan.repaymentSchedule[2].interest).toBeGreaterThan(0);
    expect(!!loan.repaymentSchedule[2].isGrace).toBe(false);
  });

  test('should skip payments during moratorium window', () => {
    const loan = new Loan({
      applicant: testApplicantId,
      company: testCompanyId,
      amount: 12000,
      interestRate: 18,
      term: 12,
      repaymentFrequency: 'monthly',
      method: 'reducing_balance',
      accrualBasis: 'actual/365',
      accrualFrequency: 'daily',
      moratorium: {
        isActive: true,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-05-31'),
        reason: 'COVID-19'
      },
      disbursedAt: new Date('2026-01-01')
    });
    loan.calculateLoanDetails();
    loan.generateRepaymentSchedule();
    // Find installments in moratorium window
    loan.repaymentSchedule.forEach(inst => {
      if (inst.dueDate >= new Date('2026-03-01') && inst.dueDate <= new Date('2026-05-31')) {
        expect(inst.principal).toBe(0);
        expect(inst.interest).toBe(0);
        expect(inst.amount).toBe(0);
        expect(!!inst.isMoratorium).toBe(true);
      }
    });
  });
});
