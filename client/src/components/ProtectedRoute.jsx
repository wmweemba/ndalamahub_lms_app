import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser, ensureHydrated, isHydrated } from '@/utils/roleUtils';

const ProtectedRoute = ({ children }) => {
  const [ready, setReady] = useState(isHydrated());

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    ensureHydrated().then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [ready]);

  // The cache is empty until the boot-time GET /auth/me resolves (a fresh
  // tab or a page refresh) — hold the redirect decision until then, or an
  // already-logged-in user would flash through /login on every refresh.
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background] text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
