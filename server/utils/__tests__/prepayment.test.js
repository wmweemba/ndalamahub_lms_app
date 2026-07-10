/**
 * Prepayment and Early Settlement Tests
 * Tests for Week 4: Prepayment handling functionality
 */

const mongoose = require('mongoose');
const Loan = require('../../models/Loan');
const User = require('../../models/User');
const Company = require('../../models/Company');

// Mock MongoDB connection for testing
beforeAll(async () => {
  // Use in-memory database for testing if available
  // For now, we'll use mocked models
});

afterAll(async () => {
  // Clean up
});

describe('Loan Prepayment Validation', () => {
  test('canAcceptPrepayment returns true for active loans', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId()
    });
    
    expect(loan.canAcceptPrepayment()).toBe(true);
  });
  
  test('canAcceptPrepayment returns false for settled loans', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      earlySettlement: {
        settled: true,
        settlementDate: new Date()
      }
    });
    
    expect(loan.canAcceptPrepayment()).toBe(false);
  });
  
  test('canAcceptPrepayment returns false for pending loans', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'pending_approval',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId()
    });
    
    expect(loan.canAcceptPrepayment()).toBe(false);
  });
});

describe('Remaining Balance Calculation', () => {
  test('calculateRemainingBalance returns original amount for new loan', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: []
    });
    
    expect(loan.calculateRemainingBalance()).toBe(50000);
  });
  
  test('calculateRemainingBalance accounts for paid installments', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-01-01')
        },
        {
          installmentNumber: 2,
          dueDate: new Date('2026-02-01'),
          amount: 4707,
          principal: 3781,
          interest: 926,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-02-01')
        }
      ]
    });
    
    const remaining = loan.calculateRemainingBalance();
    expect(remaining).toBeCloseTo(50000 - 3707 - 3781, 0); // ~42512
  });
  
  test('calculateRemainingBalance accounts for prepayments', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [],
      prepayments: [
        {
          amount: 10000,
          principalPortion: 9500,
          interestPortion: 500,
          date: new Date('2026-01-15'),
          allocationStrategy: 'reduce_term',
          recordedBy: new mongoose.Types.ObjectId()
        }
      ]
    });
    
    expect(loan.calculateRemainingBalance()).toBe(50000 - 9500);
  });
  
  test('calculateRemainingBalance never returns negative', () => {
    const loan = new Loan({
      amount: 10000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 11000,
          principal: 10500,
          interest: 500,
          status: 'paid',
          paidAmount: 11000,
          paidAt: new Date('2026-01-01')
        }
      ]
    });
    
    expect(loan.calculateRemainingBalance()).toBe(0);
  });
});

describe('Accrued Interest Calculation', () => {
  test('calculateAccruedInterest returns 0 for new loan', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: []
    });
    
    expect(loan.calculateAccruedInterest()).toBe(0);
  });
  
  test('calculateAccruedInterest excludes already-paid installment interest (Phase 05 fix)', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-01-01')
        },
        {
          installmentNumber: 2,
          dueDate: new Date('2026-02-01'),
          amount: 4707,
          principal: 3781,
          interest: 926,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-02-01')
        }
      ]
    });
    
    // Both installments are already paid — a borrower settling early should
    // not be quoted interest they've already paid off.
    expect(loan.calculateAccruedInterest()).toBe(0);
  });
  
  test('calculateAccruedInterest includes overdue interest', () => {
    const pastDate = new Date('2025-12-01');
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'in_arrears',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: pastDate,
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'overdue',
          paidAmount: 0
        }
      ]
    });
    
    expect(loan.calculateAccruedInterest()).toBe(1000);
  });
});

describe('Early Settlement Calculation', () => {
  test('calculateEarlySettlementAmount returns correct breakdown', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-01-01')
        }
      ]
    });

    const settlement = loan.calculateEarlySettlementAmount();

    expect(settlement).toHaveProperty('principalBalance');
    expect(settlement).toHaveProperty('interestBalance');
    expect(settlement).toHaveProperty('earlySettlementFee');
    expect(settlement).toHaveProperty('totalPayoff');
    expect(settlement).toHaveProperty('futureInterestSaved');
    expect(settlement).toHaveProperty('settlementDate');

    expect(settlement.principalBalance).toBeCloseTo(50000 - 3707, 0);
    // The only installment is already paid — its interest must not be
    // re-quoted as part of the settlement (Phase 05 accrued-interest fix).
    expect(settlement.interestBalance).toBe(0);
  });

  test('calculateEarlySettlementAmount excludes already-paid interest on a half-paid loan', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-01-01')
        },
        {
          installmentNumber: 2,
          dueDate: new Date('2026-02-01'),
          amount: 4707,
          principal: 3781,
          interest: 926,
          status: 'overdue',
          paidAmount: 0
        }
      ]
    });

    const settlement = loan.calculateEarlySettlementAmount(new Date('2026-03-01'));

    // Only the overdue (unpaid) installment's interest is quoted — the paid
    // installment's interest must not be counted a second time.
    expect(settlement.interestBalance).toBe(926);
  });
  
  test('calculateEarlySettlementAmount includes early settlement fee from product', () => {
    // This test requires product population, will be enhanced in Day 4
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: []
    });
    
    const settlement = loan.calculateEarlySettlementAmount();
    
    // Without product, fee should be 0
    expect(settlement.earlySettlementFee).toBe(0);
  });
});

