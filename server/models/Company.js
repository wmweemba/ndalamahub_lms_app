const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['lender', 'corporate'],
    required: [true, 'Company type is required']
  },
  // Meaningful only when type === 'lender': 'employer' (borrowers belong to a
  // client/employer company) or 'direct' (borrowers attach to the lender
  // company itself, no employer in between).
  // The `this.type` check below only sees the full document on `.save()`
  // (document creation/validation) — on a partial findByIdAndUpdate, `this`
  // isn't bound to the full document, so the same rule is also enforced
  // explicitly in the PUT /api/companies/:id route handler, which has the
  // fetched document to check against.
  lendingModel: {
    type: String,
    enum: ['employer', 'direct'],
    default: 'employer',
    validate: {
      validator: function(value) {
        if (value !== 'direct') return true;
        return this.type === undefined || this.type === 'lender';
      },
      message: 'lendingModel: direct is only valid for lender companies'
    }
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  taxNumber: {
    type: String,
    trim: true
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true
    },
    website: {
      type: String,
      trim: true
    }
  },
  // For corporate companies, this references the lender company
  lenderCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function() {
      return this.type === 'corporate';
    }
  },
  // For lender companies, this stores their corporate clients
  corporateClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  }],
  // Company settings and configurations
  settings: {
    maxLoanAmount: {
      type: Number,
      default: 50000
    },
    interestRate: {
      type: Number,
      default: 15, // 15% default interest rate
      min: 0,
      max: 100
    },
    repaymentPeriod: {
      type: Number,
      default: 12, // 12 months default
      min: 1,
      max: 60
    },
    allowMultipleLoans: {
      type: Boolean,
      default: false
    },
    requireGuarantor: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Subscription/billing state — lender companies only, by convention.
  // Employer companies and borrowers inherit their lender's state (see
  // server/middleware/subscription.js). Manual billing: a platform_admin
  // moves this along via PUT /api/subscriptions/:companyId.
  subscription: {
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'read_only', 'suspended', 'cancelled'],
      default: 'trialing'
    },
    plan: { type: String, default: 'standard' },
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    suspendedAt: Date,
    notes: String // manual-billing bookkeeping, platform admin only
  },
  logo: {
    type: String, // URL to logo image
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
companySchema.index({ type: 1 });
companySchema.index({ lenderCompany: 1 });
companySchema.index({ isActive: 1 });

// Virtual for full address
companySchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.province} ${addr.postalCode}`.trim();
});

// Method to get all corporate clients for a lender
companySchema.methods.getCorporateClients = function() {
  return this.model('Company').find({ 
    lenderCompany: this._id, 
    type: 'corporate',
    isActive: true 
  });
};

// Method to check if company is a lender
companySchema.methods.isLender = function() {
  return this.type === 'lender';
};

// Method to check if company is a corporate
companySchema.methods.isCorporate = function() {
  return this.type === 'corporate';
};

// Ensure virtual fields are serialized
companySchema.set('toJSON', { virtuals: true });
companySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Company', companySchema);