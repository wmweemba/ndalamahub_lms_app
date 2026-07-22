const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const idsOf = (companies) => companies.map((c) => c._id.toString());

describe('Companies tenancy', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('GET /api/companies as lenderAdminA -> exactly lenderA + employerA', async () => {
    const res = await request(app).get('/api/companies').set(authHeader(fx.lenderAdminA));
    expect(res.status).toBe(200);
    const ids = idsOf(res.body);
    expect(ids.sort()).toEqual([fx.employerA._id.toString(), fx.lenderA._id.toString()].sort());
  });

  it('GET /api/companies as employerAdminA -> exactly [employerA]', async () => {
    const res = await request(app).get('/api/companies').set(authHeader(fx.employerAdminA));
    expect(res.status).toBe(200);
    const ids = idsOf(res.body);
    expect(ids).toEqual([fx.employerA._id.toString()]);
  });

  it('GET /api/companies as borrowerA -> 403', async () => {
    const res = await request(app).get('/api/companies').set(authHeader(fx.borrowerA));
    expect(res.status).toBe(403);
  });

  it('PUT /api/companies/:employerB._id as lenderAdminA -> 403, document unchanged', async () => {
    const before = await Company.findById(fx.employerB._id);
    const res = await request(app)
      .put(`/api/companies/${fx.employerB._id}`)
      .set(authHeader(fx.lenderAdminA))
      .send({ description: 'hijacked' });
    expect(res.status).toBe(403);
    const after = await Company.findById(fx.employerB._id);
    expect(after.description).toBe(before.description);
  });

  it('DELETE /api/companies/:employerB._id as lenderAdminA -> 403, document still exists', async () => {
    const res = await request(app)
      .delete(`/api/companies/${fx.employerB._id}`)
      .set(authHeader(fx.lenderAdminA));
    expect(res.status).toBe(403);
    const stillExists = await Company.findById(fx.employerB._id);
    expect(stillExists).not.toBeNull();
  });

  it('PUT /api/companies/:employerA._id as employerAdminB -> 403', async () => {
    const res = await request(app)
      .put(`/api/companies/${fx.employerA._id}`)
      .set(authHeader(fx.employerAdminB))
      .send({ description: 'hijacked' });
    expect(res.status).toBe(403);
  });

  describe('lendingModel (Phase 19)', () => {
    it('rejects lendingModel: direct on a corporate company', async () => {
      await expect(Company.create({
        name: 'Bad Corporate',
        type: 'corporate',
        lendingModel: 'direct',
        lenderCompany: fx.lenderA._id,
        registrationNumber: 'BAD-CORP-1',
        address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
        contactInfo: { phone: '+260970000050', email: 'badcorp@example.com' }
      })).rejects.toThrow();
    });

    it('platform_admin can create a lender with lendingModel: direct', async () => {
      const res = await request(app)
        .post('/api/companies')
        .set(authHeader(fx.platformAdmin))
        .send({
          name: 'New Direct Lender',
          type: 'lender',
          lendingModel: 'direct',
          registrationNumber: 'NEW-DIRECT-1',
          address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
          contactInfo: { phone: '+260970000051', email: 'newdirect@example.com' }
        });
      expect(res.status).toBe(201);
      expect(res.body.lendingModel).toBe('direct');
    });

    it('lender_admin cannot change their own lendingModel via PUT (platform-level act only)', async () => {
      const before = await Company.findById(fx.lenderA._id);
      const res = await request(app)
        .put(`/api/companies/${fx.lenderA._id}`)
        .set(authHeader(fx.lenderAdminA))
        .send({ lendingModel: 'direct' });
      expect(res.status).toBe(200);
      const after = await Company.findById(fx.lenderA._id);
      expect(after.lendingModel).toBe(before.lendingModel);
    });

    it('platform_admin can change a lender\'s lendingModel via PUT', async () => {
      const res = await request(app)
        .put(`/api/companies/${fx.lenderB._id}`)
        .set(authHeader(fx.platformAdmin))
        .send({ lendingModel: 'direct' });
      expect(res.status).toBe(200);
      const after = await Company.findById(fx.lenderB._id);
      expect(after.lendingModel).toBe('direct');
    });
  });
});
