export const ROLES = {
    SUPER_USER: 'super_user',
    LENDER_ADMIN: 'lender_admin',
    CORPORATE_ADMIN: 'corporate_admin',
    CORPORATE_HR: 'corporate_hr',
    LENDER_USER: 'lender_user',
    CORPORATE_USER: 'corporate_user'
};

export const canApproveLoan = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(role);
};

export const canDisburseLoan = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN
    ].includes(role);
};

// Get current user from JWT token
export const getCurrentUser = () => {
  try {
    const token = localStorage.getItem('ndalamahub-token');
    if (!token) {
      return null;
    }
    
    const userData = localStorage.getItem('ndalamahub-user');
    if (!userData) {
      return null;
    }
    
    const user = JSON.parse(userData);
    
    // Verify token is not expired (basic check)
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    if (tokenData.exp * 1000 < Date.now()) {
      // Token expired, clear storage
      localStorage.removeItem('ndalamahub-token');
      localStorage.removeItem('ndalamahub-user');
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    // Clear potentially corrupted data
    localStorage.removeItem('ndalamahub-token');
    localStorage.removeItem('ndalamahub-user');
    return null;
  }
};

// Check if user can access companies management
export const canAccessCompanies = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN
    ].includes(role);
};

// Check if user can access reports
export const canAccessReports = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(role);
};

// Check if user can access settings
export const canAccessSettings = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(role);
};

// Check if user can manage other users
export const canManageUsers = (role) => {
    return [
        ROLES.SUPER_USER,
        ROLES.LENDER_ADMIN,
        ROLES.CORPORATE_ADMIN,
        ROLES.CORPORATE_HR
    ].includes(role);
};

// Check if user can apply for loans
export const canApplyForLoan = (role) => {
    return [
        ROLES.CORPORATE_USER
    ].includes(role);
};
