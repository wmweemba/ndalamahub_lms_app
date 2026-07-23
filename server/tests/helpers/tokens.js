const request = require('supertest');
const app = require('../../app');
const { PASSWORD } = require('./fixtures');

// Session-based replacement for the old JWT bearer-token helper (Phase 25).
// Logs in as `user` and returns a { Cookie } header object carrying the
// resulting session cookie. Call sites are unchanged in shape
// (`.set(await authHeader(user))`) — just async now, since a real login
// round-trip replaces synchronous token minting.
//
// Cached per username (module-lifetime, i.e. per test file): a single test
// file can call this dozens of times for the same seeded user, and each
// call is now a real POST /api/auth/login hitting the per-username login
// rate limiter (5/15min) — without caching, a handful of tests were enough
// to trip it. A cached cookie is reused for the file's whole run rather
// than re-logging in every time.
const cache = new Map();

const authHeader = async (user) => {
  if (!cache.has(user.username)) {
    cache.set(user.username, (async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: PASSWORD });

      if (res.status !== 200 || !res.headers['set-cookie']) {
        throw new Error(`authHeader: login failed for user "${user.username}" (status ${res.status})`);
      }

      return { Cookie: res.headers['set-cookie'] };
    })());
  }

  return cache.get(user.username);
};

module.exports = { authHeader };
