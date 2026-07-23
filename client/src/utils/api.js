import axios from 'axios';
import { clearCurrentUser } from './authState';

// Sessions live in an httpOnly cookie (Phase 25) — nothing to attach per
// request; withCredentials is what makes the browser send it. In dev, the
// Vite proxy (vite.config.js) makes '/api' first-party against the same
// origin the page is served from, so the default here needs no host at all.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // A 402 SUBSCRIPTION_LOCKED means the caller's tenant is suspended/
        // cancelled (or a lapsed trial past its full grace) — send them to
        // the lock screen instead of letting the failed request surface as
        // a generic error.
        if (error.response?.status === 402 && error.response?.data?.code === 'SUBSCRIPTION_LOCKED') {
            if (window.location.pathname !== '/account-locked') {
                window.location.href = '/account-locked';
            }
            return Promise.reject(error);
        }

        // A 401 means the session is gone (never logged in, logged out
        // elsewhere, or deactivated mid-session) — clear the cache and bounce
        // to login. skipAuthRedirect is set by roleUtils.ensureHydrated()'s
        // own boot-time probe, which has its own no-session handling
        // (ProtectedRoute's redirect) and doesn't want a second hard redirect
        // racing it.
        if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
            clearCurrentUser();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;