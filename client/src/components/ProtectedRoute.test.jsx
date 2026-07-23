import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { seedUser, resetCurrentUser } from '@/test/utils';
import { authService } from '@/services/authService';

const { meResponse } = vi.hoisted(() => ({ meResponse: { current: null } }));

vi.mock('@/utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/auth/me') {
        return meResponse.current
          ? Promise.resolve({ data: { data: { user: meResponse.current } } })
          : Promise.reject({ response: { status: 401 } });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

function renderProtected(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Dashboard Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute (Phase 25 session boot)', () => {
  beforeEach(() => {
    meResponse.current = null;
    resetCurrentUser();
  });

  it('with no session, GET /auth/me 401s and it redirects to /login', async () => {
    renderProtected('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('with a live session, it hydrates from GET /auth/me and renders the protected content', async () => {
    meResponse.current = { _id: '1', username: 'lenderadmin', role: 'lender_admin' };
    renderProtected('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });

  it('skips the boot fetch when already hydrated (e.g. right after login)', async () => {
    seedUser({ _id: '2', username: 'borrower1', role: 'borrower' });
    renderProtected('/dashboard');

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('logout clears the cache — a subsequently rendered ProtectedRoute redirects', async () => {
    seedUser({ _id: '3', username: 'borrower2', role: 'borrower' });
    await authService.logout();

    renderProtected('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
