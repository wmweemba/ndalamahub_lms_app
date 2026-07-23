import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setCurrentUser, resetCurrentUser } from '@/utils/authState';

// Phase 25: the current user lives in an in-memory cache (roleUtils.js),
// not localStorage — seedUser resets it first so a test never inherits a
// previous test's cached user, then sets it directly (no fake token, no
// hydration round-trip needed since this *is* the hydrated state).
export function seedUser(user) {
  resetCurrentUser();
  setCurrentUser(user);
  return user;
}

export { resetCurrentUser };

export function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BrowserRouter>
    );
  }

  return { Wrapper, ui: <Wrapper>{ui}</Wrapper> };
}
