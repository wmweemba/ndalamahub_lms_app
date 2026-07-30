import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { authInputClass, authButtonClass } from '../../components/auth/LoginForm';
import { authService } from '../../services/authService';

// Mirrors validatePassword() in server/utils/auth.js. Kept in sync by hand — the server
// remains the authority, this only gives the user live feedback before they submit.
const RULES = [
  { label: 'At least 6 characters', test: (v) => v.length >= 6 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
  { label: 'One special character', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  const allRulesPass = RULES.every((r) => r.test(password));
  const matches = password.length > 0 && password === confirm;
  const canSubmit = allRulesPass && matches && !loading;

  // This page is reached from three different emails — a forgot-password reset, a staff
  // account invite, and a customer account invite. They all carry the same kind of token
  // and all land here; the page deliberately does not try to tell them apart.
  if (!token) {
    return (
      <AuthLayout title="Invalid reset link">
        <div className="space-y-6">
          <div className="bg-status-danger-bg border border-status-danger-fg/20 text-status-danger-fg px-4 py-3 rounded-lg text-sm">
            <p>
              This link is missing its reset token. It may have been broken by your email
              client, or only partly copied.
            </p>
          </div>
          <Link
            to="/forgot-password"
            className="block w-full py-3 text-center bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-opacity"
          >
            Request a new link
          </Link>
          <p className="text-sm text-center text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDetails([]);

    try {
      await authService.resetPassword(token, password);
      toast.success('Password set. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="sr-only">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="New password"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label htmlFor="confirm" className="sr-only">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
          />
          {confirm.length > 0 && !matches && (
            <p className="mt-2 text-sm text-status-danger-fg">Passwords do not match.</p>
          )}
        </div>

        <ul className="space-y-1 text-sm">
          {RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.label}
                className={ok ? 'text-status-success-fg' : 'text-muted-foreground'}
              >
                <span aria-hidden="true">{ok ? '✓' : '○'}</span>{' '}
                <span className="sr-only">{ok ? 'Met:' : 'Not met:'}</span>
                {rule.label}
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="bg-status-danger-bg border border-status-danger-fg/20 text-status-danger-fg px-4 py-3 rounded-lg text-sm">
            <p>{error}</p>
            {details.length > 0 && (
              <ul className="mt-2 list-disc list-inside space-y-1">
                {details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <p className="mt-2">
              If the link has expired,{' '}
              <Link to="/forgot-password" className="underline">
                request a new one
              </Link>
              .
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={authButtonClass}
        >
          {loading ? 'Setting password...' : 'Set password'}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          <Link
            to="/login"
            className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
