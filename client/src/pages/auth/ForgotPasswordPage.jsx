import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { authInputClass, authButtonClass } from '../../components/auth/LoginForm';
import { authService } from '../../services/authService';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authService.requestPasswordReset(email);
      // Always show the same confirmation. Branching on the response — or showing a
      // "no such account" message — would turn this form into an account-enumeration
      // oracle for anyone who can reach the login page.
      setSent(true);
    } catch (err) {
      // Only reached on a network/server failure, never on "unknown address".
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="space-y-6">
          <div className="bg-status-success-bg border border-status-success-fg/20 text-status-success-fg px-4 py-3 rounded-lg text-sm">
            <p>
              If an account with that email exists, we&apos;ve sent a password reset link to
              it. The link expires in 10 minutes.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              try a different email address
            </button>
            .
          </p>
          <Link
            to="/login"
            className="block w-full py-3 text-center border border-border text-foreground font-medium rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address on your account and we'll send you a link to set a new password."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="Email address"
            autoComplete="email"
            required
          />
        </div>

        {error && (
          <div className="bg-status-danger-bg border border-status-danger-fg/20 text-status-danger-fg px-4 py-3 rounded-lg text-sm">
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={authButtonClass}
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          <Link
            to="/login"
            className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            Back to sign in
          </Link>
        </p>

        <p className="text-xs text-center text-muted-foreground">
          No email on your account? Ask your administrator to reset it for you.
        </p>
      </form>
    </AuthLayout>
  );
}
