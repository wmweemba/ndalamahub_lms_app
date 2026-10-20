const mongoose = require('mongoose');

// Financial ledger of manual subscription payments recorded by a platform_admin.
// Append-only by convention: no update/delete routes exist.
const subscriptionPaymentSchema = new mongoose.Schema({
  lenderCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'ZMW' },
  method: {
    type: String,
    enum: ['mobile_money', 'bank_transfer', 'cash', 'other'],
    required: true
  },
  reference: { type: String, trim: true },
  periodMonths: {
    type: Number,
    default: null,
    min: 1,
    max: 36,
    validate: {
      validator: (v) => v === null || v === undefined || Number.isInteger(v),
      message: 'periodMonths must be an integer'
    }
  },
  customPeriodEnd: { type: Boolean, default: false },
  previousStatus: String,
  previousPeriodEnd: Date,
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  plan: String,
  note: { type: String, maxlength: 500 },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

subscriptionPaymentSchema.index({ lenderCompany: 1, createdAt: -1 });
// Duplicate-reference guard (D8) at the DB level; only for non-empty references.
subscriptionPaymentSchema.index(
  { lenderCompany: 1, reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
