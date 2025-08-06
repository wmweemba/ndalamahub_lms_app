const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  // Basic loan information
  loanNumber: {
    type: String,
    required: true,
    unique: true,  // Keep this, remove any schema.index() for loanNumber
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
  
  // Calculated fields
  totalAmount: {
    type: Number,
    required: true
  },
  monthlyPayment: {
    type: Number,
    required: true
  },
  totalInterest: {
    type: Number,
    required: true
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
    }
  }],
  
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

// Calculate loan details
loanSchema.methods.calculateLoanDetails = function() {
  const principal = this.amount;
  const rate = this.interestRate / 100 / 12; // Monthly interest rate
  const term = this.term;
  
  if (rate === 0) {
    this.monthlyPayment = principal / term;
    this.totalInterest = 0;
  } else {
    this.monthlyPayment = (principal * rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    this.totalInterest = (this.monthlyPayment * term) - principal;
  }
  
  this.totalAmount = principal + this.totalInterest;
  
  // Generate repayment schedule
  this.generateRepaymentSchedule();
};

// Generate repayment schedule
loanSchema.methods.generateRepaymentSchedule = function() {
  const schedule = [];
  const monthlyPayment = this.monthlyPayment;
  let remainingPrincipal = this.amount;
  const monthlyRate = this.interestRate / 100 / 12;
  
  for (let i = 1; i <= this.term; i++) {
    const interest = remainingPrincipal * monthlyRate;
    const principal = monthlyPayment - interest;
    remainingPrincipal -= principal;
    
    schedule.push({
      installmentNumber: i,
      dueDate: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)), // Approximate 30 days
      amount: monthlyPayment,
      principal: Math.min(principal, remainingPrincipal + principal),
      interest: interest,
      status: 'pending'
    });
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
  return this.status === 'pending';
};

// Check if loan can be disbursed
loanSchema.methods.canBeDisbursed = function() {
  return this.status === 'approved' && 
         this.documents.some(doc => doc.type === 'id_document') &&
         (!this.company.settings?.requireGuarantor || this.guarantor?.name);
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

// Add validation for disbursement requirements
loanSchema.methods.canBeDisbursed = function() {
  return this.status === 'approved' && 
         this.documents.some(doc => doc.type === 'id_document') &&
         (!this.company.settings?.requireGuarantor || this.guarantor?.name);
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

module.exports = mongoose.model('Loan', loanSchema);