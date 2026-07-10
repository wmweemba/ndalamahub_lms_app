const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants, PASSWORD } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('Smoke tests', () => {
  let fixtures;

  beforeAll(async () => {
    await db.connect();
    fixtures = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('GET /api/health returns 200 without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET /api/loans with no token returns 401', async () => {
    const res = await request(app).get('/api/loans');
    expect(res.status).toBe(401);
  });

  it('GET /api/loans with a garbage token returns 401', async () => {
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login with seeded credentials returns 200 with token and refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: fixtures.lenderAdminA.username, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded).toMatchObject({
      id: fixtures.lenderAdminA._id.toString(),
      username: fixtures.lenderAdminA.username,
      role: 'lender_admin',
      company: fixtures.lenderA._id.toString()
    });
  });

  it('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: fixtures.lenderAdminA.username, password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with a minted token returns 200 and the right user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(fixtures.lenderAdminA));

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(fixtures.lenderAdminA.username);
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
