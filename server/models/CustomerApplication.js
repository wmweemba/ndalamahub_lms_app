const mongoose = require('mongoose');

// Public website intake (Phase 22). A prospect record only — no User/Loan
// exists until a lender staff member reviews and approves it. Created by
// the unauthenticated POST /api/public/:slug/applications endpoint.
const customerApplicationSchema = new mongoose.Schema({
  lenderCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  reference: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  applicant: {
    fullName: { type: String, required: true, trim: true },
    nrc: { type: String, required: true, trim: true, uppercase: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    employmentStatus: { type: String, required: true, trim: true },
    employerName: { type: String, trim: true },
    monthlyIncome: { type: Number, min: 0 }
  },
  loanRequest: {
    amount: { type: Number, required: true, min: 0 },
    purpose: { type: String, required: true, trim: true },
    termDays: { type: Number, required: true, min: 1 }
  },
  collateral: {
    type: {
      type: String,
      enum: ['vehicle', 'business_equipment', 'title_deed', 'other']
    },
    otherDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    estimatedValue: { type: Number, min: 0 }
  },
  source: {
    type: String,
    default: 'website'
  },
  review: {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
    notes: String
  },
  createdUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdLoan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan'
  }
}, {
  timestamps: true
});

customerApplicationSchema.index({ lenderCompany: 1, status: 1 });

module.exports = mongoose.model('CustomerApplication', customerApplicationSchema);
