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
