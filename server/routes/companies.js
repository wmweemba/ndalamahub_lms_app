const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { authenticateToken, authorizeRole, authorizeMinRole } = require('../middleware/auth');

// @route   GET /api/companies
// @desc    Get companies based on user role
// @access  Private (Admin roles only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let companies;
        
        // Super user can see all companies
        if (req.user.role === 'super_user') {
            companies = await Company.find().select('-settings');
        }
        // Lender admin can only see their own lender company and linked corporate clients
        else if (req.user.role === 'lender_admin') {
            // First, get the user's company (which should be a lender)
            const userCompany = await Company.findById(req.user.company);
            
            if (!userCompany || userCompany.type !== 'lender') {
                return res.status(403).json({ message: 'Access denied: User not associated with a lender company' });
            }

            // Get the lender company and all corporate clients linked to it
            companies = await Company.find({
                $or: [
                    { _id: userCompany._id }, // The lender company itself
                    { lenderCompany: userCompany._id, type: 'corporate' } // Corporate clients linked to this lender
                ]
            }).select('-settings');
        }
        // Corporate admin can only see their own company
        else if (req.user.role === 'corporate_admin' || req.user.role === 'corporate_hr') {
            companies = await Company.find({ 
                _id: req.user.company 
            }).select('-settings');
        }
        // Other roles should not access this endpoint
        else {
            return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
        }
        
        res.json(companies);
    } catch (error) {
        console.error('Companies fetch error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (Super user and lender admin)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Add debug logging
        console.log('User attempting company creation:', req.user);
        console.log('Request body:', req.body);

        // Super user can create any type of company
        if (req.user.role === 'super_user') {
            const company = new Company(req.body);
            const savedCompany = await company.save();
            res.status(201).json(savedCompany);
        }
        // Lender admin can only create corporate companies linked to their lender
        else if (req.user.role === 'lender_admin') {
            // Get the user's lender company
            const userCompany = await Company.findById(req.user.company);
            
            if (!userCompany || userCompany.type !== 'lender') {
                return res.status(403).json({ message: 'Access denied: User not associated with a lender company' });
            }

            // Ensure they're creating a corporate company
            if (req.body.type !== 'corporate') {
                return res.status(400).json({ message: 'Lender admins can only create corporate companies' });
            }

            // Create the corporate company with automatic linking to the lender
            const companyData = {
                ...req.body,
                type: 'corporate',
                lenderCompany: userCompany._id
            };

            const company = new Company(companyData);
            const savedCompany = await company.save();

            // Add this corporate company to the lender's corporateClients array
            await Company.findByIdAndUpdate(
                userCompany._id,
                { $addToSet: { corporateClients: savedCompany._id } }
            );

            res.status(201).json(savedCompany);
        }
        // Other roles cannot create companies
        else {
            return res.status(403).json({ message: 'Access denied: Insufficient permissions to create companies' });
        }
    } catch (error) {
        console.error('Company creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private (Super user and lender admin for their companies)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId);
        
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Super user can update any company
        if (req.user.role === 'super_user') {
            const updatedCompany = await Company.findByIdAndUpdate(
                companyId,
                req.body,
                { new: true, runValidators: true }
            );
            res.json(updatedCompany);
        }
        // Lender admin can only update their own lender company or linked corporate companies
        else if (req.user.role === 'lender_admin') {
            const userCompany = await Company.findById(req.user.company);
            
            if (!userCompany || userCompany.type !== 'lender') {
                return res.status(403).json({ message: 'Access denied: User not associated with a lender company' });
            }

            // Check if the company being updated is either:
            // 1. The user's own lender company
            // 2. A corporate company linked to their lender
            const canUpdate = 
                company._id.toString() === userCompany._id.toString() ||
                (company.type === 'corporate' && company.lenderCompany && company.lenderCompany.toString() === userCompany._id.toString());

            if (!canUpdate) {
                return res.status(403).json({ message: 'Access denied: Cannot update this company' });
            }

            // Don't allow changing company type or lender relationships
            const updateData = { ...req.body };
            delete updateData.type;
            delete updateData.lenderCompany;
            delete updateData.corporateClients;

            const updatedCompany = await Company.findByIdAndUpdate(
                companyId,
                updateData,
                { new: true, runValidators: true }
            );
            res.json(updatedCompany);
        }
        // Corporate admin can only update their own company (basic info only)
        else if (req.user.role === 'corporate_admin') {
            if (company._id.toString() !== req.user.company.toString()) {
                return res.status(403).json({ message: 'Access denied: Cannot update this company' });
            }

            // Only allow updating certain fields
            const allowedFields = ['contactInfo', 'address', 'website', 'description'];
            const updateData = {};
            allowedFields.forEach(field => {
                if (req.body[field]) {
                    updateData[field] = req.body[field];
                }
            });

            const updatedCompany = await Company.findByIdAndUpdate(
                companyId,
                updateData,
                { new: true, runValidators: true }
            );
            res.json(updatedCompany);
        }
        // Other roles cannot update companies
        else {
            return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
        }
    } catch (error) {
        console.error('Company update error:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   DELETE /api/companies/:id
// @desc    Delete company
// @access  Private (Super user and lender admin for corporate companies only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId);
        
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Super user can delete any company
        if (req.user.role === 'super_user') {
            // If deleting a corporate company, remove it from lender's corporateClients
            if (company.type === 'corporate' && company.lenderCompany) {
                await Company.findByIdAndUpdate(
                    company.lenderCompany,
                    { $pull: { corporateClients: companyId } }
                );
            }
            
            await Company.findByIdAndDelete(companyId);
            res.json({ message: 'Company deleted successfully' });
        }
        // Lender admin can only delete corporate companies linked to their lender
        else if (req.user.role === 'lender_admin') {
            const userCompany = await Company.findById(req.user.company);
            
            if (!userCompany || userCompany.type !== 'lender') {
                return res.status(403).json({ message: 'Access denied: User not associated with a lender company' });
            }

            // Can only delete corporate companies linked to their lender
            if (company.type !== 'corporate' || !company.lenderCompany || company.lenderCompany.toString() !== userCompany._id.toString()) {
                return res.status(403).json({ message: 'Access denied: Cannot delete this company' });
            }

            // Remove from lender's corporateClients array
            await Company.findByIdAndUpdate(
                userCompany._id,
                { $pull: { corporateClients: companyId } }
            );

            await Company.findByIdAndDelete(companyId);
            res.json({ message: 'Company deleted successfully' });
        }
        // Other roles cannot delete companies
        else {
            return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
        }
    } catch (error) {
        console.error('Company deletion error:', error);
        res.status(500).json({ message: 'Error deleting company' });
    }
});

module.exports = router;