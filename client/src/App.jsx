import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

const LoginPage = lazy(() =>
    import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const ForgotPasswordPage = lazy(() =>
    import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
    import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CompaniesPage = lazy(() =>
    import('./pages/companies/CompaniesPage').then((m) => ({ default: m.CompaniesPage }))
);
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const LoansPage = lazy(() => import('./pages/loans/LoansPage'));
const ProductsPage = lazy(() => import('./pages/products/ProductsPage'));
const CollateralRegisterPage = lazy(() => import('./pages/collateral/CollateralRegisterPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const SupportPage = lazy(() => import('./pages/support/SupportPage'));
const AccountLockedPage = lazy(() => import('./pages/account/AccountLockedPage'));
const AccountPage = lazy(() => import('./pages/account/AccountPage'));

function RouteLoadingFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
        </div>
    );
}

export function App() {
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                {/* Public by necessity: forgot-password, staff invite and customer invite
                    emails all link to /reset-password?token=. Guarding these would bounce
                    every one of those links to /login via the catch-all below. */}
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/account-locked" element={<AccountLockedPage />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/loans" element={<LoansPage />} />
                    <Route path="/companies" element={<CompaniesPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/collateral" element={<CollateralRegisterPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/account" element={<AccountPage />} />
                </Route>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
