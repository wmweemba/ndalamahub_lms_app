const mongoose = require('mongoose');

const loanProductSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: {
      values: ['personal', 'business', 'payday', 'bridge', 'microfinance', 'mortgage', 'auto', 'education', 'other'],
      message: '{VALUE} is not a valid category'
    }
  },
  
  // Company Association (multi-tenant support)
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  
  // Interest Rate Configuration
  interestRate: {
    min: {
      type: Number,
      required: [true, 'Minimum interest rate is required'],
      min: [0, 'Interest rate cannot be negative'],
      max: [1000, 'Interest rate cannot exceed 1000%']
    },
    max: {
      type: Number,
      required: [true, 'Maximum interest rate is required'],
      min: [0, 'Interest rate cannot be negative'],
      max: [1000, 'Interest rate cannot exceed 1000%']
    },
    default: {
      type: Number,
      required: [true, 'Default interest rate is required'],
      min: [0, 'Interest rate cannot be negative'],
      max: [1000, 'Interest rate cannot exceed 1000%']
    }
  },

  // Loan Term Configuration (value interpreted in `unit` below; defaults to months)
  term: {
    min: {
      type: Number,
      required: [true, 'Minimum term is required'],
      min: [1, 'Minimum term must be at least 1 month']
    },
    max: {
      type: Number,
      required: [true, 'Maximum term is required'],
      min: [1, 'Maximum term must be at least 1 month']
    },
    default: {
      type: Number,
      required: [true, 'Default term is required'],
      min: [1, 'Default term must be at least 1 month']
    },
    // NOTE: isTermValid compares raw numeric term values, so this invariant
    // must hold: a loan's term is only valid against a product's min/max/default
    // when both are expressed in the same unit as this field.
    unit: {
      type: String,
      enum: {
        values: ['days', 'weeks', 'months'],
        message: '{VALUE} is not a valid term unit'
      },
      default: 'months'
    }
  },
  
  // Loan Amount Configuration
  amount: {
    min: {
      type: Number,
      required: [true, 'Minimum loan amount is required'],
      min: [0, 'Loan amount cannot be negative']
    },
    max: {
      type: Number,
      required: [true, 'Maximum loan amount is required'],
      min: [0, 'Loan amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'ZMW',
      enum: ['ZMW', 'USD', 'EUR', 'GBP']
    }
  },
  
  // Interest Calculation Method
  interestCalculation: {
    method: {
      type: String,
      required: [true, 'Interest calculation method is required'],
      enum: {
        values: ['reducing_balance', 'flat_rate', 'simple_interest', 'interest_only'],
        message: '{VALUE} is not a valid interest calculation method'
      },
      default: 'reducing_balance'
    },
    rateBasis: {
      type: String,
      enum: {
        values: ['per_annum', 'per_term', 'per_period'],
        message: '{VALUE} is not a valid rate basis'
      },
      default: 'per_annum'
    },
    dayCountConvention: {
      type: String,
      enum: ['actual/365', 'actual/360', '30/360'],
      default: 'actual/365'
    }
  },
  
  // Repayment Configuration
  repaymentFrequency: {
    type: [String],
    enum: {
      values: ['weekly', 'bi_weekly', 'monthly', 'quarterly', 'annually'],
      message: '{VALUE} is not a valid repayment frequency'
    },
    default: ['monthly'],
    validate: {
      validator: function(arr) {
        return arr && arr.length > 0;
      },
      message: 'At least one repayment frequency must be specified'
    }
  },
  
  // Fees Structure
  fees: {
    processingFee: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      amount: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    latePenalty: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      amount: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    earlySettlementFee: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      amount: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    insuranceFee: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      amount: {
        type: Number,
        min: 0,
        default: 0
      },
      required: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Collateral Requirements
  collateralRequired: {
    type: Boolean,
    default: false
  },
  
  collateralTypes: {
    type: [String],
    enum: ['property', 'vehicle', 'equipment', 'inventory', 'securities', 'guarantor', 'other']
  },
  
  // Eligibility Criteria
  eligibilityCriteria: {
    minAge: {
      type: Number,
      min: 18,
      default: 18
    },
    maxAge: {
      type: Number,
      max: 120,
      default: 65
    },
    minIncome: {
      type: Number,
      min: 0,
      default: 0
    },
    minEmploymentMonths: {
      type: Number,
      min: 0,
      default: 0
    },
    minCreditScore: {
      type: Number,
      min: 0,
      max: 999,
      default: 0
    },
    employmentTypes: {
      type: [String],
      enum: ['permanent', 'contract', 'self_employed', 'business_owner', 'unemployed'],
      default: ['permanent', 'contract', 'self_employed']
    }
  },
  
  // Grace Period Settings
  // NOTE (Phase 20): `interestDuring` and `prepayment.penalty`/`penaltyRate` below
  // are dormant — grepped as unreferenced outside server/utils/seedProducts.js
  // seed data, no route or model logic ever reads them. They predate and are
  // unrelated to the Phase 20 rollover mechanic (grace here is a moratorium
  // concept, not the rollover's 14-day no-charge window); left intact, not
  // repurposed or removed.
  gracePeriod: {
    allowed: {
      type: Boolean,
      default: false
    },
    maxMonths: {
      type: Number,
      min: 0,
      default: 0
    },
    interestDuring: {
      type: String,
      enum: ['none', 'accrued', 'capitalized'],
      default: 'accrued'
    }
  },

  // Prepayment Settings
  prepayment: {
    allowed: {
      type: Boolean,
      default: true
    },
    penalty: {
      type: Boolean,
      default: false
    },
    penaltyRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },

  // Rollover Settings (Phase 20) — capitalization of the outstanding balance
  // after a grace window past due, repeating until paid or manually defaulted.
  // Rate is deliberately not duplicated here: rollover always recapitalizes at
  // this product's own interestRate/rateBasis (the locked mechanic is "fresh
  // interest at the same rate"), so a second rate field would just be a second
  // source of truth for the same number.
  rollover: {
    enabled: {
      type: Boolean,
      default: false
    },
    graceDays: {
      type: Number,
      min: 0,
      default: 14
    }
  },
  
  // Product Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Approval Workflow
  requiresApproval: {
    type: Boolean,
    default: true
  },
  
  approvalLevels: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  
  // Marketing Information
  marketingInfo: {
    highlights: [{
      type: String,
      maxlength: 200
    }],
    targetAudience: {
      type: String,
      maxlength: 200
    },
    competitiveAdvantages: [{
      type: String,
      maxlength: 200
    }]
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
loanProductSchema.index({ company: 1, isActive: 1 });
loanProductSchema.index({ category: 1, isActive: 1 });
loanProductSchema.index({ name: 'text', description: 'text' });

// Validation: Ensure min <= default <= max for interest rates
loanProductSchema.pre('validate', function(next) {
  if (this.interestRate) {
    if (this.interestRate.min > this.interestRate.default) {
      return next(new Error('Default interest rate cannot be less than minimum'));
    }
    if (this.interestRate.default > this.interestRate.max) {
      return next(new Error('Default interest rate cannot exceed maximum'));
    }
  }
  
  if (this.term) {
    if (this.term.min > this.term.default) {
      return next(new Error('Default term cannot be less than minimum'));
    }
    if (this.term.default > this.term.max) {
      return next(new Error('Default term cannot exceed maximum'));
    }
  }
  
  if (this.amount) {
    if (this.amount.min > this.amount.max) {
      return next(new Error('Maximum loan amount cannot be less than minimum'));
    }
  }
  
  next();
});

// Virtual: Calculate effective interest rate range
loanProductSchema.virtual('effectiveRateRange').get(function() {
  return {
    min: this.interestRate.min,
    max: this.interestRate.max,
    spread: this.interestRate.max - this.interestRate.min
  };
});

// Method: Check if amount is within product limits
loanProductSchema.methods.isAmountValid = function(amount) {
  return amount >= this.amount.min && amount <= this.amount.max;
};

// Method: Check if term is within product limits
loanProductSchema.methods.isTermValid = function(term) {
  return term >= this.term.min && term <= this.term.max;
};

// Method: Check if rate is within product limits
loanProductSchema.methods.isRateValid = function(rate) {
  return rate >= this.interestRate.min && rate <= this.interestRate.max;
};

// Method: Calculate processing fee
loanProductSchema.methods.calculateProcessingFee = function(loanAmount) {
  if (!this.fees.processingFee) return 0;
  
  if (this.fees.processingFee.type === 'percentage') {
    return (loanAmount * this.fees.processingFee.amount) / 100;
  }
  return this.fees.processingFee.amount;
};

// Method: Calculate insurance fee
loanProductSchema.methods.calculateInsuranceFee = function(loanAmount) {
  if (!this.fees.insuranceFee || !this.fees.insuranceFee.required) return 0;
  
  if (this.fees.insuranceFee.type === 'percentage') {
    return (loanAmount * this.fees.insuranceFee.amount) / 100;
  }
  return this.fees.insuranceFee.amount;
};

// Method: Calculate total upfront fees
loanProductSchema.methods.calculateUpfrontFees = function(loanAmount) {
  const processingFee = this.calculateProcessingFee(loanAmount);
  const insuranceFee = this.calculateInsuranceFee(loanAmount);
  return processingFee + insuranceFee;
};

// Method: Check applicant eligibility
loanProductSchema.methods.checkEligibility = function(applicant) {
  const errors = [];
  
  if (applicant.age < this.eligibilityCriteria.minAge) {
    errors.push(`Applicant must be at least ${this.eligibilityCriteria.minAge} years old`);
  }
  
  if (applicant.age > this.eligibilityCriteria.maxAge) {
    errors.push(`Applicant cannot exceed ${this.eligibilityCriteria.maxAge} years old`);
  }
  
  if (applicant.monthlyIncome < this.eligibilityCriteria.minIncome) {
    errors.push(`Minimum monthly income requirement: ${this.amount.currency} ${this.eligibilityCriteria.minIncome}`);
  }
  
  if (applicant.employmentMonths < this.eligibilityCriteria.minEmploymentMonths) {
    errors.push(`Minimum employment duration: ${this.eligibilityCriteria.minEmploymentMonths} months`);
  }
  
  if (applicant.creditScore && applicant.creditScore < this.eligibilityCriteria.minCreditScore) {
    errors.push(`Minimum credit score requirement: ${this.eligibilityCriteria.minCreditScore}`);
  }
  
  if (!this.eligibilityCriteria.employmentTypes.includes(applicant.employmentType)) {
    errors.push(`Employment type '${applicant.employmentType}' not eligible for this product`);
  }
  
  return {
    eligible: errors.length === 0,
    errors
  };
};

// Static: Find active products by company
loanProductSchema.statics.findActiveByCompany = function(companyId) {
  return this.find({ company: companyId, isActive: true })
    .sort({ category: 1, name: 1 });
};

// Static: Find products by category
loanProductSchema.statics.findByCategory = function(category, companyId) {
  const filter = { category, isActive: true };
  if (companyId) filter.company = companyId;
  
  return this.find(filter).sort({ 'interestRate.default': 1 });
};

module.exports = mongoose.model('LoanProduct', loanProductSchema);
