import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { CompaniesPage } from './pages/companies/CompaniesPage';
import LoansPage from './pages/loans/LoansPage';
import ProductsPage from './pages/products/ProductsPage';
import UsersPage from './pages/users/UsersPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import SupportPage from './pages/support/SupportPage';
import { Navbar } from './components/layout/Navbar';

export function App() {
    return (
        <div className="min-h-screen bg-gray-50">
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <DashboardPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/companies"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <CompaniesPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/loans"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <LoansPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/products"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <ProductsPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/users"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <UsersPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/reports"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <ReportsPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <SettingsPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/support"
                        element={
                            <ProtectedRoute>
                                <>
                                    <Navbar />
                                    <main className="pt-16 px-4">
                                        <div className="max-w-7xl mx-auto">
                                            <SupportPage />
                                        </div>
                                    </main>
                                </>
                            </ProtectedRoute>
                        }
                    />

                    {/* Default route - redirect to login if not authenticated, dashboard if authenticated */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* Catch all route */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </div>
    );
}

export default App;
