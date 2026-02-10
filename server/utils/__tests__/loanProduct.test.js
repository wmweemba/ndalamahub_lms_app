const mongoose = require('mongoose');
const LoanProduct = require('../../models/LoanProduct');

describe('LoanProduct Model Tests', () => {
  const testCompanyId = new mongoose.Types.ObjectId();

  describe('Product Validation Logic', () => {
    it('should validate amount within range', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000, currency: 'ZMW' },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      expect(product.isAmountValid(50000)).toBe(true);
      expect(product.isAmountValid(10000)).toBe(true);
      expect(product.isAmountValid(100000)).toBe(true);
      expect(product.isAmountValid(5000)).toBe(false);
      expect(product.isAmountValid(150000)).toBe(false);
    });

    it('should validate term within range', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      expect(product.isTermValid(24)).toBe(true);
      expect(product.isTermValid(6)).toBe(true);
      expect(product.isTermValid(60)).toBe(true);
      expect(product.isTermValid(3)).toBe(false);
      expect(product.isTermValid(72)).toBe(false);
    });

    it('should validate interest rate within range', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      expect(product.isRateValid(18)).toBe(true);
      expect(product.isRateValid(12)).toBe(true);
      expect(product.isRateValid(24)).toBe(true);
      expect(product.isRateValid(10)).toBe(false);
      expect(product.isRateValid(30)).toBe(false);
    });
  });

  describe('Fee Calculations', () => {
    it('should calculate percentage processing fee correctly', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        fees: {
          processingFee: { type: 'percentage', amount: 2 }
        },
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      const fee = product.calculateProcessingFee(50000);
      expect(fee).toBe(1000); // 2% of 50000
    });

    it('should calculate fixed processing fee correctly', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        fees: {
          processingFee: { type: 'fixed', amount: 500 }
        },
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      const fee = product.calculateProcessingFee(50000);
      expect(fee).toBe(500); // Fixed fee
      
      const fee2 = product.calculateProcessingFee(100000);
      expect(fee2).toBe(500); // Same fixed fee regardless of amount
    });

    it('should calculate insurance fee correctly', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        fees: {
          insuranceFee: { type: 'percentage', amount: 1, required: true }
        },
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      const fee = product.calculateInsuranceFee(50000);
      expect(fee).toBe(500); // 1% of 50000
    });

    it('should return 0 for insurance fee when not required', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        fees: {
          insuranceFee: { type: 'percentage', amount: 1, required: false }
        },
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      const fee = product.calculateInsuranceFee(50000);
      expect(fee).toBe(0);
    });

    it('should calculate total upfront fees', () => {
      const product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        fees: {
          processingFee: { type: 'percentage', amount: 2 },
          insuranceFee: { type: 'percentage', amount: 1, required: true }
        },
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      const total = product.calculateUpfrontFees(50000);
      expect(total).toBe(1500); // 1000 + 500
    });
  });

  describe('Eligibility Checks', () => {
    let product;

    beforeEach(() => {
      product = new LoanProduct({
        name: 'Test Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 10000, max: 100000 },
        interestCalculation: { method: 'reducing_balance' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: {
          minAge: 21,
          maxAge: 60,
          minIncome: 5000,
          minEmploymentMonths: 6,
          minCreditScore: 500,
          employmentTypes: ['permanent', 'contract']
        }
      });
    });

    it('should pass eligibility for valid applicant', () => {
      const result = product.checkEligibility({
        age: 30,
        monthlyIncome: 10000,
        employmentMonths: 12,
        creditScore: 600,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail eligibility - too young', () => {
      const result = product.checkEligibility({
        age: 18,
        monthlyIncome: 10000,
        employmentMonths: 12,
        creditScore: 600,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('at least 21 years old');
    });

    it('should fail eligibility - too old', () => {
      const result = product.checkEligibility({
        age: 65,
        monthlyIncome: 10000,
        employmentMonths: 12,
        creditScore: 600,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.some(e => e.includes('cannot exceed 60 years'))).toBe(true);
    });

    it('should fail eligibility - insufficient income', () => {
      const result = product.checkEligibility({
        age: 30,
        monthlyIncome: 3000,
        employmentMonths: 12,
        creditScore: 600,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.some(e => e.includes('income'))).toBe(true);
    });

    it('should fail eligibility - insufficient employment duration', () => {
      const result = product.checkEligibility({
        age: 30,
        monthlyIncome: 10000,
        employmentMonths: 3,
        creditScore: 600,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.some(e => e.includes('employment duration'))).toBe(true);
    });

    it('should fail eligibility - low credit score', () => {
      const result = product.checkEligibility({
        age: 30,
        monthlyIncome: 10000,
        employmentMonths: 12,
        creditScore: 400,
        employmentType: 'permanent'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.some(e => e.includes('credit score'))).toBe(true);
    });

    it('should fail eligibility - invalid employment type', () => {
      const result = product.checkEligibility({
        age: 30,
        monthlyIncome: 10000,
        employmentMonths: 12,
        creditScore: 600,
        employmentType: 'unemployed'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.some(e => e.includes('Employment type'))).toBe(true);
    });

    it('should accumulate multiple eligibility errors', () => {
      const result = product.checkEligibility({
        age: 17,
        monthlyIncome: 2000,
        employmentMonths: 2,
        creditScore: 300,
        employmentType: 'unemployed'
      });

      expect(result.eligible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3); // Multiple failures
    });
  });

  describe('Interest Calculation Methods Support', () => {
    it('should support reducing_balance method', () => {
      const product = new LoanProduct({
        name: 'Reducing Balance Product',
        description: 'Test',
        category: 'personal',
        company: testCompanyId,
        interestRate: { min: 12, max: 24, default: 18 },
        term: { min: 6, max: 60, default: 24 },
        amount: { min: 1000, max: 100000 },
        interestCalculation: { method: 'reducing_balance', dayCountConvention: 'actual/365' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
      });

      expect(product.interestCalculation.method).toBe('reducing_balance');
      expect(product.interestCalculation.dayCountConvention).toBe('actual/365');
    });

    it('should support flat_rate method', () => {
      const product = new LoanProduct({
        name: 'Flat Rate Product',
        description: 'Test',
        category: 'payday',
        company: testCompanyId,
        interestRate: { min: 5, max: 10, default: 7 },
        term: { min: 1, max: 3, default: 1 },
        amount: { min: 500, max: 5000 },
        interestCalculation: { method: 'flat_rate', dayCountConvention: 'actual/365' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 18, maxAge: 65, minIncome: 0 }
      });

      expect(product.interestCalculation.method).toBe('flat_rate');
    });

    it('should support simple_interest method', () => {
      const product = new LoanProduct({
        name: 'Simple Interest Product',
        description: 'Test',
        category: 'education',
        company: testCompanyId,
        interestRate: { min: 10, max: 18, default: 14 },
        term: { min: 12, max: 60, default: 36 },
        amount: { min: 5000, max: 150000 },
        interestCalculation: { method: 'simple_interest', dayCountConvention: 'actual/365' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 18, maxAge: 35, minIncome: 0 }
      });

      expect(product.interestCalculation.method).toBe('simple_interest');
    });

    it('should support interest_only method', () => {
      const product = new LoanProduct({
        name: 'Interest Only Product',
        description: 'Test',
        category: 'bridge',
        company: testCompanyId,
        interestRate: { min: 18, max: 36, default: 24 },
        term: { min: 3, max: 12, default: 6 },
        amount: { min: 50000, max: 1000000 },
        interestCalculation: { method: 'interest_only', dayCountConvention: 'actual/360' },
        repaymentFrequency: ['monthly'],
        eligibilityCriteria: { minAge: 25, maxAge: 65, minIncome: 0 }
      });

      expect(product.interestCalculation.method).toBe('interest_only');
      expect(product.interestCalculation.dayCountConvention).toBe('actual/360');
    });
  });

  describe('Product Categories', () => {
    const categories = ['personal', 'business', 'payday', 'bridge', 'microfinance', 'auto', 'education', 'mortgage'];

    categories.forEach(category => {
      it(`should support ${category} category`, () => {
        const product = new LoanProduct({
          name: `${category} Product`,
          description: 'Test',
          category: category,
          company: testCompanyId,
          interestRate: { min: 12, max: 24, default: 18 },
          term: { min: 6, max: 60, default: 24 },
          amount: { min: 1000, max: 100000 },
          interestCalculation: { method: 'reducing_balance' },
          repaymentFrequency: ['monthly'],
          eligibilityCriteria: { minAge: 21, maxAge: 60, minIncome: 0 }
        });

        expect(product.category).toBe(category);
      });
    });
  });
});
