import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function base64UrlEncode(obj) {
  return btoa(JSON.stringify(obj));
}

export function makeFakeToken(payloadOverrides = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    id: 'test-user-id',
    username: 'testuser',
    role: 'borrower',
    company: 'test-company-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadOverrides,
  };
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.fakesignature`;
}

export function seedUser(user) {
  const token = makeFakeToken({ role: user.role, id: user._id, username: user.username });
  localStorage.setItem('ndalamahub-token', token);
  localStorage.setItem('ndalamahub-user', JSON.stringify(user));
  return token;
}

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
