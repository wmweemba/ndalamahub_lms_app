const jwt = require('jsonwebtoken');

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

        if (!roles.includes(req.user.role) && req.user.role !== 'super_user') {
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
        if (req.user.role !== role && req.user.role !== 'super_user') {
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
    const roleHierarchy = {
        'super_user': 5,        // Increased to accommodate new role
        'lender_admin': 4,      // Moved up
        'corporate_admin': 3,   // Moved up
        'corporate_hr': 2,      // Added new role
        'lender_user': 1,
        'corporate_user': 0
    };

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userRoleLevel = roleHierarchy[req.user.role] || -1;
        const requiredRoleLevel = roleHierarchy[minRole] || 0;

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

module.exports = {
    authenticateToken,
    authorize,
    authorizeRole,
    authorizeMinRole,
    authorizeCompany
};