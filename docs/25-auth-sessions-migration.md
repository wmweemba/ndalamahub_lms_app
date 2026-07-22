# Phase 25 — Auth migration: server-side sessions

**Planned:** 2026-07-22 (Claude Code Fable, Manifi launch planning; Option A locked with William — MFA is explicitly post-launch). **Executes on:** `phase/25-auth-sessions`, branched from `main` (Phase 24 merged).
**Session size:** **plan for 2 sessions** — Session A = server + test-suite migration, Session B = client + manual pass. Hard stop between them.
**Read first:** CLAUDE.md §8 (this phase replaces it — the migration this section promised), `server/middleware/auth.js`, `server/routes/auth.js`, `server/utils/auth.js`, `client/src/utils/roleUtils.js` (`getCurrentUser` and every caller), `client/src/utils/api.js`, and `server/tests/api/` helpers (how tests obtain/attach tokens today — this suite migrates wholesale).

## Objective

Replace localStorage JWTs with **server-side sessions in Mongo**: httpOnly/secure cookies, instant revocation (deactivating a user locks them out on their next request — closing the documented 7-day-token hole), nothing readable by page JavaScript, and per-request fresh user state (which also kills the "Welcome, !" class of stale-localStorage bugs at the root). Route handlers keep seeing the same `req.user` shape — the blast radius is auth middleware, the auth routes, the API test helpers, and the client's token plumbing.

## Design (locked)

- `express-session` + `connect-mongo` (sessions in the existing Mongo). Cookie: `httpOnly`, `secure` in production, `sameSite: 'lax'`, rolling expiry ~24h idle, absolute cap 7 days. `SESSION_SECRET` env var — **required at boot** (add to the fail-fast check alongside `JWT_SECRET`… which this phase retires; swap the fail-fast list).
- Session stores only `{ userId }`. A `loadUser` middleware replaces `authenticateToken`: loads the user per request, **rejects if `!user.isActive`** (destroying the session), attaches the same `req.user` shape routes already consume (verify the exact fields routes touch — `id`, `username`, `role`, `company` — and preserve them; `hasMinRole` helper unchanged).
- CSRF: `sameSite: 'lax'` plus an **Origin/Referer check on unsafe methods** (reject state-changing requests whose Origin doesn't match the allowed app origin(s); no token dance needed for a same-site SPA — document this choice in code). The Phase 22 public intake route keeps its own separate rules (no session, own CORS).
- Login/logout: `POST /auth/login` validates credentials exactly as today (bcrypt, per-username rate limiter, generic failure message, isActive check) but now regenerates the session and returns the user document (the full safe subset — firstName/lastName included). `POST /auth/logout` destroys the session. **JWT issuance, the refresh route, and `JWT_SECRET` are removed**; forgot-password/reset-token and invite flows (self-contained token mechanism) are unaffected.
- Dev cross-origin: add a **Vite dev proxy** (`/api` → localhost server) so cookies are first-party in development; `VITE_API_URL` becomes unnecessary in dev (keep it working for any non-proxied setup, flag its future in the changelog). Production is same-domain-or-parent-domain behind Coolify (Phase 26's concern).

## Steps — Session A (server)

1. Dependencies (`express-session`, `connect-mongo`), session wiring in `app.js` (order: after helmet/sanitize, before routes), `SESSION_SECRET` fail-fast, `loadUser` middleware, Origin-check middleware for unsafe methods.
2. Rework `routes/auth.js` (login/logout/me on sessions; delete refresh; strip token generation utils in `utils/auth.js`).
3. **Migrate the API test suite**: replace the bearer-token helpers with `supertest.agent()`-based login sessions (one shared helper; each test file's auth setup goes through it). Every existing API test must pass unmodified in intent. Add new tests: deactivation locks out the *next* request on a live session; logout invalidates; Origin-check rejects a cross-origin POST; session survives across requests. This migration is the phase's hidden bulk — budget most of Session A for it.
4. Full suite green (unit tests untouched; API suite migrated). **Hard stop.**

## Steps — Session B (client)

5. `utils/api.js`: `withCredentials: true`; delete the token request-interceptor; 401 response-interceptor → clear cached user, redirect `/login` (keep the 402 lock redirect).
6. `roleUtils.getCurrentUser()`: keep the function signature (dozens of call sites) but back it with an **in-memory cached user** hydrated from the login response and re-hydrated via `GET /auth/me` on app boot (a tiny module-level store or a TanStack query the layout owns — pick the simplest that keeps `getCurrentUser()` synchronous for existing callers; document the choice). Delete all `ndalamahub-token`/`ndalamahub-user` localStorage usage and the client-side JWT decode. `authService.login/logout` updated accordingly. `ProtectedRoute` handles the async boot state (loading gate before redirect).
7. Vite dev proxy config; verify `ProductBasedLoanForm`'s `/auth/me` special case and the AppLayout user display now come from one consistent source (the "Welcome, !" quirk should be structurally dead — verify and note it).
8. Client tests: update `src/test/utils.jsx` (`makeFakeToken` dies; seed the user cache instead — one helper change, all tests keep working), plus new cases: unauthenticated boot redirects; logout clears.
9. **Manual pass on dev Atlas, all six roles**: login, browse, mutation, logout; deactivate a logged-in test user and confirm their next click logs them out; borrower temp-password + change-password flow still works. Record per-role results in the changelog.

## Acceptance criteria

1. No token in localStorage anywhere; page JS cannot read the credential; deactivation is effective immediately (test-pinned).
2. Full server suite green post-migration (261+ all phases' additions); client suites green; every role manually verified.
3. `JWT_SECRET` gone from code, `.env.example` updated (`SESSION_SECRET` in); CLAUDE.md §8 rewritten as "done".

## Close-out

Update CLAUDE.md (§8 rewrite — the auth migration is complete, describe the session design + the MFA-post-launch decision; §3, §6 known-limitation removal for the token hole) and `changelog.md`; merge → `main`, push, delete branch.
