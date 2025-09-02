import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { authService } from '../../services/authService';
import { getCurrentUser, canAccessCompanies, canAccessReports, canAccessSettings } from '../../utils/roleUtils';

export function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentUser = getCurrentUser();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    // If no user is found, don't render navigation
    if (!currentUser) {
        return null;
    }

    return (
        <nav className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        {/* Logo */}
                        <Link to="/dashboard" className="flex items-center">
                            <span className="font-bold text-xl text-gray-800">NdalamaHub</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation Links */}
                    <div className="hidden md:flex items-center space-x-4">
                        <NavLink to="/dashboard" active={isActive('/dashboard')}>
                            <DashboardIcon />
                            <span>Dashboard</span>
                        </NavLink>

                        {/* Companies - Only show to users who can manage companies */}
                        {canAccessCompanies(currentUser.role) && (
                            <NavLink to="/companies" active={isActive('/companies')}>
                                <CompaniesIcon />
                                <span>Companies</span>
                            </NavLink>
                        )}

                        <NavLink to="/loans" active={isActive('/loans')}>
                            <LoansIcon />
                            <span>Loans</span>
                        </NavLink>

                        {/* Reports - Only show to users who can access reports */}
                        {canAccessReports(currentUser.role) && (
                            <NavLink to="/reports" active={isActive('/reports')}>
                                <ReportsIcon />
                                <span>Reports</span>
                            </NavLink>
                        )}

                        {/* Settings - Only show to users who can access settings */}
                        {canAccessSettings(currentUser.role) && (
                            <NavLink to="/settings" active={isActive('/settings')}>
                                <SettingsIcon />
                                <span>Settings</span>
                            </NavLink>
                        )}
                    </div>

                    {/* Desktop User Info and Logout */}
                    <div className="hidden md:flex items-center space-x-4">
                        {/* User greeting */}
                        <span className="text-sm text-gray-600">
                            Welcome, {currentUser.firstName || currentUser.username}
                        </span>
                        
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900"
                        >
                            <LogoutIcon />
                            <span>Logout</span>
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Open main menu</span>
                            {/* Hamburger icon when menu is closed */}
                            {!isMobileMenuOpen ? (
                                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            ) : (
                                /* X icon when menu is open */
                                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
                        {/* User info on mobile */}
                        <div className="px-3 py-2 text-sm text-gray-600 border-b border-gray-100">
                            Welcome, {currentUser.firstName || currentUser.username}
                        </div>

                        <MobileNavLink 
                            to="/dashboard" 
                            active={isActive('/dashboard')} 
                            onClick={closeMobileMenu}
                        >
                            <DashboardIcon />
                            <span>Dashboard</span>
                        </MobileNavLink>

                        {/* Companies - Only show to users who can manage companies */}
                        {canAccessCompanies(currentUser.role) && (
                            <MobileNavLink 
                                to="/companies" 
                                active={isActive('/companies')} 
                                onClick={closeMobileMenu}
                            >
                                <CompaniesIcon />
                                <span>Companies</span>
                            </MobileNavLink>
                        )}

                        <MobileNavLink 
                            to="/loans" 
                            active={isActive('/loans')} 
                            onClick={closeMobileMenu}
                        >
                            <LoansIcon />
                            <span>Loans</span>
                        </MobileNavLink>

                        {/* Reports - Only show to users who can access reports */}
                        {canAccessReports(currentUser.role) && (
                            <MobileNavLink 
                                to="/reports" 
                                active={isActive('/reports')} 
                                onClick={closeMobileMenu}
                            >
                                <ReportsIcon />
                                <span>Reports</span>
                            </MobileNavLink>
                        )}

                        {/* Settings - Only show to users who can access settings */}
                        {canAccessSettings(currentUser.role) && (
                            <MobileNavLink 
                                to="/settings" 
                                active={isActive('/settings')} 
                                onClick={closeMobileMenu}
                            >
                                <SettingsIcon />
                                <span>Settings</span>
                            </MobileNavLink>
                        )}

                        {/* Logout button for mobile */}
                        <button
                            onClick={() => {
                                handleLogout();
                                closeMobileMenu();
                            }}
                            className="flex items-center space-x-3 w-full px-3 py-2 text-left text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                        >
                            <LogoutIcon />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}

// Desktop NavLink component
function NavLink({ to, children, active }) {
    return (
        <Link
            to={to}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                active
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
            {children}
        </Link>
    );
}

// Mobile NavLink component
function MobileNavLink({ to, children, active, onClick }) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium ${
                active
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
            {children}
        </Link>
    );
}

// Icon components for better organization
function DashboardIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    );
}

function CompaniesIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    );
}

function LoansIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function ReportsIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function LogoutIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}