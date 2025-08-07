const jwt = require('jsonwebtoken');

// Authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Add debug logging
        console.log('Token received:', token);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded); // Debug log
        
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
        // Add detailed debug logging
        console.log('Authorization check:', {
            requiredRole: role,
            userRole: req.user?.role,
            userDetails: req.user,
            token: req.headers.authorization
        });

        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Check if user has required role
        if (req.user.role !== role && req.user.role !== 'super_user') {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions.',
                requiredRole: role,
                currentRole: req.user.role // Add this for debugging
            });
        }

        next();
    };
};

// Authorize minimum role level
const authorizeMinRole = (minRole) => {
    const roleHierarchy = {
        'super_user': 4,
        'lender_admin': 3,
        'corporate_admin': 2,
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