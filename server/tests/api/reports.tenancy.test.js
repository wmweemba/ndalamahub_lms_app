const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const loanIdsOf = (rows) => rows.map((l) => l._id.toString());

describe('Reports / dashboard tenancy', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('GET /api/reports/loans', () => {
    it('as employerAdminA -> rows reference loanA only', async () => {
      const res = await request(app).get('/api/reports/loans').set(await authHeader(fx.employerAdminA));
      expect(res.status).toBe(200);
      const ids = loanIdsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanA._id.toString());
      expect(ids).not.toContain(fx.loanB._id.toString());
      expect(ids).not.toContain(fx.loanB_pending._id.toString());
    });

    it('as lenderAdminB -> rows reference loanB only', async () => {
      const res = await request(app).get('/api/reports/loans').set(await authHeader(fx.lenderAdminB));
      expect(res.status).toBe(200);
      const ids = loanIdsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanB._id.toString());
      expect(ids).not.toContain(fx.loanA._id.toString());
      expect(ids).not.toContain(fx.loanA_pending._id.toString());
    });
  });

  describe('GET /api/reports/companies', () => {
    it('as lenderAdminA -> employerA scope only, employerB absent', async () => {
      const res = await request(app).get('/api/reports/companies').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
      const companyIds = res.body.data.companies.map((c) => c._id.toString());
      expect(companyIds).toContain(fx.employerA._id.toString());
      expect(companyIds).not.toContain(fx.employerB._id.toString());
    });

    it('as employerAdminA -> 403 (pins the Phase 03 fix of the formerly broken-open authorizeMinRole gate)', async () => {
      const res = await request(app).get('/api/reports/companies').set(await authHeader(fx.employerAdminA));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('as employerAdminA -> loan counts reflect tenant A only (count must be 1)', async () => {
      const res = await request(app).get('/api/dashboard/stats').set(await authHeader(fx.employerAdminA));
      expect(res.status).toBe(200);
      expect(res.body.data.activeLoans).toBe(1);
      expect(res.body.data.totalLoanAmount).toBe(fx.loanA.amount);
    });
  });

  describe('GET /api/dashboard/lender-stats', () => {
    it('as lenderAdminA -> tenant-A counts only', async () => {
      const res = await request(app).get('/api/dashboard/lender-stats').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
      const summary = res.body.data.portfolioSummary;
      expect(summary.totalLoans).toBe(2);
      expect(summary.activeLoans).toBe(1);
      expect(summary.pendingLoans).toBe(1);
    });
  });
});
