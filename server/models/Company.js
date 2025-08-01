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
companySchema.index({ registrationNumber: 1 });
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