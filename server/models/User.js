const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  // Required + unique for all staff roles; optional for borrowers (NRC is
  // the borrower identity anchor — see `nrc` below). Uniqueness is a partial
  // index (see the schema.index() call below), not schema-level `unique`,
  // so multiple borrowers with no email don't collide.
  email: {
    type: String,
    required: function() {
      return this.role !== 'borrower';
    },
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: ['platform_admin', 'lender_admin', 'lender_officer', 'employer_admin', 'employer_hr', 'borrower'],
    required: [true, 'Role is required'],
    default: 'borrower'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  // No longer required for borrowers (Phase 19) — meaningless for direct
  // customers and the demo client never filled it in for payroll borrowers
  // either. Still required for employer_hr.
  department: {
    type: String,
    trim: true,
    required: function() {
      return this.role === 'employer_hr';
    }
  },
  employeeId: {
    type: String,
    trim: true,
    required: false  // Make employeeId optional for all roles
  },
  // NRC-first borrower identity (Phase 19): required for every borrower,
  // optional/unused for staff roles. Loose format validation only — digits
  // and slashes — no hard-pinned NRC format. Uniqueness is per-company (see
  // the compound partial index below), not global: the same person may
  // legitimately exist under two tenants, and a global unique index would
  // leak cross-tenant existence.
  nrc: {
    type: String,
    trim: true,
    uppercase: true,
    required: function() {
      return this.role === 'borrower';
    },
    match: [/^[0-9/]+$/, 'NRC may only contain digits and slashes']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user's full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Check if user has permission
userSchema.methods.hasPermission = function(requiredRole) {
  const roleHierarchy = {
    'platform_admin': 5,
    'lender_admin': 4,
    'lender_officer': 3,
    'employer_admin': 2,
    'employer_hr': 1,
    'borrower': 0
  };
  
  return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
};

// Partial unique indexes (Phase 19) — replace the old schema-level
// `email: { unique: true }`, which would reject a second borrower with no
// email under a standard unique index. See server/utils/migrations/rebuildUserIndexes.js
// for the one-time index migration this requires on any pre-existing database.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $exists: true } } });
userSchema.index({ company: 1, nrc: 1 }, { unique: true, partialFilterExpression: { nrc: { $exists: true } } });

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  return user;
};

module.exports = mongoose.model('User', userSchema);