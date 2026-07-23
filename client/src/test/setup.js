import '@testing-library/jest-dom/vitest';
// Deliberately from authState.js, not roleUtils.js: roleUtils.js imports
// utils/api.js, and importing that chain from a global setup file loads the
// *real* axios instance before a test file's own vi.mock('@/utils/api', ...)
// can intercept it — silently defeating the mock for the whole file. See
// authState.js's module comment.
import { resetCurrentUser } from '@/utils/authState';

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  localStorage.clear();
  // Phase 25: the current-user cache is in-memory (roleUtils.js), not
  // localStorage — reset it globally so no test needs its own boilerplate
  // for this, mirroring the localStorage.clear() above pre-Phase-25.
  resetCurrentUser();
});
