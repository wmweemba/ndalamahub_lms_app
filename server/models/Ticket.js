const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true }, // TK<year><seq>, atomic counter like loanNumber
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  category: {
    type: String,
    enum: ['loan_inquiry', 'repayment_issue', 'account_access', 'technical', 'other'],
    default: 'other'
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },       // creator's company
  handlerCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },                 // lender handling it; null => platform-level
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedLoan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
  messages: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const year = new Date().getFullYear();
    const counters = this.constructor.db.collection('counters');
    const doc = await counters.findOneAndUpdate(
      { _id: `ticketNumber-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    // Driver version note: some driver majors wrap the result in { value: doc }
    // instead of returning the document directly — handle both.
    const seq = (doc && doc.value ? doc.value.seq : doc?.seq);
    this.ticketNumber = `TK${year}${seq.toString().padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
