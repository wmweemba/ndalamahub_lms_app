const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('GET /api/loans status filter validation', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('an injected operator sanitized to an empty object -> 400, not 500 and not all loans', async () => {
    const res = await request(app)
      .get('/api/loans')
      .query('status[$ne]=x')
      .set(await authHeader(fx.platformAdmin));
    expect(res.status).toBe(400);
  });

  it('a valid status -> 200, filtered', async () => {
    const res = await request(app)
      .get('/api/loans')
      .query({ status: 'active' })
      .set(await authHeader(fx.platformAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.loans.every((l) => l.status === 'active')).toBe(true);
  });

  it('a nonsense status -> 400', async () => {
    const res = await request(app)
      .get('/api/loans')
      .query({ status: 'nonsense' })
      .set(await authHeader(fx.platformAdmin));
    expect(res.status).toBe(400);
  });
});
