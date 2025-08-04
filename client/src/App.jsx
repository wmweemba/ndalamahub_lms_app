import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { Navbar } from './components/layout/Navbar';

export function App() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Conditionally render navbar based on route */}
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/*"
                    element={
                        <>
                            <Navbar />
                            <main className="pt-16 px-4">
                                <div className="max-w-7xl mx-auto">
                                    <Routes>
                                        <Route path="/dashboard" element={<DashboardPage />} />
                                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    </Routes>
                                </div>
                            </main>
                        </>
                    }
                />
            </Routes>
        </div>
    );
}

export default App;
