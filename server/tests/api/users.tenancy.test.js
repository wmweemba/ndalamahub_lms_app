const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const idsOf = (users) => users.map((u) => u._id.toString());

describe('Users tenancy', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('GET /api/users as employerAdminA -> only employerA users', async () => {
    const res = await request(app).get('/api/users').set(authHeader(fx.employerAdminA));
    expect(res.status).toBe(200);
    const ids = idsOf(res.body.data);
    expect(ids).not.toContain(fx.employerAdminB._id.toString());
    expect(ids).not.toContain(fx.borrowerB._id.toString());
    expect(ids).toContain(fx.employerAdminA._id.toString());
  });

  it('GET /api/users as lenderAdminA -> lenderA + employerA users only, none from tenant B', async () => {
    const res = await request(app).get('/api/users').set(authHeader(fx.lenderAdminA));
    expect(res.status).toBe(200);
    const ids = idsOf(res.body.data);
    expect(ids).toContain(fx.lenderAdminA._id.toString());
    expect(ids).toContain(fx.employerAdminA._id.toString());
    expect(ids).not.toContain(fx.lenderAdminB._id.toString());
    expect(ids).not.toContain(fx.employerAdminB._id.toString());
    expect(ids).not.toContain(fx.borrowerB._id.toString());
  });

  it('GET /api/users/:id as employerAdminA on borrowerB -> 403', async () => {
    const res = await request(app)
      .get(`/api/users/${fx.borrowerB._id}`)
      .set(authHeader(fx.employerAdminA));
    expect(res.status).toBe(403);
  });

  // Phase 04: document-level checks now go through canTouchUser (tenantScope.js),
  // which allows a lender admin to view their own corporate client's employee,
  // consistent with GET /api/users (list) and PATCH /:id/reset-password.
  it('GET /api/users/:id as lenderAdminA on borrowerA (own client employee) -> 200', async () => {
    const res = await request(app)
      .get(`/api/users/${fx.borrowerA._id}`)
      .set(authHeader(fx.lenderAdminA));
    expect(res.status).toBe(200);
  });

  it('POST /api/users as employerAdminA with company: employerB._id -> 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(authHeader(fx.employerAdminA))
      .send({
        firstName: 'Cross',
        lastName: 'Tenant',
        username: 'crosstenant1',
        email: 'crosstenant1@example.com',
        phone: '+260970000099',
        password: 'Test123!',
        role: 'borrower',
        company: fx.employerB._id.toString(),
        department: 'Ops'
      });
    expect(res.status).toBe(403);
  });

  it('POST /api/users as lenderAdminA creating a borrower in employerB -> 403 (not own company, not their client)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(authHeader(fx.lenderAdminA))
      .send({
        firstName: 'Cross',
        lastName: 'Tenant',
        username: 'crosstenant2',
        email: 'crosstenant2@example.com',
        phone: '+260970000098',
        password: 'Test123!',
        role: 'borrower',
        company: fx.employerB._id.toString(),
        department: 'Ops'
      });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/users/:id/status as employerAdminA on borrowerB -> 403', async () => {
    const res = await request(app)
      .patch(`/api/users/${fx.borrowerB._id}/status`)
      .set(authHeader(fx.employerAdminA))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('DELETE /api/users/:id as employerAdminA on borrowerB -> 403 and the user still exists', async () => {
    const res = await request(app)
      .delete(`/api/users/${fx.borrowerB._id}`)
      .set(authHeader(fx.employerAdminA));
    expect(res.status).toBe(403);

    const stillExists = await User.findById(fx.borrowerB._id);
    expect(stillExists).not.toBeNull();
  });
});
