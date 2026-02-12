const mongoose = require('mongoose');
const LoanProduct = require('../models/LoanProduct');
const Company = require('../models/Company');
require('dotenv').config();

const connectDB = require('../config/db');

// Default product templates
const productTemplates = [
  {
    name: 'Personal Loan - Standard',
    description: 'Flexible personal loan for your immediate needs with competitive rates and flexible terms',
    category: 'personal',
    interestRate: { min: 12, max: 24, default: 18 },
    term: { min: 6, max: 60, default: 24 },
    amount: { min: 1000, max: 100000, currency: 'ZMW' },
    interestCalculation: { method: 'reducing_balance', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly', 'bi_weekly'],
    fees: {
      processingFee: { type: 'percentage', amount: 2.5 },
      latePenalty: { type: 'percentage', amount: 5 },
      earlySettlementFee: { type: 'percentage', amount: 2 },
      insuranceFee: { type: 'percentage', amount: 0.5, required: false }
    },
    collateralRequired: false,
    eligibilityCriteria: {
      minAge: 21,
      maxAge: 60,
      minIncome: 3000,
      minEmploymentMonths: 6,
      minCreditScore: 0,
      employmentTypes: ['permanent', 'contract', 'self_employed']
    },
    gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'none' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    requiresApproval: true,
    approvalLevels: 2,
    marketingInfo: {
      highlights: ['Quick approval', 'Flexible repayment', 'No hidden fees', 'Competitive rates'],
      targetAudience: 'Salaried employees seeking personal financing',
      competitiveAdvantages: ['Lower rates than market average', '24-hour approval']
    }
  },
  {
    name: 'Business Loan - Growth',
    description: 'Capital for business expansion, equipment purchase, or working capital needs',
    category: 'business',
    interestRate: { min: 15, max: 30, default: 22 },
    term: { min: 12, max: 84, default: 36 },
    amount: { min: 10000, max: 500000, currency: 'ZMW' },
    interestCalculation: { method: 'reducing_balance', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly', 'quarterly'],
    fees: {
      processingFee: { type: 'percentage', amount: 3 },
      latePenalty: { type: 'percentage', amount: 7 },
      earlySettlementFee: { type: 'percentage', amount: 2 },
      insuranceFee: { type: 'percentage', amount: 1, required: true }
    },
    collateralRequired: true,
    collateralTypes: ['property', 'equipment', 'inventory', 'guarantor'],
    eligibilityCriteria: {
      minAge: 25,
      maxAge: 65,
      minIncome: 10000,
      minEmploymentMonths: 24,
      minCreditScore: 500,
      employmentTypes: ['self_employed', 'business_owner']
    },
    gracePeriod: { allowed: true, maxMonths: 3, interestDuring: 'accrued' },
    prepayment: { allowed: true, penalty: true, penaltyRate: 2 },
    requiresApproval: true,
    approvalLevels: 3,
    marketingInfo: {
      highlights: ['Large loan amounts', 'Extended terms', 'Grace period available', 'Business advisory support'],
      targetAudience: 'SMEs and entrepreneurs seeking growth capital',
      competitiveAdvantages: ['Flexible collateral options', 'Expert business advice included']
    }
  },
  {
    name: 'Payday Loan - Express',
    description: 'Short-term emergency loan until your next paycheck arrives',
    category: 'payday',
    interestRate: { min: 60, max: 96, default: 84 },
    term: { min: 1, max: 3, default: 1 },
    amount: { min: 500, max: 5000, currency: 'ZMW' },
    interestCalculation: { method: 'flat_rate', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 5 },
      latePenalty: { type: 'percentage', amount: 10 },
      earlySettlementFee: { type: 'fixed', amount: 0 },
      insuranceFee: { type: 'fixed', amount: 0, required: false }
    },
    collateralRequired: false,
    eligibilityCriteria: {
      minAge: 18,
      maxAge: 65,
      minIncome: 2000,
      minEmploymentMonths: 3,
      minCreditScore: 0,
      employmentTypes: ['permanent', 'contract']
    },
    gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'none' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    requiresApproval: true,
    approvalLevels: 1,
    marketingInfo: {
      highlights: ['Same-day approval', 'No collateral', 'Minimal documentation', 'Instant disbursement'],
      targetAudience: 'Employees facing short-term cash needs',
      competitiveAdvantages: ['Fastest approval process', 'Low fees']
    }
  },
  {
    name: 'Bridge Loan - Property',
    description: 'Short-term financing bridging gap between property purchase and sale',
    category: 'bridge',
    interestRate: { min: 18, max: 36, default: 24 },
    term: { min: 3, max: 12, default: 6 },
    amount: { min: 50000, max: 1000000, currency: 'ZMW' },
    interestCalculation: { method: 'simple_interest', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 4 },
      latePenalty: { type: 'percentage', amount: 8 },
      earlySettlementFee: { type: 'percentage', amount: 0 },
      insuranceFee: { type: 'percentage', amount: 0, required: false }
    },
    collateralRequired: true,
    collateralTypes: ['property'],
    eligibilityCriteria: {
      minAge: 25,
      maxAge: 65,
      minIncome: 15000,
      minEmploymentMonths: 12,
      minCreditScore: 600,
      employmentTypes: ['permanent', 'self_employed', 'business_owner']
    },
    gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'none' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    requiresApproval: true,
    approvalLevels: 3,
    marketingInfo: {
      highlights: ['Interest-only payments', 'Quick closing', 'No prepayment penalty', 'Large amounts'],
      targetAudience: 'Property buyers/sellers needing transitional financing',
      competitiveAdvantages: ['Flexible exit options', 'Fast approval for property transactions']
    }
  },
  {
    name: 'Microfinance Loan - Starter',
    description: 'Small loans for microenterprises and income-generating activities',
    category: 'microfinance',
    interestRate: { min: 20, max: 35, default: 28 },
    term: { min: 3, max: 24, default: 12 },
    amount: { min: 500, max: 20000, currency: 'ZMW' },
    interestCalculation: { method: 'flat_rate', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['weekly', 'bi_weekly', 'monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 1 },
      latePenalty: { type: 'fixed', amount: 50 },
      earlySettlementFee: { type: 'fixed', amount: 0 },
      insuranceFee: { type: 'percentage', amount: 0.5, required: false }
    },
    collateralRequired: false,
    collateralTypes: ['guarantor'],
    eligibilityCriteria: {
      minAge: 18,
      maxAge: 70,
      minIncome: 500,
      minEmploymentMonths: 0,
      minCreditScore: 0,
      employmentTypes: ['self_employed', 'business_owner', 'unemployed']
    },
    gracePeriod: { allowed: true, maxMonths: 1, interestDuring: 'capitalized' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    requiresApproval: true,
    approvalLevels: 1,
    marketingInfo: {
      highlights: ['No collateral required', 'Group lending available', 'Flexible repayment', 'Low entry barrier'],
      targetAudience: 'Micro-entrepreneurs and informal sector workers',
      competitiveAdvantages: ['Community-based lending', 'Financial literacy training included']
    }
  },
  {
    name: 'Auto Loan - Vehicle Finance',
    description: 'Competitive financing for new and used vehicle purchases',
    category: 'auto',
    interestRate: { min: 14, max: 22, default: 18 },
    term: { min: 12, max: 72, default: 48 },
    amount: { min: 20000, max: 300000, currency: 'ZMW' },
    interestCalculation: { method: 'reducing_balance', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 2 },
      latePenalty: { type: 'percentage', amount: 5 },
      earlySettlementFee: { type: 'percentage', amount: 1.5 },
      insuranceFee: { type: 'percentage', amount: 2, required: true }
    },
    collateralRequired: true,
    collateralTypes: ['vehicle'],
    eligibilityCriteria: {
      minAge: 21,
      maxAge: 65,
      minIncome: 5000,
      minEmploymentMonths: 12,
      minCreditScore: 550,
      employmentTypes: ['permanent', 'contract', 'self_employed']
    },
    gracePeriod: { allowed: false, maxMonths: 0, interestDuring: 'none' },
    prepayment: { allowed: true, penalty: true, penaltyRate: 1.5 },
    requiresApproval: true,
    approvalLevels: 2,
    marketingInfo: {
      highlights: ['Up to 80% financing', 'Comprehensive insurance included', 'Extended terms', 'New and used vehicles'],
      targetAudience: 'Individuals seeking vehicle ownership',
      competitiveAdvantages: ['Direct dealership partnerships', 'Free vehicle inspection']
    }
  },
  {
    name: 'Education Loan - Student Finance',
    description: 'Funding for tuition, accommodation, and educational expenses',
    category: 'education',
    interestRate: { min: 10, max: 18, default: 14 },
    term: { min: 12, max: 60, default: 36 },
    amount: { min: 5000, max: 150000, currency: 'ZMW' },
    interestCalculation: { method: 'interest_only', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly'],
    fees: {
      processingFee: { type: 'percentage', amount: 1.5 },
      latePenalty: { type: 'percentage', amount: 3 },
      earlySettlementFee: { type: 'fixed', amount: 0 },
      insuranceFee: { type: 'percentage', amount: 0, required: false }
    },
    collateralRequired: false,
    collateralTypes: ['guarantor'],
    eligibilityCriteria: {
      minAge: 18,
      maxAge: 35,
      minIncome: 0,
      minEmploymentMonths: 0,
      minCreditScore: 0,
      employmentTypes: ['permanent', 'contract', 'self_employed', 'unemployed']
    },
    gracePeriod: { allowed: true, maxMonths: 12, interestDuring: 'capitalized' },
    prepayment: { allowed: true, penalty: false, penaltyRate: 0 },
    requiresApproval: true,
    approvalLevels: 2,
    marketingInfo: {
      highlights: ['Grace period during studies', 'No income requirement', 'Covers all education costs', 'Parent/guardian co-signing'],
      targetAudience: 'Students and parents seeking education financing',
      competitiveAdvantages: ['Lowest interest rates', 'Flexible grace periods', 'No prepayment penalties']
    }
  }
];

async function seedProducts() {
  try {
    await connectDB();
    
    console.log('Fetching lender companies...');
    const lenders = await Company.find({ type: 'lender' });
    
    if (lenders.length === 0) {
      console.log('No lender companies found. Please seed companies first.');
      process.exit(1);
    }
    
    console.log(`Found ${lenders.length} lender companies`);
    
    // Clear existing products
    await LoanProduct.deleteMany({});
    console.log('Cleared existing products');
    
    // Create products for each lender
    let totalCreated = 0;
    
    for (const lender of lenders) {
      console.log(`\nCreating products for ${lender.name}...`);
      
      for (const template of productTemplates) {
        const product = new LoanProduct({
          ...template,
          company: lender._id,
          isActive: true
        });
        
        await product.save();
        totalCreated++;
        console.log(`  ✓ Created: ${product.name}`);
      }
    }
    
    console.log(`\n✅ Successfully created ${totalCreated} products`);
    console.log(`📊 ${productTemplates.length} product templates × ${lenders.length} lenders`);
    
    // Display summary
    const summary = await LoanProduct.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Products by Category:');
    summary.forEach(item => {
      console.log(`  ${item._id}: ${item.count}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
}

// Run seeder
seedProducts();
