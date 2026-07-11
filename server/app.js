const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(require('helmet')());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('express-mongo-sanitize')());

const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const loanRoutes = require('./routes/loans');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const systemRoutes = require('./routes/system');
const productRoutes = require('./routes/products');
const ticketRoutes = require('./routes/tickets');

// Route middleware
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'NdalamaHub API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app;
