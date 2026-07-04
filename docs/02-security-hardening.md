# Phase 02 — Auth & Platform Hardening

**Prerequisite:** Phase 01 complete and merged; suite green at 133/133. Branch: `phase/02-security-hardening` off `main`.

## Objective

Finish the security-baseline list from `docs/DECISIONS.md`: remove the hardcoded JWT fallback secret, unify token payload shapes (which fixes the broken refresh flow), wire up login rate limiting, add `helmet`/`express-rate-limit`/`express-mongo-sanitize`, strip console-logged tokens and user/PII data, gate leaked error messages, set CORS properly, create `.env.example`, and bump vulnerable dependencies. After this phase the app's auth plumbing is *correct and non-leaky* — but still the hand-rolled JWT design; per `CLAUDE.md` Section 8, do **not** refactor beyond what is written here (an auth-provider migration is planned later).

## Scope

- `server/utils/auth.js` — fallback secret removal
- `server/routes/auth.js` — login/refresh token payloads, rate limiter, log stripping
- `server/config/db.js` / `server/server.js` — startup env validation, helmet, rate limit, sanitize, CORS
- `server/routes/loans.js`, `server/routes/reports.js`, `server/routes/dashboard.js`, `server/routes/users.js`, `server/routes/companies.js`, `server/routes/system.js`, `server/models/Loan.js` — console.log stripping + error-message gating
- `server/package.json`, `client/package.json` — dependency bumps
- New: `server/.env.example`, `client/.env.example`
- Client: `client/src` — only if the refresh-flow response shape change requires a matching read (verify; the response envelope is unchanged, so expect **no client edits**)

