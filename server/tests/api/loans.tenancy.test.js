const request = require('supertest');
const app = require('../../app');
const Loan = require('../../models/Loan');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const idsOf = (loans) => loans.map((l) => l._id.toString());

describe('Loans tenancy', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('GET /api/loans list scoping', () => {
    it('platformAdmin sees loanA and loanB', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.platformAdmin));
      expect(res.status).toBe(200);
      const ids = idsOf(res.body.data.loans);
      expect(ids).toEqual(expect.arrayContaining([fx.loanA._id.toString(), fx.loanB._id.toString()]));
    });

    it('lenderAdminA sees loanA, not loanB', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
      const ids = idsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanA._id.toString());
      expect(ids).not.toContain(fx.loanB._id.toString());
    });

    it('employerAdminB sees loanB only', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.employerAdminB));
      expect(res.status).toBe(200);
      const ids = idsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanB._id.toString());
      expect(ids).not.toContain(fx.loanA._id.toString());
    });

    it('employerHrA sees loanA only', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.employerHrA));
      expect(res.status).toBe(200);
      const ids = idsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanA._id.toString());
      expect(ids).not.toContain(fx.loanB._id.toString());
    });

    it('borrowerA sees loanA only (own loans), not loanB', async () => {
      const res = await request(app).get('/api/loans').set(await authHeader(fx.borrowerA));
      expect(res.status).toBe(200);
      const ids = idsOf(res.body.data.loans);
      expect(ids).toContain(fx.loanA._id.toString());
      expect(ids).not.toContain(fx.loanB._id.toString());
      expect(ids).not.toContain(fx.loanB_pending._id.toString());
    });
  });

  describe('GET /api/loans/:id document-level access', () => {
    it('lenderAdminA on loanA -> 200', async () => {
      const res = await request(app)
        .get(`/api/loans/${fx.loanA._id}`)
        .set(await authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
    });

    it('lenderAdminB on loanA -> 403', async () => {
      const res = await request(app)
        .get(`/api/loans/${fx.loanA._id}`)
        .set(await authHeader(fx.lenderAdminB));
      expect(res.status).toBe(403);
    });

    it('employerAdminB on loanA -> 403', async () => {
      const res = await request(app)
        .get(`/api/loans/${fx.loanA._id}`)
        .set(await authHeader(fx.employerAdminB));
      expect(res.status).toBe(403);
    });

    it('borrowerB on loanA -> 403', async () => {
      const res = await request(app)
        .get(`/api/loans/${fx.loanA._id}`)
        .set(await authHeader(fx.borrowerB));
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/loans/:id/repayment write path', () => {
    const todayStr = () => new Date().toISOString().split('T')[0];

    it('lenderAdminA on loanA -> 200; installment reflects the payment', async () => {
      const res = await request(app)
        .put(`/api/loans/${fx.loanA._id}/repayment`)
        .set(await authHeader(fx.lenderAdminA))
        .send({
          installmentNumber: 1,
          amount: 100,
          paymentDate: todayStr(),
          paymentMethod: 'cash',
          referenceNumber: 'tenancy-test-ref-1'
        });

      expect(res.status).toBe(200);
      const installment = res.body.data.loan.repaymentSchedule.find((i) => i.installmentNumber === 1);
      expect(installment.paidAmount).toBeGreaterThanOrEqual(100);
    });

    it('lenderAdminB on loanA -> 403 and the loan is unchanged', async () => {
      const before = await Loan.findById(fx.loanA._id);
      const beforeInstallment = before.repaymentSchedule.find((i) => i.installmentNumber === 2);

      const res = await request(app)
        .put(`/api/loans/${fx.loanA._id}/repayment`)
        .set(await authHeader(fx.lenderAdminB))
        .send({
          installmentNumber: 2,
          amount: 100,
          paymentDate: todayStr(),
          paymentMethod: 'cash',
          referenceNumber: 'tenancy-test-ref-2'
        });

      expect(res.status).toBe(403);

      const after = await Loan.findById(fx.loanA._id);
      const afterInstallment = after.repaymentSchedule.find((i) => i.installmentNumber === 2);
      expect(afterInstallment.paidAmount).toBe(beforeInstallment.paidAmount);
      expect(afterInstallment.status).toBe(beforeInstallment.status);
    });

    it('employerAdminA on loanA -> 403 (role guard: employer-side is read-only on repayments)', async () => {
      const res = await request(app)
        .put(`/api/loans/${fx.loanA._id}/repayment`)
        .set(await authHeader(fx.employerAdminA))
        .send({
          installmentNumber: 3,
          amount: 100,
          paymentDate: todayStr(),
          paymentMethod: 'cash',
          referenceNumber: 'tenancy-test-ref-3'
        });
      expect(res.status).toBe(403);
    });

    it('lenderOfficerB on loanA -> 403 (right role, wrong tenant)', async () => {
      const res = await request(app)
        .put(`/api/loans/${fx.loanA._id}/repayment`)
        .set(await authHeader(fx.lenderOfficerB))
        .send({
          installmentNumber: 3,
          amount: 100,
          paymentDate: todayStr(),
          paymentMethod: 'cash',
          referenceNumber: 'tenancy-test-ref-4'
        });
      expect(res.status).toBe(403);
    });
  });
});