describe('Prepayment Recording', () => {
  test('recordPrepayment creates correct prepayment record', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: []
    });
    
    const prepayment = loan.recordPrepayment(10000, 'reduce_term', userId, 'Extra payment');
    
    expect(prepayment.amount).toBe(10000);
    expect(prepayment.allocationStrategy).toBe('reduce_term');
    expect(prepayment.recordedBy).toBe(userId);
    expect(prepayment.notes).toBe('Extra payment');
    expect(loan.prepayments).toHaveLength(1);
  });
  
  test('recordPrepayment allocates to interest first, then principal', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'overdue', // Not paid, so interest accrued
          paidAmount: 0
        }
      ]
    });
    
    const prepayment = loan.recordPrepayment(5000, 'reduce_term', userId);
    
    expect(prepayment.interestPortion).toBe(1000); // All accrued interest
    expect(prepayment.principalPortion).toBe(4000); // Remaining goes to principal
  });
  
  test('recordPrepayment throws error for inactive loans', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'pending_approval',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId()
    });
    
    expect(() => {
      loan.recordPrepayment(10000, 'reduce_term', userId);
    }).toThrow('Loan cannot accept prepayments in current status');
  });
  
  test('recordPrepayment throws error for zero or negative amount', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId()
    });
    
    expect(() => {
      loan.recordPrepayment(0, 'reduce_term', userId);
    }).toThrow('Prepayment amount must be greater than zero');
    
    expect(() => {
      loan.recordPrepayment(-1000, 'reduce_term', userId);
    }).toThrow('Prepayment amount must be greater than zero');
  });
  
  test('recordPrepayment caps principal portion at remaining balance', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 10000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 1000,
          principal: 800,
          interest: 200,
          status: 'paid',
          paidAmount: 1000,
          paidAt: new Date('2026-01-01')
        }
      ]
    });
    
    // Remaining balance is 9200 (10000 - 800)
    // Payment of 15000 should cap principal at 9200
    const prepayment = loan.recordPrepayment(15000, 'reduce_term', userId);
    
    expect(prepayment.principalPortion).toBeLessThanOrEqual(9200);
  });
});

describe('Integration Tests', () => {
  test('Multiple prepayments accumulate correctly', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: []
    });
    
    loan.recordPrepayment(5000, 'reduce_term', userId);
    loan.recordPrepayment(3000, 'reduce_term', userId);
    loan.recordPrepayment(2000, 'reduce_payment', userId);
    
    expect(loan.prepayments).toHaveLength(3);
    
    const totalPrepaid = loan.prepayments.reduce((sum, p) => sum + p.principalPortion, 0);
    const remaining = loan.calculateRemainingBalance();
    
    expect(remaining).toBeCloseTo(50000 - totalPrepaid, 0);
  });
  
  test('Settlement calculation considers all prepayments', () => {
    const userId = new mongoose.Types.ObjectId();
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 12,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 4707,
          principal: 3707,
          interest: 1000,
          status: 'paid',
          paidAmount: 4707,
          paidAt: new Date('2026-01-01')
        }
      ]
    });
    
    loan.recordPrepayment(10000, 'reduce_term', userId);
    
    const settlement = loan.calculateEarlySettlementAmount();
    
    // Should account for both paid installment and prepayment
    const expectedRemaining = 50000 - 3707 - loan.prepayments[0].principalPortion;
    expect(settlement.principalBalance).toBeCloseTo(expectedRemaining, 0);
  });
});

describe('Waived Installment Settlement Bookkeeping (Phase 05)', () => {
  test('after settlement, remaining installments are waived and totalPaid counts the settlement amount exactly once', () => {
    const loan = new Loan({
      amount: 50000,
      interestRate: 24,
      term: 3,
      status: 'active',
      purpose: 'Test loan',
      applicant: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      lenderCompany: new mongoose.Types.ObjectId(),
      totalAmount: 56000,
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: new Date('2026-01-01'),
          amount: 18667,
          principal: 16667,
          interest: 2000,
          status: 'paid',
          paidAmount: 18667,
          paidAt: new Date('2026-01-01')
        },
        {
          installmentNumber: 2,
          dueDate: new Date('2026-02-01'),
          amount: 18667,
          principal: 16667,
          interest: 2000,
          status: 'pending',
          paidAmount: 0
        },
        {
          installmentNumber: 3,
          dueDate: new Date('2026-03-01'),
          amount: 18667,
          principal: 16667,
          interest: 2000,
          status: 'pending',
          paidAmount: 0
        }
      ]
    });

    const settlementDate = new Date('2026-01-15');
    const settlement = loan.calculateEarlySettlementAmount(settlementDate);

    // Mirror what the early-settlement route does
    loan.earlySettlement = {
      settled: true,
      settlementDate,
      settlementAmount: settlement.totalPayoff,
      earlySettlementFee: settlement.earlySettlementFee,
      principalBalance: settlement.principalBalance,
      interestBalance: settlement.interestBalance,
      savingsRealized: settlement.futureInterestSaved,
      settledBy: new mongoose.Types.ObjectId()
    };
    loan.status = 'completed';
    loan.repaymentSchedule.forEach(installment => {
      if (installment.status === 'pending') {
        installment.status = 'waived';
        installment.paidAt = settlementDate;
        installment.paidAmount = 0;
      }
    });

    // No installment claims 'paid' with a zero amount
    const waived = loan.repaymentSchedule.filter(i => i.status === 'waived');
    expect(waived).toHaveLength(2);
    waived.forEach(i => expect(i.status).not.toBe('paid'));

    const summary = loan.getSummary();
    expect(summary.remainingBalance).toBe(0);
    // totalPaid = the one paid installment's paidAmount + the settlement amount,
    // counted exactly once (not once via installments and again via settlement)
    expect(summary.totalPaid).toBeCloseTo(18667 + settlement.totalPayoff, 2);
  });
});

console.log('✅ Prepayment test suite created with 20+ tests');