**Out of scope:** role renames (Phase 03), tenancy scoping consolidation (Phase 04), any change to token *lifetime* policy or storage strategy (localStorage stays for now — flag, don't fix), the mock system-settings/backup endpoints (`server/routes/system.js:63–179` — they're inert; removal is Phase 09's concern when real settings land).

## Step-by-step instructions

### Step 1 — Kill the fallback secret; fail fast on missing env

1a. `server/utils/auth.js`: in `generateToken` (line 8), `generateRefreshToken` (line 17), and `verifyToken` (line 25), replace `process.env.JWT_SECRET || 'your-secret-key'` with `process.env.JWT_SECRET`.

1b. `server/routes/auth.js:244` (refresh route): replace `process.env.JWT_SECRET || 'your-secret-key'` with `process.env.JWT_SECRET`.

1c. `server/server.js`: immediately after `require('dotenv').config();` (line 5), add:

```js
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}
```

Check `server/config/db.js` first: if it also falls back to a default connection string, remove that fallback too.

Note for tests: the Jest suite uses `mongodb-memory-server` and does not boot `server.js`, so this check must live in `server.js` (not in a module the tests import). If any test imports `utils/auth.js` and relied on the fallback secret, set `process.env.JWT_SECRET` in the test setup instead of restoring a fallback.

### Step 2 — Unify token payload shapes (fixes refresh)

Problem: login signs `{id, username, role, company}` inline (`auth.js:193–208`); `generateToken`/`generateRefreshToken` sign `{userId}` only. All middleware/route code reads `req.user.id/.role/.company`, so refresh-issued access tokens are unusable.

2a. `server/utils/auth.js`: change the two generators to accept a user document and sign the canonical payload:

```js
// Canonical access-token payload — all route code reads id/username/role/company
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      company: user.company && user.company._id ? user.company._id : user.company
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};
```

(The `company._id` guard matters: the refresh route loads the user with `.populate('company')`.)

2b. `server/routes/auth.js` login route: delete the inline `tokenPayload` construction and `jwt.sign`/`jwt.verify` block (lines 192–212), replacing with:

```js
        const token = generateToken(user);
```

Keep the response body shape (`{ token, user: {...} }`) exactly as is. Remove the now-unused `const jwt = require('jsonwebtoken')` import **only if** grep shows no other use in the file (the refresh route still uses `jwt.verify` — so keep it).

2c. Refresh route (`auth.js:232–286`): change `User.findById(decoded.userId)` (line 254) to `User.findById(decoded.id)`, and the two generator calls (lines 266–267) from `generateToken(user._id)` to `generateToken(user)` / `generateRefreshToken(user)`.

2d. Login currently returns **no refresh token**. Add one so the client can actually use `/refresh`: in the login response, add `refreshToken: generateRefreshToken(user)` alongside `token`. Check `client/src` for where login response is consumed (grep `ndalamahub-token`) — store the refresh token only if the client already has a refresh call path; if the client never calls `/api/auth/refresh`, just add the field server-side (additive, harmless) and note it.

2e. Verification: decode a token from `/login` and one from `/refresh` (jwt.io or `node -e`) — identical claim shape `{id, username, role, company, iat, exp}` for access tokens; a `/refresh`-issued access token must succeed against `GET /api/auth/me` and one authorized route (e.g. `GET /api/loans`).

### Step 3 — Login rate limiting

3a. Wire the existing helper (per `docs/DECISIONS.md`, "wire up the existing but unused rate limiter"): in `server/routes/auth.js`, `loginRateLimiter` is created at line 20 but never called. At the very top of the login handler's `try`, add:

```js
        const rateKey = `${req.ip}:${(username || '').toLowerCase()}`;
        if (!loginRateLimiter(rateKey)) {
            return res.status(429).json({ message: 'Too many login attempts. Please try again in 15 minutes.' });
        }
```

3b. Add `express-rate-limit` as a broader backstop (Step 5 installs it): in `server/server.js`, before the route mounts:

```js
const rateLimit = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));
```

(50/15min covers login+refresh+forgot-password brute force at the perimeter; the per-username limiter is the precise one.)

### Step 4 — helmet + mongo-sanitize + CORS

In `server/server.js`:

4a. `app.use(require('helmet')());` as the **first** middleware (before CORS).

4b. `app.use(require('express-mongo-sanitize')());` after the body parsers. This closes the `?status[$ne]=x` operator-injection class the audit found on list endpoints. **Compatibility note:** express-mongo-sanitize v2 works with Express 4 — do not pick an Express-5-only alternative (Express stays at 4.21.x per `CLAUDE.md`).

4c. CORS: keep the existing `cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true })` code, but add `CORS_ORIGIN` to `.env.example` (Step 7) and set it in the local `server/.env` to `http://localhost:5173`. Production values are a deployment concern — document, don't hardcode.

### Step 5 — Dependency bumps

5a. Server (`cd server`):
- `pnpm add helmet express-rate-limit express-mongo-sanitize`
- `pnpm update` (respect semver ranges), then `pnpm audit --prod` — the audit found 14 high (path-to-regexp via Express chain, minimatch, tmp, qs). For transitive vulnerabilities not fixed by `pnpm update`, use the `pnpm.overrides` field in `server/package.json` rather than force-upgrading Express itself. **Express must stay 4.21.x.**

5b. Client (`cd client`):
- `pnpm update axios react-router-dom vite` (audit flagged axios 1.11 CVEs, react-router 7.7 XSS/DoS, vite dev-server file-read). Stay within each package's current major (axios 1.x, react-router-dom 7.x, vite 7.x).
- `pnpm audit --prod`, then `pnpm build` must succeed and `pnpm dev` must boot; click through login → dashboard → loans list as a smoke test.

5c. Record the remaining (accepted) audit findings, if any, in the changelog entry.

### Step 6 — Strip token/PII console.logs and gate error messages

6a. Delete these logging statements (verified locations; re-locate by content if lines shifted):
- `server/routes/auth.js`: "Found user:" (line ~180), and the `/me` debug block (lines ~424–432 `console.log('=== /auth/me endpoint called ===')` etc.). Keep `console.error` in catch blocks.
- `server/routes/loans.js`: `console.log('Applied filter:', filter)` (~179); the `/summary` request-dump block (~226–228); approve-route company logs (~603–604); disburse-route access logs (~766–777); the pre-save-related logs elsewhere in the file — sweep the file: every `console.log` that prints `req.user`, tokens, filters, or documents goes; plain progress strings may stay or go at your discretion, prefer go.
- `server/routes/users.js`: create-route dump (lines ~163–165, 182–191).
- `server/routes/reports.js`: the entire debug block in `/overview` that loads every loan (`const allLoans = await Loan.find(...)` + sample logging, lines ~48–120 per audit; delete the **query** as well as the logs — it exists only to feed the logs and is a cross-tenant PII log leak + perf bomb). All other emoji-prefixed `console.log`s in the file go too.
- `server/routes/dashboard.js`, `server/routes/companies.js`, `server/routes/system.js`: sweep remaining `console.log`s of user/filter/document data.
- `server/models/Loan.js`: the pre-save hook log (`console.log('Loan pre-save hook triggered...')`, line 521). Leave the `NODE_ENV === 'test'` debug blocks — they're Phase 05 cleanup alongside `debugSchedule`.

Rule of thumb: `console.error(...)` in catch blocks stays; `console.log` of request/user/token/document data is deleted, not commented out.

6b. Error-message gating: in `server/routes/dashboard.js` (4 handlers, e.g. lines 64, 231, 397, 502) and `server/routes/products.js` (all handlers), responses currently include `error: error.message` unconditionally. Change each to the pattern used elsewhere:

```js
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
```

Also `server/routes/loans.js` Excel-export catch (~line 106) per audit.

6c. Forgot-password: leave the dev-gated `resetToken` in the response for now (it's the only working reset path until Phase 09 adds email) — but add a `// TODO(phase-09): remove once reset emails send` comment on that line.

### Step 7 — `.env.example` files

Create `server/.env.example` (names and comments only, **no real values**):

```
# Required — server exits at boot if missing
MONGODB_URI=
JWT_SECRET=

# Optional
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Create `client/.env.example`:

```
VITE_API_URL=http://localhost:5000/api
```

Do not add the SMTP block yet (nothing reads it functionally until Phase 09). Note in the changelog that `JWT_EXPIRE` in the local `.env` is unused and can be deleted.

### Step 8 — Verify & close out

1. `cd server && pnpm test` → 133/133.
2. Boot server with `JWT_SECRET` unset → process exits with the missing-env message.
3. Login 6× with a bad password → 6th attempt returns 429.
4. `GET /api/loans?status[$ne]=x` with a valid token → sanitized (no operator injection; returns normal filtered/empty result, not all loans).
5. Refresh flow end-to-end (Step 2e).
6. `grep -rn "your-secret-key" server` → no matches. `grep -rn "console.log" server/routes | wc -l` → 0 (or only deliberate, justified survivors listed in the session report).
7. Client: `pnpm build` green; manual login smoke test.
8. Update `CLAUDE.md` Section 6 (all baseline items now resolved except role rename), Section 4 (env vars now documented via `.env.example`), Section 8 (note payload unification done; migration still pending). Changelog entry. Commit; merge with green suite.

## Acceptance criteria

1. Suite 133/133.
2. All eight verification points in Step 8 pass.
3. `pnpm audit --prod` on the server shows 0 high-severity findings in production dependencies (or each survivor is listed + justified in the changelog).
4. `.env.example` files exist; no secrets committed (`git diff` review before commit).

## Session sizing

Realistically **1–2 sessions**. Safe split point: Steps 1–4 (auth correctness + middleware) in session A — commit with green suite; Steps 5–7 (dependency bumps + log sweep + env files) in session B. The dependency bump (Step 5) is the most likely to eat time; if `pnpm update` breaks the client build, stop, record the exact breakage, and flag rather than pinning random versions.

## Rollback

Plain code commits; `git revert` the merge commit. The dependency bumps are in `package.json`/`pnpm-lock.yaml` and revert with the same commit. No data migrations. Reverting Step 1 restores the fallback-secret hole — same caution as Phase 01 rollback.

## Flagged concerns

- Tokens in `localStorage` (`client/src/utils/roleUtils.js:29`) are XSS-exfiltratable; acceptable short-term, should be revisited in the planned auth migration — **not** fixed here.
- 7-day access tokens are long for a fintech app. Left unchanged deliberately (shortening requires a working client refresh loop; the auth migration will handle it). Flag stands.
- `authorize`/`authorizeRole` grant `super_user` an implicit bypass; that's by design but worth a deliberate re-check when roles are renamed in Phase 03.
