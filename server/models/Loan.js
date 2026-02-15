const mongoose = require('mongoose');
const {
  calculatePeriodInterest,
  getNextPaymentDate,
  getDaysInPeriod,
  addMonths,
  calculateFlatRatePayment,
  calculateSimpleInterest,
  calculateSimpleInterestPayment,
  calculateInterestOnlyPayment
} = require('../utils/interestCalculator');

const loanSchema = new mongoose.Schema({
  // Basic loan information
  loanNumber: {
    type: String,
    unique: true,
    trim: true
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Applicant is required']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  lenderCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Lender company is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanProduct'
  },
  
  // Loan details
  amount: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [100, 'Minimum loan amount is 100'],
    max: [1000000, 'Maximum loan amount is 1,000,000']
  },
  interestRate: {
    type: Number,
    required: [true, 'Interest rate is required'],
    min: [0, 'Interest rate cannot be negative'],
    max: [100, 'Interest rate cannot exceed 100%']
  },
  term: {
    type: Number,
    required: [true, 'Loan term is required'],
    min: [1, 'Minimum term is 1 month'],
    max: [60, 'Maximum term is 60 months']
  },
  purpose: {
    type: String,
    required: [true, 'Loan purpose is required'],
    trim: true,
    maxlength: [200, 'Purpose cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Interest calculation configuration
  interestCalculation: {
    method: {
      type: String,
      enum: ['reducing_balance', 'flat_rate', 'simple_interest', 'interest_only'],
      default: 'reducing_balance',
      required: true
    },
    accrualBasis: {
      type: String,
      enum: ['actual/365', 'actual/360', '30/360'],
      default: 'actual/365',
      required: true
    },
    accrualFrequency: {
      type: String,
      enum: ['daily', 'monthly'],
      default: 'daily',
      required: true
    }
  },
  
  // Repayment frequency
  repaymentFrequency: {
    type: String,
    enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly'],
    default: 'monthly',
    required: true
  },
  
  monthlyIncome: {
    type: Number,
    min: [0, 'Monthly income cannot be negative']
  },
  collateral: {
    value: {
      type: Number,
      min: [0, 'Collateral value cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Collateral description cannot exceed 500 characters']
    }
  },
  
  // Fees
  fees: {
    processing: {
      type: Number,
      default: 0,
      min: [0, 'Processing fee cannot be negative']
    },
    insurance: {
      type: Number,
      default: 0,
      min: [0, 'Insurance fee cannot be negative']
    }
  },
  
  // Calculated fields
  totalAmount: {
    type: Number
  },
  monthlyPayment: {
    type: Number
  },
  totalInterest: {
    type: Number
  },
  
  // Status and workflow
  status: {
    type: String,
    enum: [
      'pending_approval',
      'pending_documents',
      'under_review',
      'approved',
      'rejected',
      'pending_disbursement',
      'disbursed',
      'active',
      'in_arrears',
      'defaulted',
      'completed',
      'cancelled'
    ],
    default: 'pending_approval'
  },
  
  // Approval information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Approval notes cannot exceed 500 characters']
  },
  
  // Disbursement information
  disbursedAt: {
    type: Date
  },
  disbursedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  disbursementMethod: {
    type: String,
    enum: ['bank_transfer', 'mobile_money', 'cash', 'payroll_deduction'],
    default: 'bank_transfer'
  },
  
  // Repayment schedule
  repaymentSchedule: [{
    installmentNumber: {
      type: Number,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    principal: {
      type: Number,
      required: true
    },
    interest: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'partial'],
      default: 'pending'
    },
    paidAt: {
      type: Date
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    // Payment tracking details
    paymentDate: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'cheque', 'mobile_money', 'direct_debit', 'standing_order', 'other']
    },
    referenceNumber: {
      type: String,
      trim: true
    },
    paymentNotes: {
      type: String,
      trim: true
    },
    isBalloonPayment: {
      type: Boolean,
      default: false
    }
  }],
  
  // Prepayment tracking
  prepayments: [{
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Prepayment amount must be greater than zero']
    },
    date: {
      type: Date,
      default: Date.now,
      required: true
    },
    allocationStrategy: {
      type: String,
      enum: ['reduce_term', 'reduce_payment'],
      required: true
    },
    principalPortion: {
      type: Number,
      required: true,
      min: [0, 'Principal portion cannot be negative']
    },
    interestPortion: {
      type: Number,
      required: true,
      min: [0, 'Interest portion cannot be negative']
    },
    feePortion: {
      type: Number,
      default: 0,
      min: [0, 'Fee portion cannot be negative']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Prepayment notes cannot exceed 500 characters']
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Early settlement information
  earlySettlement: {
    settled: {
      type: Boolean,
      default: false
    },
    settlementDate: {
      type: Date
    },
    settlementAmount: {
      type: Number,
      min: [0, 'Settlement amount cannot be negative']
    },
    earlySettlementFee: {
      type: Number,
      default: 0,
      min: [0, 'Early settlement fee cannot be negative']
    },
    principalBalance: {
      type: Number,
      min: [0, 'Principal balance cannot be negative']
    },
    interestBalance: {
      type: Number,
      min: [0, 'Interest balance cannot be negative']
    },
    savingsRealized: {
      type: Number,
      default: 0
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Guarantor information (if required)
  guarantor: {
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    idNumber: {
      type: String,
      trim: true
    }
  },
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['id_document', 'payslip', 'bank_statement', 'other'],
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notes and comments
  notes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  applicationDate: {
    type: Date,
    default: Date.now
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  
  // Enhanced status field with more descriptive states
  // status: {
  //   type: String,
  //   enum: [
  //     'pending_approval',
  //     'pending_documents',
  //     'under_review',
  //     'approved',
  //     'rejected',
  //     'pending_disbursement',
  //     'disbursed',
  //     'active',
  //     'in_arrears',
  //     'defaulted',
  //     'completed',
  //     'cancelled'
  //   ],
  //   default: 'pending_approval'
  // },

  // Add risk assessment
  riskAssessment: {
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    category: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: function() {
        return !!this.riskAssessment?.score;
      }
    },
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assessedAt: Date
  },

  // Add rejection details
  rejectionDetails: {
    reason: {
      type: String,
      trim: true
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date
  },

  // Add payment tracking
  paymentTracking: {
    totalPaid: {
      type: Number,
      default: 0
    },
    lastPaymentDate: Date,
    daysInArrears: {
      type: Number,
      default: 0
    },
    missedPayments: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Generate loan number before saving
loanSchema.pre('save', async function(next) {
  console.log('Loan pre-save hook triggered for:', this._id, this.amount, this.term);
  if (this.isNew && !this.loanNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({ 
      applicationDate: { 
        $gte: new Date(year, 0, 1), 
        $lt: new Date(year + 1, 0, 1) 
      } 
    });
    this.loanNumber = `LN${year}${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Calculate loan details if amount, interest rate, or term changes
  if (this.isModified('amount') || this.isModified('interestRate') || this.isModified('term')) {
    this.calculateLoanDetails();
  }
  
  // Update payment tracking
  if (this.isModified('repaymentSchedule')) {
    this.updatePaymentTracking();
    this.checkArrearsStatus();
  }
  
  next();
});

// Virtual fields for easy access to fee calculations
loanSchema.virtual('processingFee').get(function() {
  return this.fees?.processing || 0;
});

loanSchema.virtual('insuranceFee').get(function() {
  return this.fees?.insurance || 0;
});

loanSchema.virtual('totalUpfrontFees').get(function() {
  return (this.fees?.processing || 0) + (this.fees?.insurance || 0);
});

loanSchema.virtual('netDisbursement').get(function() {
  return this.amount - this.totalUpfrontFees;
});

// Ensure virtuals are included in JSON/Object output
loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

// Calculate loan details using daily interest accrual
loanSchema.methods.calculateLoanDetails = function() {
  const principal = this.amount;
  const annualRate = this.interestRate;
  const term = this.term;
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  const frequency = this.repaymentFrequency || 'monthly';
  const method = this.interestCalculation?.method || 'reducing_balance';
  
  // For zero interest loans
  if (annualRate === 0) {
    this.monthlyPayment = principal / term;
    this.totalInterest = 0;
    this.totalAmount = principal;
    this.generateRepaymentSchedule();
    return;
  }
  
  // Calculate based on method
  if (method === 'flat_rate') {
    // Flat rate: Interest = Principal × Rate × Time
    const result = calculateFlatRatePayment(principal, annualRate, term);
    this.monthlyPayment = result.monthlyPayment;
    this.totalInterest = result.totalInterest;
    this.totalAmount = principal + this.totalInterest;
  } else if (method === 'simple_interest') {
    // Simple interest: Interest on original principal per period
    const result = calculateSimpleInterestPayment(principal, annualRate, term, frequency, accrualBasis);
    this.monthlyPayment = result.averagePayment;
    this.totalInterest = result.totalInterest;
    this.totalAmount = principal + this.totalInterest;
  } else if (method === 'interest_only') {
    // Interest only: Pay interest each period, principal at end
    const result = calculateInterestOnlyPayment(principal, annualRate, term, frequency, accrualBasis);
    this.monthlyPayment = result.interestPayment;
    this.totalInterest = result.totalInterest;
    this.totalAmount = principal + this.totalInterest;
  } else if (frequency === 'monthly') {
    // For monthly frequency, use standard amortization formula
    const monthlyRate = annualRate / 100 / 12;
    this.monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                          (Math.pow(1 + monthlyRate, term) - 1);
    this.totalInterest = (this.monthlyPayment * term) - principal;
    this.totalAmount = principal + this.totalInterest;
  } else {
    // For other frequencies, calculate based on payment periods
    const periodsPerYear = frequency === 'bi_weekly' ? 26 : frequency === 'weekly' ? 52 : 12;
    const periodRate = annualRate / 100 / periodsPerYear;
    const totalPeriods = term; // Assuming term is already in correct periods
    
    this.monthlyPayment = (principal * periodRate * Math.pow(1 + periodRate, totalPeriods)) / 
                          (Math.pow(1 + periodRate, totalPeriods) - 1);
    this.totalInterest = (this.monthlyPayment * totalPeriods) - principal;
    this.totalAmount = principal + this.totalInterest;
  }
  
  // Generate repayment schedule with accurate dates
  this.generateRepaymentSchedule();
};

// Generate repayment schedule with actual day calculations
loanSchema.methods.generateRepaymentSchedule = function() {
  const method = this.interestCalculation?.method || 'reducing_balance';
  
  if (method === 'flat_rate') {
    return this.generateFlatRateSchedule();
  } else if (method === 'simple_interest') {
    return this.generateSimpleInterestSchedule();
  } else if (method === 'interest_only') {
    return this.generateInterestOnlySchedule();
  } else {
    return this.generateReducingBalanceSchedule();
  }
};

// Generate schedule for reducing balance loans
loanSchema.methods.generateReducingBalanceSchedule = function() {
  const schedule = [];
  const paymentAmount = this.monthlyPayment;
  let remainingPrincipal = this.amount;
  const annualRate = this.interestRate;
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  const frequency = this.repaymentFrequency || 'monthly';
  
  // Start date for schedule (use disbursement date or current date)
  let currentDate = this.disbursedAt || new Date();
  
  for (let i = 1; i <= this.term; i++) {
    // Calculate next payment date
    const dueDate = getNextPaymentDate(currentDate, frequency);
    
    // Calculate interest for this period using actual days
    const periodInterest = calculatePeriodInterest(
      remainingPrincipal,
      annualRate,
      currentDate,
      dueDate,
      accrualBasis
    );
    
    // Calculate principal portion
    const principalPortion = paymentAmount - periodInterest;
    
    // Ensure we don't have negative principal in last payment
    const actualPrincipal = Math.min(principalPortion, remainingPrincipal);
    const actualInterest = i === this.term ? 
      (paymentAmount - actualPrincipal) : periodInterest;
    
    remainingPrincipal -= actualPrincipal;
    
    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: i === this.term && remainingPrincipal > 0 ? 
        actualPrincipal + actualInterest : paymentAmount,
      principal: actualPrincipal,
      interest: actualInterest,
      status: 'pending',
      paidAmount: 0
    });
    
    currentDate = dueDate;
  }
  
  this.repaymentSchedule = schedule;
};

// Generate schedule for flat rate loans
loanSchema.methods.generateFlatRateSchedule = function() {
  const schedule = [];
  const paymentAmount = this.monthlyPayment;
  const principal = this.amount;
  const totalInterest = this.totalInterest;
  const term = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  
  // In flat rate, principal and interest are divided equally across installments
  const principalPerInstallment = principal / term;
  const interestPerInstallment = totalInterest / term;
  
  const startDate = this.disbursedAt || new Date();
  let currentDate = new Date(startDate);
  let remainingPrincipal = principal;
  
  for (let i = 1; i <= term; i++) {
    // Calculate next payment date
    const dueDate = getNextPaymentDate(currentDate, frequency);
    
    // For flat rate, principal and interest are fixed per installment
    remainingPrincipal -= principalPerInstallment;
    
    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: paymentAmount,
      principal: principalPerInstallment,
      interest: interestPerInstallment,
      status: 'pending',
      paidAmount: 0
    });
    
    currentDate = dueDate;
  }
  
  this.repaymentSchedule = schedule;
};

// Generate schedule for simple interest loans
loanSchema.methods.generateSimpleInterestSchedule = function() {
  const schedule = [];
  const principal = this.amount;
  const annualRate = this.interestRate;
  const term = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  
  // In simple interest, interest is calculated on original principal per period
  const principalPerInstallment = principal / term;
  
  const startDate = this.disbursedAt || new Date();
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= term; i++) {
    // Calculate next payment date
    const dueDate = getNextPaymentDate(currentDate, frequency);
    
    // Calculate interest for this period on ORIGINAL principal
    const periodInterest = calculateSimpleInterest(
      principal,  // Note: Always use original principal, not remaining
      annualRate,
      currentDate,
      dueDate,
      accrualBasis
    );
    
    const paymentAmount = principalPerInstallment + periodInterest;
    
    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: paymentAmount,
      principal: principalPerInstallment,
      interest: periodInterest,
      status: 'pending',
      paidAmount: 0
    });
    
    currentDate = dueDate;
  }
  
  this.repaymentSchedule = schedule;
};

// Generate schedule for interest-only loans
loanSchema.methods.generateInterestOnlySchedule = function() {
  const schedule = [];
  const principal = this.amount;
  const annualRate = this.interestRate;
  const term = this.term;
  const frequency = this.repaymentFrequency || 'monthly';
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  
  const startDate = this.disbursedAt || new Date();
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= term; i++) {
    // Calculate next payment date
    const dueDate = getNextPaymentDate(currentDate, frequency);
    
    // Calculate interest for this period on original principal
    const periodInterest = calculateSimpleInterest(
      principal,
      annualRate,
      currentDate,
      dueDate,
      accrualBasis
    );
    
    // For interest-only, only interest is paid until last payment
    const isLastPayment = (i === term);
    const paymentAmount = isLastPayment ? principal + periodInterest : periodInterest;
    const principalPaid = isLastPayment ? principal : 0;
    
    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: paymentAmount,
      principal: principalPaid,
      interest: periodInterest,
      status: 'pending',
      paidAmount: 0,
      isBalloonPayment: isLastPayment
    });
    
    currentDate = dueDate;
  }
  
  this.repaymentSchedule = schedule;
};

// Get loan summary
loanSchema.methods.getSummary = function() {
  const paidInstallments = this.repaymentSchedule.filter(installment => 
    installment.status === 'paid'
  );
  
  const totalPaid = paidInstallments.reduce((sum, installment) => 
    sum + installment.paidAmount, 0
  );
  
  const overdueInstallments = this.repaymentSchedule.filter(installment => 
    installment.status === 'overdue' && new Date() > installment.dueDate
  );
  
  return {
    totalAmount: this.totalAmount,
    totalPaid: totalPaid,
    remainingBalance: this.totalAmount - totalPaid,
    overdueAmount: overdueInstallments.reduce((sum, installment) => 
      sum + (installment.amount - installment.paidAmount), 0
    ),
    nextPayment: this.repaymentSchedule.find(installment => 
      installment.status === 'pending'
    )
  };
};

// Check if loan can be approved
loanSchema.methods.canBeApproved = function() {
  return this.status === 'pending' || this.status === 'pending_approval';
};

// Check if loan can be disbursed
loanSchema.methods.canBeDisbursed = function() {
  // A loan can be disbursed if it's approved
  return this.status === 'approved';
};

// Add method to update payment tracking
loanSchema.methods.updatePaymentTracking = function() {
  const summary = this.getSummary();
  this.paymentTracking = {
    totalPaid: summary.totalPaid,
    lastPaymentDate: this.repaymentSchedule
      .filter(i => i.status === 'paid')
      .sort((a, b) => b.paidAt - a.paidAt)[0]?.paidAt,
    daysInArrears: this.calculateDaysInArrears(),
    missedPayments: this.repaymentSchedule.filter(i => i.status === 'overdue').length
  };
};

// Add method to calculate days in arrears
loanSchema.methods.calculateDaysInArrears = function() {
  const overdueInstallment = this.repaymentSchedule
      .find(i => i.status === 'overdue');
  
  if (!overdueInstallment) return 0;
  
  const now = new Date();
  const dueDate = new Date(overdueInstallment.dueDate);
  const diffTime = Math.abs(now - dueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Add method to check if loan is in arrears
loanSchema.methods.checkArrearsStatus = function() {
  const daysInArrears = this.calculateDaysInArrears();
  if (daysInArrears > 90) {
      this.status = 'defaulted';
  } else if (daysInArrears > 0) {
      this.status = 'in_arrears';
  }
};

// ============================================================
// PREPAYMENT & EARLY SETTLEMENT METHODS
// ============================================================

/**
 * Check if loan can accept prepayments
 * @returns {boolean} True if loan is active and not settled
 */
loanSchema.methods.canAcceptPrepayment = function() {
  // Can only prepay active loans that haven't been settled
  if (this.earlySettlement?.settled) {
    return false;
  }
  
  // Can accept prepayments if loan is active or disbursed
  const acceptableStatuses = ['active', 'disbursed', 'in_arrears'];
  return acceptableStatuses.includes(this.status);
};

/**
 * Calculate remaining principal balance
 * Takes into account all payments made and prepayments
 * @returns {number} Remaining principal balance in ZMW
 */
loanSchema.methods.calculateRemainingBalance = function() {
  // Start with original principal
  let remainingBalance = this.amount;
  
  // Subtract principal portions from regular payments
  this.repaymentSchedule.forEach(installment => {
    if (installment.status === 'paid') {
      remainingBalance -= installment.principal;
    }
  });
  
  // Subtract principal portions from prepayments
  if (this.prepayments && this.prepayments.length > 0) {
    this.prepayments.forEach(prepayment => {
      remainingBalance -= prepayment.principalPortion;
    });
  }
  
  // Ensure we don't return negative balance
  return Math.max(0, remainingBalance);
};

/**
 * Calculate accrued interest to date
 * @param {Date} asOfDate - Calculate interest up to this date (defaults to today)
 * @returns {number} Accrued interest in ZMW
 */
loanSchema.methods.calculateAccruedInterest = function(asOfDate = new Date()) {
  let accruedInterest = 0;
  
  // Sum up interest from paid installments
  this.repaymentSchedule.forEach(installment => {
    if (installment.status === 'paid' && installment.paidAt <= asOfDate) {
      accruedInterest += installment.interest;
    } else if (installment.dueDate <= asOfDate && installment.status !== 'paid') {
      // Include interest from overdue installments
      accruedInterest += installment.interest;
    }
  });
  
  // Subtract interest portions from prepayments
  if (this.prepayments && this.prepayments.length > 0) {
    this.prepayments.forEach(prepayment => {
      if (prepayment.date <= asOfDate) {
        accruedInterest -= prepayment.interestPortion;
      }
    });
  }
  
  return Math.max(0, accruedInterest);
};

/**
 * Calculate early settlement amount with fees
 * @param {Date} settlementDate - Proposed settlement date (defaults to today)
 * @returns {Object} Settlement breakdown with all amounts
 */
loanSchema.methods.calculateEarlySettlementAmount = function(settlementDate = new Date()) {
  const remainingPrincipal = this.calculateRemainingBalance();
  const accruedInterest = this.calculateAccruedInterest(settlementDate);
  
  // Calculate early settlement fee from product if available
  let earlySettlementFee = 0;
  if (this.product && this.populated('product')) {
    const product = this.product;
    if (product.fees && product.fees.earlySettlement) {
      const feeConfig = product.fees.earlySettlement;
      if (feeConfig.type === 'percentage') {
        earlySettlementFee = (remainingPrincipal * feeConfig.value) / 100;
      } else if (feeConfig.type === 'fixed') {
        earlySettlementFee = feeConfig.value;
      }
    }
  }
  
  // Calculate total payoff amount
  const totalPayoff = remainingPrincipal + accruedInterest + earlySettlementFee;
  
  // Calculate interest savings vs continuing with original schedule
  let futureInterest = 0;
  this.repaymentSchedule.forEach(installment => {
    if (installment.status === 'pending' && installment.dueDate > settlementDate) {
      futureInterest += installment.interest;
    }
  });
  
  const savingsVsSchedule = futureInterest - accruedInterest - earlySettlementFee;
  
  return {
    principalBalance: parseFloat(remainingPrincipal.toFixed(2)),
    interestBalance: parseFloat(accruedInterest.toFixed(2)),
    earlySettlementFee: parseFloat(earlySettlementFee.toFixed(2)),
    totalPayoff: parseFloat(totalPayoff.toFixed(2)),
    futureInterestSaved: parseFloat(Math.max(0, savingsVsSchedule).toFixed(2)),
    settlementDate: settlementDate
  };
};

/**
 * Record a prepayment and allocate it to principal/interest
 * @param {number} amount - Prepayment amount in ZMW
 * @param {string} strategy - 'reduce_term' or 'reduce_payment'
 * @param {ObjectId} userId - User recording the prepayment
 * @param {string} notes - Optional notes
 * @returns {Object} Prepayment record
 */
loanSchema.methods.recordPrepayment = function(amount, strategy, userId, notes = '') {
  if (!this.canAcceptPrepayment()) {
    throw new Error('Loan cannot accept prepayments in current status');
  }
  
  if (amount <= 0) {
    throw new Error('Prepayment amount must be greater than zero');
  }
  
  // Calculate accrued interest to allocate properly
  const accruedInterest = this.calculateAccruedInterest();
  const remainingBalance = this.calculateRemainingBalance();
  
  // Allocate payment: interest first, then principal
  let interestPortion = Math.min(amount, accruedInterest);
  let principalPortion = amount - interestPortion;
  
  // Ensure we don't overpay principal
  principalPortion = Math.min(principalPortion, remainingBalance);
  
  // Create prepayment record
  const prepayment = {
    amount: parseFloat(amount.toFixed(2)),
    date: new Date(),
    allocationStrategy: strategy,
    principalPortion: parseFloat(principalPortion.toFixed(2)),
    interestPortion: parseFloat(interestPortion.toFixed(2)),
    feePortion: 0, // Can be used for late fees in future
    notes: notes,
    recordedBy: userId
  };
  
  // Add to prepayments array
  if (!this.prepayments) {
    this.prepayments = [];
  }
  this.prepayments.push(prepayment);
  
  return prepayment;
};

/**
 * Recalculate repayment schedule after prepayment
 * Generates new schedule based on remaining balance and chosen strategy
 * @param {string} strategy - 'reduce_term' or 'reduce_payment'
 * @returns {Array} New repayment schedule
 */
loanSchema.methods.recalculateSchedule = function(strategy = 'reduce_term') {
  if (!['reduce_term', 'reduce_payment'].includes(strategy)) {
    throw new Error('Strategy must be either "reduce_term" or "reduce_payment"');
  }
  
  // Calculate current remaining balance
  const remainingBalance = this.calculateRemainingBalance();
  
  if (remainingBalance <= 0) {
    // Loan is fully paid, no schedule needed
    this.repaymentSchedule = [];
    return [];
  }
  
  // Count paid installments to determine where we are in the schedule
  const paidInstallments = this.repaymentSchedule.filter(i => i.status === 'paid').length;
  const remainingTerm = this.term - paidInstallments;
  
  if (remainingTerm <= 0) {
    // No more installments
    this.repaymentSchedule = this.repaymentSchedule.filter(i => i.status === 'paid');
    return this.repaymentSchedule;
  }
  
  // Get the last payment date or disbursement date as starting point
  const lastPaidInstallment = this.repaymentSchedule
    .filter(i => i.status === 'paid')
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];
  
  const startDate = lastPaidInstallment 
    ? new Date(lastPaidInstallment.paidAt)
    : (this.disbursedAt || new Date());
  
  const method = this.interestCalculation?.method || 'reducing_balance';
  const annualRate = this.interestRate;
  const frequency = this.repaymentFrequency || 'monthly';
  
  let newSchedule = [];
  
  // Generate new schedule based on method
  if (method === 'reducing_balance') {
    newSchedule = this._recalculateReducingBalanceSchedule(
      remainingBalance,
      remainingTerm,
      annualRate,
      frequency,
      startDate,
      paidInstallments,
      strategy
    );
  } else if (method === 'flat_rate') {
    newSchedule = this._recalculateFlatRateSchedule(
      remainingBalance,
      remainingTerm,
      annualRate,
      frequency,
      startDate,
      paidInstallments,
      strategy
    );
  } else if (method === 'simple_interest') {
    newSchedule = this._recalculateSimpleInterestSchedule(
      remainingBalance,
      remainingTerm,
      annualRate,
      frequency,
      startDate,
      paidInstallments,
      strategy
    );
  } else if (method === 'interest_only') {
    newSchedule = this._recalculateInterestOnlySchedule(
      remainingBalance,
      remainingTerm,
      annualRate,
      frequency,
      startDate,
      paidInstallments,
      strategy
    );
  }
  
  // Keep paid installments and append new schedule
  const paidSchedule = this.repaymentSchedule.filter(i => i.status === 'paid');
  this.repaymentSchedule = [...paidSchedule, ...newSchedule];
  
  return this.repaymentSchedule;
};

/**
 * Recalculate reducing balance schedule
 * @private
 */
loanSchema.methods._recalculateReducingBalanceSchedule = function(
  remainingBalance, remainingTerm, annualRate, frequency, startDate, paidCount, strategy
) {
  const schedule = [];
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  const periodicRate = (annualRate / 100) / 12; // Monthly for now
  
  let newTerm = remainingTerm;
  let paymentAmount;
  
  if (strategy === 'reduce_term') {
    // Keep same payment amount, reduce term
    paymentAmount = this.monthlyPayment;
    
    // Calculate new term based on remaining balance using amortization formula
    if (periodicRate > 0 && paymentAmount > 0) {
      // Formula: n = -log(1 - r*P/A) / log(1 + r)
      // where P = principal, A = payment, r = rate
      const rateTimesPrincipal = periodicRate * remainingBalance;
      const denominator = paymentAmount - rateTimesPrincipal;
      
      // Safety check: payment must be greater than interest
      if (denominator > 0) {
        newTerm = Math.ceil(
          -Math.log(1 - rateTimesPrincipal / paymentAmount) / Math.log(1 + periodicRate)
        );
        
        // Ensure newTerm is reasonable
        if (newTerm > remainingTerm || newTerm < 1 || !isFinite(newTerm)) {
          newTerm = remainingTerm;
        }
      } else {
        // Payment is too small for the balance, use original term
        newTerm = remainingTerm;
      }
    } else if (periodicRate === 0) {
      // No interest, simple division
      newTerm = Math.ceil(remainingBalance / paymentAmount);
    }
  } else {
    // Keep same term, reduce payment amount
    if (periodicRate > 0) {
      paymentAmount = (remainingBalance * periodicRate * Math.pow(1 + periodicRate, remainingTerm)) / 
                      (Math.pow(1 + periodicRate, remainingTerm) - 1);
    } else {
      paymentAmount = remainingBalance / remainingTerm;
    }
  }
  
  let balance = remainingBalance;
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= newTerm; i++) {
    // Get next payment date
    currentDate = getNextPaymentDate(currentDate, frequency);
    
    // Calculate interest for this period
    const daysInPeriod = getDaysInPeriod(
      i === 1 ? startDate : new Date(schedule[i-2].dueDate),
      currentDate,
      accrualBasis
    );
    
    const interest = calculatePeriodInterest(
      balance,
      annualRate,
      daysInPeriod,
      accrualBasis
    );
    
    // For last installment, use exact remaining balance
    let principal, installmentAmount;
    if (i === newTerm || balance <= paymentAmount) {
      principal = balance;
      installmentAmount = principal + interest;
    } else {
      principal = paymentAmount - interest;
      installmentAmount = paymentAmount;
      
      // Safety check: principal can't be negative
      if (principal < 0) {
        principal = 0;
        installmentAmount = interest;
      }
    }
    
    schedule.push({
      installmentNumber: paidCount + i,
      dueDate: new Date(currentDate),
      amount: parseFloat(installmentAmount.toFixed(2)),
      principal: parseFloat(principal.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      status: 'pending',
      paidAmount: 0
    });
    
    balance -= principal;
    
    if (balance <= 0.01) break; // Stop if balance paid off
  }
  
  return schedule;
};

/**
 * Recalculate flat rate schedule
 * @private
 */
loanSchema.methods._recalculateFlatRateSchedule = function(
  remainingBalance, remainingTerm, annualRate, frequency, startDate, paidCount, strategy
) {
  const schedule = [];
  
  let newTerm = remainingTerm;
  
  // For flat rate, calculate total interest on remaining balance
  const totalInterest = (remainingBalance * annualRate / 100 * remainingTerm) / 12;
  const totalAmount = remainingBalance + totalInterest;
  
  let paymentAmount = totalAmount / remainingTerm;
  
  if (strategy === 'reduce_term') {
    // Keep similar payment, reduce term
    paymentAmount = this.monthlyPayment;
    newTerm = Math.ceil(totalAmount / paymentAmount);
    newTerm = Math.min(newTerm, remainingTerm);
  }
  
  const principalPerPayment = remainingBalance / newTerm;
  const interestPerPayment = totalInterest / newTerm;
  
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= newTerm; i++) {
    currentDate = getNextPaymentDate(currentDate, frequency);
    
    schedule.push({
      installmentNumber: paidCount + i,
      dueDate: new Date(currentDate),
      amount: parseFloat(paymentAmount.toFixed(2)),
      principal: parseFloat(principalPerPayment.toFixed(2)),
      interest: parseFloat(interestPerPayment.toFixed(2)),
      status: 'pending',
      paidAmount: 0
    });
  }
  
  return schedule;
};

/**
 * Recalculate simple interest schedule
 * @private
 */
loanSchema.methods._recalculateSimpleInterestSchedule = function(
  remainingBalance, remainingTerm, annualRate, frequency, startDate, paidCount, strategy
) {
  const schedule = [];
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  
  let newTerm = remainingTerm;
  const principalPerPayment = remainingBalance / remainingTerm;
  
  // Calculate average interest per period
  const totalInterest = (remainingBalance * annualRate / 100 * remainingTerm) / 12;
  let paymentAmount = (remainingBalance + totalInterest) / remainingTerm;
  
  if (strategy === 'reduce_term') {
    paymentAmount = this.monthlyPayment;
    newTerm = Math.ceil((remainingBalance + totalInterest) / paymentAmount);
    newTerm = Math.min(newTerm, remainingTerm);
  }
  
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= newTerm; i++) {
    currentDate = getNextPaymentDate(currentDate, frequency);
    
    const daysInPeriod = getDaysInPeriod(
      i === 1 ? startDate : new Date(schedule[i-2].dueDate),
      currentDate,
      accrualBasis
    );
    
    const interest = calculateSimpleInterest(
      remainingBalance,
      annualRate,
      daysInPeriod,
      accrualBasis
    );
    
    const principal = paymentAmount - interest;
    
    schedule.push({
      installmentNumber: paidCount + i,
      dueDate: new Date(currentDate),
      amount: parseFloat(paymentAmount.toFixed(2)),
      principal: parseFloat(principal.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      status: 'pending',
      paidAmount: 0
    });
  }
  
  return schedule;
};

/**
 * Recalculate interest-only schedule with balloon payment
 * @private
 */
loanSchema.methods._recalculateInterestOnlySchedule = function(
  remainingBalance, remainingTerm, annualRate, frequency, startDate, paidCount, strategy
) {
  const schedule = [];
  const accrualBasis = this.interestCalculation?.accrualBasis || 'actual/365';
  
  // For interest-only, strategy doesn't change much - still need full term
  // But we can adjust the balloon payment amount
  
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= remainingTerm; i++) {
    currentDate = getNextPaymentDate(currentDate, frequency);
    
    const daysInPeriod = getDaysInPeriod(
      i === 1 ? startDate : new Date(schedule[i-2].dueDate),
      currentDate,
      accrualBasis
    );
    
    const interest = calculatePeriodInterest(
      remainingBalance,
      annualRate,
      daysInPeriod,
      accrualBasis
    );
    
    const isFinalPayment = (i === remainingTerm);
    const principal = isFinalPayment ? remainingBalance : 0;
    const amount = principal + interest;
    
    schedule.push({
      installmentNumber: paidCount + i,
      dueDate: new Date(currentDate),
      amount: parseFloat(amount.toFixed(2)),
      principal: parseFloat(principal.toFixed(2)),
      interest: parseFloat(interest.toFixed(2)),
      status: 'pending',
      paidAmount: 0,
      isBalloonPayment: isFinalPayment
    });
  }
  
  return schedule;
};

module.exports = mongoose.model('Loan', loanSchema);