const mongoose = require('mongoose');

// Append-only audit trail of subscription/billing changes (one row per change).
const snapshotSchema = new mongoose.Schema(
  {
    status: String,
    plan: String,
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    suspendedAt: Date,
    notes: String
  },
  { _id: false }
);

const billingAuditLogSchema = new mongoose.Schema(
  {
    lenderCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    action: {
      type: String,
      enum: ['subscription.adjusted', 'subscription.payment_recorded', 'subscription.status_changed'],
      required: true
    },
    source: { type: String, enum: ['admin', 'system'], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    before: { type: snapshotSchema },
    after: { type: snapshotSchema },
    changedFields: [String],
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

billingAuditLogSchema.index({ lenderCompany: 1, createdAt: -1 });

const reject = function (next) {
  next(new Error('BillingAuditLog is append-only: updates and deletes are not allowed'));
};
['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne']
  .forEach((op) => billingAuditLogSchema.pre(op, { document: false, query: true }, reject));
// Document-level variants (doc.updateOne() / doc.deleteOne())
billingAuditLogSchema.pre('updateOne', { document: true, query: false }, reject);
billingAuditLogSchema.pre('deleteOne', { document: true, query: false }, reject);

module.exports = mongoose.model('BillingAuditLog', billingAuditLogSchema);
