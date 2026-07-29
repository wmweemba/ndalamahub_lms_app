import api from '@/utils/api';
import {
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    getHydrationPromise,
    setHydrationPromise
} from './authState';

export { getCurrentUser, isHydrated, setCurrentUser, clearCurrentUser, resetCurrentUser } from './authState';

// Re-hydrates the in-memory current-user cache from the session cookie on
// app boot (a fresh tab, or a page refresh) — getCurrentUser() stays
// synchronous for every existing call site; this is the one async entry
// point that fills it in. Called by ProtectedRoute, once per app lifetime
// (cached in authState.js — a second call anywhere just returns the same
// promise).
export const ensureHydrated = () => {
    const existing = getHydrationPromise();
    if (existing) return existing;

    const promise = api.get('/auth/me', { skipAuthRedirect: true })
        .then((res) => {
            setCurrentUser(res.data?.data?.user || null);
            return getCurrentUser();
        })
        .catch(() => {
            clearCurrentUser();
            return null;
        });

    setHydrationPromise(promise);
    return promise;
};

export const ROLES = {
    PLATFORM_ADMIN: 'platform_admin',
    LENDER_ADMIN: 'lender_admin',
    LENDER_OFFICER: 'lender_officer',
    EMPLOYER_ADMIN: 'employer_admin',
    EMPLOYER_HR: 'employer_hr',
    BORROWER: 'borrower'
};

const LENDER_SIDE_ROLES = [ROLES.LENDER_ADMIN, ROLES.LENDER_OFFICER];
const EMPLOYER_SIDE_ROLES = [ROLES.EMPLOYER_ADMIN, ROLES.EMPLOYER_HR];

// Mirrors server/utils/tenantScope.js's idsEqual — currentUser.company is a
// raw id string when hydrated from the login response, but a populated
// object ({_id, ...}) when hydrated from GET /auth/me, so both shapes must
// resolve to the same comparison.
const idsEqual = (a, b) => {
    if (!a || !b) return false;
    const aId = a._id ? a._id : a;
    const bId = b._id ? b._id : b;
    return String(aId) === String(bId);
};

// Mirrors server/routes/loans.js's canActOnLoanApproval() exactly — the
// server remains the enforcer, this only makes the buttons match reality.
export const canApproveLoanForLoan = (user, loan) => {
    if (!user || !loan) return false;
    if (user.role === ROLES.PLATFORM_ADMIN) return true;

    const isDirect = idsEqual(loan.company, loan.lenderCompany);
    if (isDirect) {
        return LENDER_SIDE_ROLES.includes(user.role) && idsEqual(loan.lenderCompany, user.company);
    }
    return (EMPLOYER_SIDE_ROLES.includes(user.role) && idsEqual(loan.company, user.company)) ||
        (user.role === ROLES.LENDER_ADMIN && idsEqual(loan.lenderCompany, user.company));
};

export const canDisburseLoan = (role) => {
    return [
        ROLES.PLATFORM_ADMIN,
        ROLES.LENDER_ADMIN
    ].includes(role);
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
