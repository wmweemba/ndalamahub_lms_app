const User = require('../models/User');

// Role hierarchy, single source of truth for authorizeMinRole and hasMinRole
const ROLE_HIERARCHY = {
    'platform_admin': 5,
    'lender_admin': 4,
    'lender_officer': 3,
    'employer_admin': 2,
    'employer_hr': 1,
    'borrower': 0
};

const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7-day absolute cap, independent of rolling idle expiry

// Global, mounted once in app.js before every route. Loads the session's user
// fresh on every request (no stale JWT payload) and attaches the same
// {id, username, role, company} shape routes have always consumed. Does NOT
// reject requests with no session — that's requireAuth's job at each route —
// but does reject (and destroys the session) the moment it finds one that no
// longer resolves to an active user, so deactivation locks out the very next
// request rather than waiting out a token's lifetime.
const loadUser = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return next();
    }

    const destroyAndReject = (message) => {
        req.session.destroy(() => {
            res.status(401).json({ message });
        });
    };

    if (req.session.createdAt && Date.now() - req.session.createdAt > SESSION_ABSOLUTE_MS) {
        return destroyAndReject('Session expired. Please log in again.');
    }

    try {
        const user = await User.findById(req.session.userId).select('username role company isActive');
        if (!user || !user.isActive) {
            return destroyAndReject('Session invalid. Please log in again.');
        }

        req.user = {
            id: user._id,
            username: user.username,
            role: user.role,
            company: user.company
        };
        next();
    } catch (error) {
        console.error('Session user load error:', error);
        destroyAndReject('Session invalid. Please log in again.');
    }
};

// Require an authenticated session — the per-route guard that replaces the
// old authenticateToken call sites. req.user is populated by the global
// loadUser middleware, if a valid session exists.
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Access denied. Please log in.' });
    }
    next();
};

// Authorize specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Flatten roles array in case it's passed as authorize(['role1', 'role2'])
        const allowedRoles = roles.flat();

        if (!allowedRoles.includes(req.user.role) && req.user.role !== 'platform_admin') {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Authorize by role
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Check if user has required role
        if (req.user.role !== role && req.user.role !== 'platform_admin') {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions.',
                requiredRole: role,
                currentRole: req.user.role
            });
        }

        next();
    };
};

// Authorize minimum role level
const authorizeMinRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userRoleLevel = ROLE_HIERARCHY[req.user.role] || -1;
        const requiredRoleLevel = ROLE_HIERARCHY[minRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Authorize company access
const authorizeCompany = () => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!req.user.company) {
            return res.status(403).json({ 
                message: 'No company associated with user.' 
            });
        }

        next();
    };
};

// Check whether a role meets a minimum role level (req.user-shape-safe
// replacement for the Mongoose User.hasPermission method)
const hasMinRole = (role, minRole) => {
    return (ROLE_HIERARCHY[role] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? Infinity);
};

module.exports = {
    loadUser,
    requireAuth,
    authorize,
    authorizeRole,
    authorizeMinRole,
    authorizeCompany,
    hasMinRole
};