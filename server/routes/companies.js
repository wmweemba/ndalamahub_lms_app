const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { requireAuth, authorizeRole, authorizeMinRole } = require('../middleware/auth');
const { isPlatformAdmin, idsEqual, companyScopeFilter, canReadCompany } = require('../utils/tenantScope');

// @route   GET /api/companies
// @desc    Get companies based on user role
// @access  Private (Admin roles only)
router.get('/', requireAuth, async (req, res) => {
    try {
        // Other roles should not access this endpoint
        const allowedRoles = ['platform_admin', 'lender_admin', 'employer_admin', 'employer_hr'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
        }

        const companies = await Company.find(await companyScopeFilter(req.user)).select('-settings');

        res.json(companies);
    } catch (error) {
        console.error('Companies fetch error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/companies
// @desc    Create new company
// @access  Private (Super user and lender admin)
router.post('/', requireAuth, async (req, res) => {
    try {
        // Super user can create any type of company
        if (req.user.role === 'platform_admin') {
            const companyData = { ...req.body };
            if (companyData.type === 'lender') {
                companyData.subscription = {
                    ...(companyData.subscription || {}),
                    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                };
            }
            const company = new Company(companyData);
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
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId);
        
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Super user can update any company
        if (isPlatformAdmin(req.user)) {
            // Checked explicitly here (rather than relying solely on the schema
            // validator) because Mongoose update validators don't see the rest
            // of the document — `this.type` inside the schema validator isn't
            // reliably populated on a partial findByIdAndUpdate.
            const effectiveType = req.body.type || company.type;
            if (req.body.lendingModel === 'direct' && effectiveType !== 'lender') {
                return res.status(400).json({ message: 'lendingModel: direct is only valid for lender companies' });
            }

            const updatedCompany = await Company.findByIdAndUpdate(
                companyId,
                req.body,
                { new: true, runValidators: true }
            );
            res.json(updatedCompany);
        }
        // Lender admin can only update their own lender company or linked corporate companies
        else if (req.user.role === 'lender_admin') {
            if (!canReadCompany(req.user, company)) {
                return res.status(403).json({ message: 'Access denied: Cannot update this company' });
            }

            // Don't allow changing company type, lender relationships, or the
            // lending model (a lender flipping its operating model is a
            // platform-level act, per the Manifi launch decisions)
            const updateData = { ...req.body };
            delete updateData.type;
            delete updateData.lenderCompany;
            delete updateData.corporateClients;
            delete updateData.lendingModel;
            delete updateData.publicIntake;

            const updatedCompany = await Company.findByIdAndUpdate(
                companyId,
                updateData,
                { new: true, runValidators: true }
            );
            res.json(updatedCompany);
        }
        // Corporate admin can only update their own company (basic info only)
        else if (req.user.role === 'employer_admin') {
            if (!canReadCompany(req.user, company)) {
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
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const companyId = req.params.id;
        const company = await Company.findById(companyId);
        
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Super user can delete any company
        if (isPlatformAdmin(req.user)) {
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
        // (never their own lender company — canReadCompany is deliberately not used
        // here since it treats same-company as accessible, which is correct for
        // reads/updates but would wrongly permit self-deletion here)
        else if (req.user.role === 'lender_admin') {
            if (company.type !== 'corporate' || !idsEqual(company.lenderCompany, req.user.company)) {
                return res.status(403).json({ message: 'Access denied: Cannot delete this company' });
            }

            // Remove from lender's corporateClients array
            await Company.findByIdAndUpdate(
                req.user.company,
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