const mongoose = require('mongoose');

// Collateral register (Phase 21). Separate collection from Loan so the
// register (GET /api/collateral) stays a cheap query — not embedded on Loan.
// `loan`/`application` are both optional and mutually exclusive: an intake
// application's collateral is attached at conversion (Phase 22), a direct
// loan application's collateral is attached to the loan immediately.
const collateralSchema = new mongoose.Schema({
  lenderCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan'
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerApplication'
  },
  type: {
    type: String,
    enum: ['vehicle', 'business_equipment', 'title_deed', 'other'],
    required: true
  },
  otherDescription: {
    type: String,
    required: [function () { return this.type === 'other'; }, 'otherDescription is required when type is "other"']
  },
  description: {
    type: String,
    required: [true, 'description is required']
  },
  estimatedValue: {
    type: Number,
    required: [true, 'estimatedValue is required'],
    min: [0, 'estimatedValue cannot be negative']
  },
  status: {
    type: String,
    enum: ['declared', 'verified', 'rejected'],
    default: 'declared'
  },
  vettedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  vettedAt: Date,
  vettingNotes: String,
  letterOfSale: {
    onFile: { type: Boolean, default: false },
    reference: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: Date
  }
}, {
  timestamps: true
});

collateralSchema.index({ lenderCompany: 1, status: 1 });
collateralSchema.index({ loan: 1 });

module.exports = mongoose.model('Collateral', collateralSchema);
