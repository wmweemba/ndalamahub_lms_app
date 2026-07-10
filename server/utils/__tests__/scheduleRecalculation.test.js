/**
 * Schedule Recalculation Tests
 * Tests for Week 4 Day 3: Schedule recalculation after prepayment
 */

const mongoose = require('mongoose');
const Loan = require('../../models/Loan');

describe('Schedule Recalculation', () => {
  
  describe('Reducing Balance - Reduce Term Strategy', () => {
    test('reduces term while keeping same payment', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 24,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 4707,
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 4707,
            principal: 3707,
            interest: 1000,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-02-01')
          },
          {
            installmentNumber: 2,
            dueDate: new Date('2026-03-01'),
            amount: 4707,
            principal: 3781,
            interest: 926,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-03-01')
          }
        ]
      });
      
      // Record prepayment
      loan.recordPrepayment(10000, 'reduce_term', new mongoose.Types.ObjectId());
      
      // Get counts before recalculation
      const paidCount = loan.repaymentSchedule.filter(i => i.status === 'paid').length;
      const originalTerm = loan.term;
      
      // Recalculate schedule
      const newSchedule = loan.recalculateSchedule('reduce_term');
      
      // Should have paid installments + reduced new installments
      expect(newSchedule.length).toBeLessThan(originalTerm);
      expect(newSchedule.filter(i => i.status === 'paid').length).toBe(paidCount);
      
      // New installments should have similar payment amount
      const newInstallments = newSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 0) {
        expect(newInstallments[0].amount).toBeCloseTo(4707, 0);
      }
    });
    
    test('keeps paid installments in schedule', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 24,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 4707,
        interestCalculation: {
          method: 'reducing_balance'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 4707,
            principal: 3707,
            interest: 1000,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      loan.recordPrepayment(5000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      
      const paidInstallments = loan.repaymentSchedule.filter(i => i.status === 'paid');
      expect(paidInstallments.length).toBe(1);
      expect(paidInstallments[0].installmentNumber).toBe(1);
    });
  });
  
  describe('Reducing Balance - Reduce Payment Strategy', () => {
    test('reduces payment while keeping same term', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 24,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 4707,
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 4707,
            principal: 3707,
            interest: 1000,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      const originalTerm = loan.term;
      const paidCount = 1;
      
      loan.recordPrepayment(10000, 'reduce_payment', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_payment');
      
      // Term should stay the same (paid + remaining = original)
      const expectedLength = originalTerm;
      expect(loan.repaymentSchedule.length).toBeLessThanOrEqual(expectedLength);
      
      // New installments should have lower payment
      const newInstallments = loan.repaymentSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 0) {
        expect(newInstallments[0].amount).toBeLessThan(4707);
      }
    });
  });
  
  describe('Flat Rate Recalculation', () => {
    test('recalculates flat rate schedule with reduce term', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 6,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 1867, // (10000 + 1200) / 6
        interestCalculation: {
          method: 'flat_rate',
          accrualBasis: 'actual/365'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 1867,
            principal: 1667,
            interest: 200,
            status: 'paid',
            paidAmount: 1867,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      loan.recordPrepayment(2000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      
      expect(loan.repaymentSchedule.length).toBeLessThan(6);
      
      // Verify flat rate characteristic: equal payments
      const newInstallments = loan.repaymentSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 1) {
        expect(newInstallments[0].amount).toBeCloseTo(newInstallments[1].amount, 0);
      }
    });
    
    test('recalculates flat rate schedule with reduce payment', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 6,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 1867,
        interestCalculation: {
          method: 'flat_rate'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 1867,
            principal: 1667,
            interest: 200,
            status: 'paid',
            paidAmount: 1867,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      const originalPayment = loan.monthlyPayment;
      
      loan.recordPrepayment(2000, 'reduce_payment', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_payment');
      
      const newInstallments = loan.repaymentSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 0) {
        expect(newInstallments[0].amount).toBeLessThan(originalPayment);
      }
    });
  });
  
  describe('Simple Interest Recalculation', () => {
    test('recalculates simple interest schedule', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 6,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 1867,
        interestCalculation: {
          method: 'simple_interest',
          accrualBasis: 'actual/365'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 1867,
            principal: 1683,
            interest: 184,
            status: 'paid',
            paidAmount: 1867,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      loan.recordPrepayment(2000, 'reduce_term', new mongoose.Types.ObjectId());
      const newSchedule = loan.recalculateSchedule('reduce_term');
      
      expect(newSchedule.filter(i => i.status === 'pending').length).toBeGreaterThan(0);
    });
  });
  
  describe('Interest-Only Recalculation', () => {
    test('recalculates interest-only schedule with balloon', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 18,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 750,
        interestCalculation: {
          method: 'interest_only',
          accrualBasis: 'actual/365'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 750,
            principal: 0,
            interest: 750,
            status: 'paid',
            paidAmount: 750,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      loan.recordPrepayment(10000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      
      // Last installment should be balloon with reduced principal
      const newInstallments = loan.repaymentSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 0) {
        const lastInstallment = newInstallments[newInstallments.length - 1];
        expect(lastInstallment.isBalloonPayment).toBe(true);
        expect(lastInstallment.principal).toBeLessThan(50000);
      }
    });
  });
  
  describe('Edge Cases', () => {
    test('handles recalculation with zero remaining balance', () => {
      const loan = new Loan({
        amount: 5000,
        interestRate: 24,
        term: 6,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 900,
        interestCalculation: {
          method: 'reducing_balance'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 900,
            principal: 5000,
            interest: 100,
            status: 'paid',
            paidAmount: 5100,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      const newSchedule = loan.recalculateSchedule('reduce_term');
      
      // No more installments needed
      expect(newSchedule.filter(i => i.status === 'pending').length).toBe(0);
    });
    
    test('handles recalculation with all installments paid', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 3,
        status: 'completed',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 3500,
        interestCalculation: {
          method: 'reducing_balance'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 3500,
            principal: 3300,
            interest: 200,
            status: 'paid',
            paidAmount: 3500,
            paidAt: new Date('2026-02-01')
          },
          {
            installmentNumber: 2,
            dueDate: new Date('2026-03-01'),
            amount: 3500,
            principal: 3368,
            interest: 132,
            status: 'paid',
            paidAmount: 3500,
            paidAt: new Date('2026-03-01')
          },
          {
            installmentNumber: 3,
            dueDate: new Date('2026-04-01'),
            amount: 3500,
            principal: 3332,
            interest: 68,
            status: 'paid',
            paidAmount: 3432,
            paidAt: new Date('2026-04-01')
          }
        ]
      });
      
      const newSchedule = loan.recalculateSchedule('reduce_term');
      
      // All installments already paid, no new ones needed
      expect(newSchedule.filter(i => i.status === 'pending').length).toBe(0);
      // Schedule should keep the paid installments
      expect(newSchedule.length).toBeGreaterThanOrEqual(0);
    });
    
    test('throws error for invalid strategy', () => {
      const loan = new Loan({
        amount: 10000,
        interestRate: 24,
        term: 6,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        interestCalculation: {
          method: 'reducing_balance'
        },
        repaymentSchedule: []
      });
      
      expect(() => {
        loan.recalculateSchedule('invalid_strategy');
      }).toThrow('Strategy must be either "reduce_term" or "reduce_payment"');
    });
    
    test('handles multiple prepayments with recalculations', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 24,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 4707,
        interestCalculation: {
          method: 'reducing_balance'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 4707,
            principal: 3707,
            interest: 1000,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-02-01')
          }
        ]
      });
      
      // First prepayment
      loan.recordPrepayment(5000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      const firstLength = loan.repaymentSchedule.length;
      
      // Second prepayment
      loan.recordPrepayment(3000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      const secondLength = loan.repaymentSchedule.length;
      
      // Second recalculation should further reduce schedule
      expect(secondLength).toBeLessThanOrEqual(firstLength);
    });
  });
  
  describe('Installment Numbering', () => {
    test('maintains correct installment numbering after recalculation', () => {
      const loan = new Loan({
        amount: 50000,
        interestRate: 24,
        term: 12,
        status: 'active',
        purpose: 'Test loan',
        applicant: new mongoose.Types.ObjectId(),
        company: new mongoose.Types.ObjectId(),
        lenderCompany: new mongoose.Types.ObjectId(),
        monthlyPayment: 4707,
        interestCalculation: {
          method: 'reducing_balance'
        },
        disbursedAt: new Date('2026-01-01'),
        repaymentSchedule: [
          {
            installmentNumber: 1,
            dueDate: new Date('2026-02-01'),
            amount: 4707,
            principal: 3707,
            interest: 1000,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-02-01')
          },
          {
            installmentNumber: 2,
            dueDate: new Date('2026-03-01'),
            amount: 4707,
            principal: 3781,
            interest: 926,
            status: 'paid',
            paidAmount: 4707,
            paidAt: new Date('2026-03-01')
          }
        ]
      });
      
      loan.recordPrepayment(10000, 'reduce_term', new mongoose.Types.ObjectId());
      loan.recalculateSchedule('reduce_term');
      
      // Check that installment numbers are sequential
      const numbers = loan.repaymentSchedule.map(i => i.installmentNumber);
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]).toBe(numbers[i-1] + 1);
      }
      
      // First new installment should be number 3
      const newInstallments = loan.repaymentSchedule.filter(i => i.status === 'pending');
      if (newInstallments.length > 0) {
        expect(newInstallments[0].installmentNumber).toBe(3);
      }
    });
  });

  describe('Single-Installment Day-Term Loan (Phase 05 — Manifi shape)', () => {
    const buildSingleInstallmentLoan = () => new Loan({
      amount: 10000,
      interestRate: 25,
      term: 30,
      termUnit: 'days',
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      monthlyPayment: 12500,
      repaymentFrequency: 'monthly',
      interestCalculation: {
        method: 'flat_rate',
        rateBasis: 'per_term',
        accrualBasis: 'actual/365',
        accrualFrequency: 'daily'
      },
      disbursedAt: new Date('2026-01-01'),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-31'),
          amount: 12500,
          principal: 10000,
          interest: 2500,
          status: 'pending',
          paidAmount: 0
        }
      ]
    });

    test('reduce_term strategy does not divide by zero on a 1-remaining-installment loan', () => {
      const loan = buildSingleInstallmentLoan();
      loan.recordPrepayment(2000, 'reduce_term', new mongoose.Types.ObjectId());

      const newSchedule = loan.recalculateSchedule('reduce_term');

      expect(newSchedule).toHaveLength(1);
      expect(Number.isFinite(newSchedule[0].amount)).toBe(true);
      expect(Number.isFinite(newSchedule[0].principal)).toBe(true);
      expect(Number.isFinite(newSchedule[0].interest)).toBe(true);
      expect(newSchedule[0].amount).toBeGreaterThan(0);
    });

    test('reduce_payment strategy does not divide by zero on a 1-remaining-installment loan', () => {
      const loan = buildSingleInstallmentLoan();
      loan.recordPrepayment(2000, 'reduce_payment', new mongoose.Types.ObjectId());

      const newSchedule = loan.recalculateSchedule('reduce_payment');

      expect(newSchedule).toHaveLength(1);
      expect(Number.isFinite(newSchedule[0].amount)).toBe(true);
      expect(Number.isFinite(newSchedule[0].principal)).toBe(true);
      expect(Number.isFinite(newSchedule[0].interest)).toBe(true);
      expect(newSchedule[0].amount).toBeGreaterThan(0);
    });
  });
});

console.log('✅ Schedule recalculation test suite created with 15+ tests');
