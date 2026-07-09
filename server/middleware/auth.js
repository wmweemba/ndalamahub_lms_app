const jwt = require('jsonwebtoken');

// Role hierarchy, single source of truth for authorizeMinRole and hasMinRole
const ROLE_HIERARCHY = {
    'platform_admin': 5,
    'lender_admin': 4,
    'lender_officer': 3,
    'employer_admin': 2,
    'employer_hr': 1,
    'borrower': 0
};

// Authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token.' });
    }
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

// Check whether a role meets a minimum role level (JWT-payload-safe
// replacement for the Mongoose User.hasPermission method)
const hasMinRole = (role, minRole) => {
    return (ROLE_HIERARCHY[role] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? Infinity);
};

module.exports = {
    authenticateToken,
    authorize,
    authorizeRole,
    authorizeMinRole,
    authorizeCompany,
    hasMinRole
};