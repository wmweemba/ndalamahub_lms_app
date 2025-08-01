const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' } // Refresh token expires in 30 days
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw error;
  }
};

// Generate password reset token
const generatePasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  return {
    resetToken,
    hashedToken
  };
};

// Generate email verification token
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash password reset token
const hashPasswordResetToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

// Generate secure random string
const generateSecureString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Zambian format)
const validatePhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Check if it's a valid Zambian phone number
  // Zambian numbers start with 260 and are 12 digits total
  if (cleanPhone.startsWith('260') && cleanPhone.length === 12) {
    return true;
  }
  
  // Also accept numbers starting with 0 (local format)
  if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
    return true;
  }
  
  return false;
};

// Format phone number to international format
const formatPhoneNumber = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.startsWith('260')) {
    return cleanPhone;
  }
  
  if (cleanPhone.startsWith('0')) {
    return '260' + cleanPhone.substring(1);
  }
  
  return cleanPhone;
};

// Generate OTP (One-Time Password)
const generateOTP = (length = 6) => {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
};

// Rate limiting helper
const createRateLimiter = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (identifier) => {
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }
    
    validAttempts.push(now);
    attempts.set(identifier, validAttempts);
    
    return true; // Within rate limit
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  hashPasswordResetToken,
  generateSecureString,
  validatePassword,
  validateEmail,
  validatePhoneNumber,
  formatPhoneNumber,
  generateOTP,
  createRateLimiter
}; 