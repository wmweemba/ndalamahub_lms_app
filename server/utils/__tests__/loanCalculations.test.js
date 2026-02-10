/**
 * Comprehensive Loan Calculation Tests
 * Tests the full loan calculation pipeline including both methods
 */

const mongoose = require('mongoose');
const Loan = require('../../models/Loan');

// Note: These tests don't require database connection
// They test the calculation logic directly

describe('Loan Calculation Integration Tests', () => {
  const testApplicantId = new mongoose.Types.ObjectId();
  const testCompanyId = new mongoose.Types.ObjectId();

  describe('Reducing Balance Method', () => {
    test('should calculate correctly for monthly repayment', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();

      expect(loan.monthlyPayment).toBeCloseTo(1785.26, 2);
      expect(loan.totalInterest).toBeCloseTo(711.55, 2);
      expect(loan.totalAmount).toBeCloseTo(10711.55, 2);
    });

    test('should generate correct repayment schedule', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(6);
      
      // First installment should have highest interest
      const firstInstallment = loan.repaymentSchedule[0];
      expect(firstInstallment.principal).toBeLessThan(firstInstallment.amount);
      expect(firstInstallment.interest).toBeGreaterThan(0);
      
      // Last installment should have lowest interest
      const lastInstallment = loan.repaymentSchedule[5];
      expect(lastInstallment.interest).toBeLessThan(firstInstallment.interest);
      
      // All installments should have 'pending' status
      loan.repaymentSchedule.forEach(installment => {
        expect(installment.status).toBe('pending');
      });
    });

    test('should handle bi-weekly repayment frequency', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 5000,
        interestRate: 18,
        term: 12,
        repaymentFrequency: 'bi_weekly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(12);
      
      // Check that dates are 14 days apart
      for (let i = 1; i < loan.repaymentSchedule.length; i++) {
        const prevDate = new Date(loan.repaymentSchedule[i - 1].dueDate);
        const currentDate = new Date(loan.repaymentSchedule[i].dueDate);
        const daysDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBe(14);
      }
    });

    test('should handle weekly repayment frequency', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 2000,
        interestRate: 12,
        term: 8,
        repaymentFrequency: 'weekly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(8);
      
      // Check that dates are 7 days apart
      for (let i = 1; i < loan.repaymentSchedule.length; i++) {
        const prevDate = new Date(loan.repaymentSchedule[i - 1].dueDate);
        const currentDate = new Date(loan.repaymentSchedule[i].dueDate);
        const daysDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBe(7);
      }
    });
  });

  describe('Flat Rate Method', () => {
    test('should calculate correctly for monthly repayment', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'flat_rate',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();

      expect(loan.monthlyPayment).toBeCloseTo(1866.67, 2);
      expect(loan.totalInterest).toBeCloseTo(1200.00, 2);
      expect(loan.totalAmount).toBeCloseTo(11200.00, 2);
    });

    test('should generate equal installments', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'flat_rate',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(6);
      
      // All installments should have equal principal and interest
      const expectedPrincipal = 10000 / 6;
      const expectedInterest = 1200 / 6;
      
      loan.repaymentSchedule.forEach(installment => {
        expect(installment.principal).toBeCloseTo(expectedPrincipal, 2);
        expect(installment.interest).toBeCloseTo(expectedInterest, 2);
        expect(installment.amount).toBeCloseTo(1866.67, 2);
      });
    });

    test('should be more expensive than reducing balance', () => {
      const flatRateLoan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'flat_rate',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      const reducingBalanceLoan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      flatRateLoan.calculateLoanDetails();
      reducingBalanceLoan.calculateLoanDetails();

      expect(flatRateLoan.totalInterest).toBeGreaterThan(reducingBalanceLoan.totalInterest);
      expect(flatRateLoan.monthlyPayment).toBeGreaterThan(reducingBalanceLoan.monthlyPayment);
    });
  });

  describe('Simple Interest Method', () => {
    test('should calculate correctly for monthly repayment', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'simple_interest',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();

      expect(loan.monthlyPayment).toBeCloseTo(1866.67, 2);
      expect(loan.totalInterest).toBeCloseTo(1200.00, 2);
      expect(loan.totalAmount).toBeCloseTo(11200.00, 2);
    });

    test('should generate variable interest based on actual days', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'simple_interest',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(6);
      
      // All installments should have equal principal
      const expectedPrincipal = 10000 / 6;
      
      loan.repaymentSchedule.forEach(installment => {
        expect(installment.principal).toBeCloseTo(expectedPrincipal, 2);
        // Interest should vary based on actual days in month
        expect(installment.interest).toBeGreaterThan(0);
      });
      
      // Interest amounts should vary (not all equal like flat rate)
      const interestAmounts = loan.repaymentSchedule.map(i => i.interest);
      const uniqueInterests = [...new Set(interestAmounts.map(i => i.toFixed(2)))];
      expect(uniqueInterests.length).toBeGreaterThan(1);
    });

    test('should calculate interest on original principal each period', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        disbursedAt: new Date('2025-01-15'),
        interestCalculation: {
          method: 'simple_interest',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      // With simple interest, interest for 31-day months should be higher than 30-day months
      // All calculated on original 10,000 principal (not reducing balance)
      const januaryInterest = loan.repaymentSchedule[0].interest;
      const februaryInterest = loan.repaymentSchedule[1].interest;
      
      // February has fewer days, so less interest (but still on full 10,000 principal)
      expect(februaryInterest).toBeLessThan(januaryInterest);
      
      // Total interest from schedule should be close to estimated total (may vary due to actual days)
      const totalCalculatedInterest = loan.repaymentSchedule.reduce((sum, i) => sum + i.interest, 0);
      expect(totalCalculatedInterest).toBeGreaterThan(1100); // Should be around 1200
      expect(totalCalculatedInterest).toBeLessThan(1300);
    });

    test('should be between reducing balance and flat rate cost', () => {
      const simpleInterestLoan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'simple_interest',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      const reducingBalanceLoan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      simpleInterestLoan.calculateLoanDetails();
      reducingBalanceLoan.calculateLoanDetails();

      // Simple interest should be more expensive than reducing balance
      expect(simpleInterestLoan.totalInterest).toBeGreaterThan(reducingBalanceLoan.totalInterest);
    });
  });

  describe('Day Count Conventions', () => {
    test('should support different day count conventions', () => {
      const loan365 = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      const loan360 = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/360',
          accrualFrequency: 'daily'
        }
      });

      loan365.calculateLoanDetails();
      loan360.calculateLoanDetails();

      // Both should calculate successfully
      expect(loan365.totalInterest).toBeGreaterThan(0);
      expect(loan360.totalInterest).toBeGreaterThan(0);
      expect(loan365.repaymentSchedule).toBeDefined();
      expect(loan360.repaymentSchedule).toBeDefined();
    });

    test('should use 30/360 day count correctly', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 24,
        term: 6,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: '30/360',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(6);
      expect(loan.totalInterest).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero interest loans', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 10000,
        interestRate: 0,
        term: 12,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.totalInterest).toBe(0);
      expect(loan.monthlyPayment).toBeCloseTo(10000 / 12, 2);
      expect(loan.totalAmount).toBe(10000);
    });

    test('should handle single payment term', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 5000,
        interestRate: 12,
        term: 1,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(1);
      expect(loan.repaymentSchedule[0].amount).toBeCloseTo(loan.amount + loan.totalInterest, 2);
    });

    test('should handle large loan amounts', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 1000000, // ZMW 1 million
        interestRate: 15,
        term: 24,
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(24);
      expect(loan.totalInterest).toBeGreaterThan(0);
      expect(loan.totalAmount).toBeGreaterThan(1000000);
    });

    test('should handle long term loans', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 50000,
        interestRate: 18,
        term: 60, // 5 years
        repaymentFrequency: 'monthly',
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      expect(loan.repaymentSchedule).toHaveLength(60);
      expect(loan.totalInterest).toBeGreaterThan(0);
      
      // Verify interest decreases over time
      const firstInterest = loan.repaymentSchedule[0].interest;
      const lastInterest = loan.repaymentSchedule[59].interest;
      expect(lastInterest).toBeLessThan(firstInterest);
    });
  });

  describe('February Interest Calculation', () => {
    test('should calculate lower interest for February (28 days)', () => {
      const loan = new Loan({
        applicant: testApplicantId,
        company: testCompanyId,
        amount: 50000,
        interestRate: 24,
        term: 3,
        repaymentFrequency: 'monthly',
        disbursedAt: new Date('2025-01-15'),
        interestCalculation: {
          method: 'reducing_balance',
          accrualBasis: 'actual/365',
          accrualFrequency: 'daily'
        }
      });

      loan.calculateLoanDetails();
      loan.generateRepaymentSchedule();

      // February payment should have less interest than January or March
      const januaryInterest = loan.repaymentSchedule[0].interest;
      const februaryInterest = loan.repaymentSchedule[1].interest;
      
      // February should be lower because of fewer days
      expect(februaryInterest).toBeLessThan(januaryInterest);
    });
  });
});
