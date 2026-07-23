// In-memory current-user cache (Phase 25 — replaces the JWT/localStorage
// cache `roleUtils.getCurrentUser()` used to read directly). Kept as its own
// leaf module with zero dependencies — not even on `utils/api.js` — for two
// reasons: `utils/api.js` needs `clearCurrentUser()` for its 401 handler
// (importing `roleUtils.js` there would cycle back to `api.js`), and the
// global test setup file needs to reset this state before every test
// without ever importing `api.js` transitively — doing so from a setupFile
// loads the *real* axios instance before that test file's own `vi.mock('@/
// utils/api', ...)` has a chance to intercept it, silently defeating the
// mock for every test in the file (found the hard way while writing the
// Phase 25 client tests).
let cachedUser = null;
let hydrated = false;
let hydrationPromise = null;

// getCurrentUser() stays synchronous for the many existing call sites — the
// cache is populated either by a login response or by roleUtils.ensureHydrated().
export const getCurrentUser = () => cachedUser;

export const isHydrated = () => hydrated;

// Normalizes id/_id so callers written against either shape (both exist in
// this codebase — a Mongoose doc's toJSON() has `_id`, the hand-built login
// response has `id`) keep working regardless of which source populated it.
export const setCurrentUser = (user) => {
  if (!user) {
    cachedUser = null;
  } else {
    const id = user.id || user._id;
    cachedUser = id ? { ...user, id, _id: id } : { ...user };
  }
  hydrated = true;
};

export const clearCurrentUser = () => {
  cachedUser = null;
  hydrated = true;
};

// roleUtils.ensureHydrated()'s in-flight/completed hydration promise, kept
// here (not as a local variable in roleUtils.js) so it can be reset without
// importing roleUtils.js — see the module comment above.
export const getHydrationPromise = () => hydrationPromise;
export const setHydrationPromise = (promise) => {
  hydrationPromise = promise;
};

// Test-only: restores the pre-hydration state so a test can exercise the
// unauthenticated-boot path without an earlier test's cached user (or
// resolved hydration promise) leaking in.
export const resetCurrentUser = () => {
  cachedUser = null;
  hydrated = false;
  hydrationPromise = null;
};
