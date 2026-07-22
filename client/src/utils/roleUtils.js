export const ROLES = {
    PLATFORM_ADMIN: 'platform_admin',
    LENDER_ADMIN: 'lender_admin',
    LENDER_OFFICER: 'lender_officer',
    EMPLOYER_ADMIN: 'employer_admin',
    EMPLOYER_HR: 'employer_hr',
    BORROWER: 'borrower'
};

export const canApproveLoan = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR
    ].includes(role);
};

export const canDisburseLoan = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
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
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN
    ].includes(role);
};

// Check if user can access reports
export const canAccessReports = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR
    ].includes(role);
};

// Check if user can access settings
export const canAccessSettings = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR
    ].includes(role);
};

// Check if user can manage other users
export const canManageUsers = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR
    ].includes(role);
};

// Check if user can apply for loans
export const canApplyForLoan = (role) => {
    return [
        ROLES.BORROWER
    ].includes(role);
};

// Check if user can manage products (create, edit, delete)
export const canManageProducts = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN
    ].includes(role);
};

// Check if user can view products
export const canViewProducts = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.LENDER_OFFICER,
        ROLES.EMPLOYER_ADMIN,
        ROLES.EMPLOYER_HR,
        ROLES.BORROWER
    ].includes(role);
};

// Check if user sees the Products nav entry (lender-side staff only)
export const canAccessProductsNav = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.LENDER_OFFICER
    ].includes(role);
};

// Check if user sees the Collateral Register nav entry (lender-side staff only)
export const canAccessCollateralNav = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN,
        ROLES.LENDER_OFFICER
    ].includes(role);
};
