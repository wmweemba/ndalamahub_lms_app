import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';

// Shared with the other auth screens. Kept as constants rather than repeated
// inline so the three forms cannot drift apart visually.
export const authInputClass =
    'w-full px-3.5 py-3 rounded-xl border border-input bg-[#FCFCFB] text-foreground ' +
    'shadow-[inset_0_1px_2px_rgba(28,28,28,0.04)] focus:outline-none focus:ring-2 ' +
    'focus:ring-ring focus:border-transparent focus:bg-card transition-colors';

export const authButtonClass =
    'w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium ' +
    'shadow-[0_8px_20px_-6px_rgba(214,41,94,0.45)] hover:opacity-90 focus:outline-none ' +
    'focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-opacity disabled:opacity-50';

export function LoginForm({ onSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await authService.login(username, password);
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="mb-4">
                <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                    Username
                </label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={authInputClass}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                />
            </div>

            <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={authInputClass}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                />
            </div>

            <div className="text-right mb-6">
                <Link
                    to="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring rounded transition-colors"
                >
                    Forgot your password?
                </Link>
            </div>

            {error && (
                <div className="mb-4 bg-status-danger-bg border border-status-danger-fg/20 text-status-danger-fg px-4 py-3 rounded-lg text-sm">
                    <p>{error}</p>
                </div>
            )}

            <button type="submit" disabled={loading} className={authButtonClass}>
                {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="mt-7 pt-4 border-t border-border text-xs text-muted-foreground leading-relaxed">
                Accounts are created by your administrator. If you don&apos;t have one, or your
                account has no email address on file, contact your administrator.
            </p>
        </form>
    );
}
