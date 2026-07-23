const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants, PASSWORD, createUser } = require('../helpers/fixtures');
const User = require('../../models/User');

describe('Session auth (Phase 25)', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('a session survives across multiple requests', async () => {
    const agent = request.agent(app);

    const login = await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminA.username, password: PASSWORD });
    expect(login.status).toBe(200);

    const first = await agent.get('/api/auth/me');
    expect(first.status).toBe(200);
    expect(first.body.data.user.username).toBe(fx.lenderAdminA.username);

    const second = await agent.get('/api/auth/me');
    expect(second.status).toBe(200);
    expect(second.body.data.user.username).toBe(fx.lenderAdminA.username);
  });

  it('deactivating a user locks out their very next request on an already-live session', async () => {
    const user = await createUser({ username: 'sessiontestuser', role: 'lender_officer', company: fx.lenderA._id });
    const agent = request.agent(app);

    const login = await agent
      .post('/api/auth/login')
      .send({ username: user.username, password: PASSWORD });
    expect(login.status).toBe(200);

    const before = await agent.get('/api/auth/me');
    expect(before.status).toBe(200);

    await User.findByIdAndUpdate(user._id, { isActive: false });

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);

    // and the session is actually gone, not just this one 401
    const again = await agent.get('/api/auth/me');
    expect(again.status).toBe(401);
  });

  it('logout destroys the session — a subsequent request is unauthenticated', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminB.username, password: PASSWORD });

    const beforeLogout = await agent.get('/api/auth/me');
    expect(beforeLogout.status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const afterLogout = await agent.get('/api/auth/me');
    expect(afterLogout.status).toBe(401);
  });

  it('the Origin check rejects a cross-origin state-changing request even with a valid session', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminA.username, password: PASSWORD });

    const res = await agent
      .post('/api/auth/change-password')
      .set('Origin', 'https://evil-attacker.example')
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123!' });

    expect(res.status).toBe(403);
  });

  it('the Origin check allows a same-origin state-changing request', async () => {
    const agent = request.agent(app);

    await agent
      .post('/api/auth/login')
      .send({ username: fx.lenderAdminB.username, password: PASSWORD });

    const res = await agent
      .post('/api/auth/change-password')
      .set('Origin', process.env.CORS_ORIGIN || 'http://localhost:5173')
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewPass123!' });

    // Origin allowed, so this reaches the handler and fails on password, not on Origin
    expect(res.status).toBe(400);
  });
});
