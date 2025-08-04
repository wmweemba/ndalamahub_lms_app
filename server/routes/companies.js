const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// @route   GET /api/companies
// @desc    Get all companies
// @access  Private (Admin roles only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const companies = await Company.find().select('-settings');
        res.json(companies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (Super user only)
router.post('/', authenticateToken, authorizeRole('super_user'), async (req, res) => {
    try {
        const company = new Company(req.body);
        const savedCompany = await company.save();
        res.status(201).json(savedCompany);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (Super user only)
router.put('/:id', authenticateToken, authorizeRole('super_user'), async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }
        res.json(company);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Super user only)
router.delete('/:id', authenticateToken, authorizeRole('super_user'), async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }
        if (company.type === 'lender') {
            return res.status(400).json({ message: 'Cannot delete lender company' });
        }
        await company.remove();
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;