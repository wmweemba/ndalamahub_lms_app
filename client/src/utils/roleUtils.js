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