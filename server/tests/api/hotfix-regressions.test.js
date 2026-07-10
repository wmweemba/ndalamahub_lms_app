// Regression pins for the two critical authorization defects found while
// planning Phase 03b and hotfixed directly on `main` on 2026-07-10 (see
// changelog.md "2026-07-10 (security hotfix + Phase 03b planning)" and
// docs/03b-api-test-scaffold.md). These tests must keep passing through
// Phase 04's wholesale replacement of these route blocks.

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const db = require('../helpers/db');
const { seedTwoTenants, createLoan } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('Hotfix regressions (2026-07-10)', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('PUT /api/loans/:id/approve and /reject — cross-tenant lender_admin bypass (fixed)', () => {
    it('approve as lenderAdminB on loanA_pending -> 403 and the loan stays pending', async () => {
      const res = await request(app)
        .put(`/api/loans/${fx.loanA_pending._id}/approve`)
        .set(authHeader(fx.lenderAdminB))
        .send({});

      expect(res.status).toBe(403);

      const Loan = require('../../models/Loan');
      const loan = await Loan.findById(fx.loanA_pending._id);
      expect(loan.status).toBe('pending_approval');
    });

    it('reject as lenderAdminB on a fresh pending loan -> 403, loan unchanged', async () => {
      const freshPending = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });

      const res = await request(app)
        .put(`/api/loans/${freshPending._id}/reject`)
        .set(authHeader(fx.lenderAdminB))
        .send({ approvalNotes: 'attempted cross-tenant rejection' });

      expect(res.status).toBe(403);

      const Loan = require('../../models/Loan');
      const loan = await Loan.findById(freshPending._id);
      expect(loan.status).toBe('pending_approval');
    });

    it('approve as lenderAdminA (the loan\'s own lender) -> 200 and status approved (allow-path not over-tightened)', async () => {
      const ownPending = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });

      const res = await request(app)
        .put(`/api/loans/${ownPending._id}/approve`)
        .set(authHeader(fx.lenderAdminA))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.loan.status).toBe('approved');
    });
  });

  describe('PUT /api/users/:id — role-update escalation cap (fixed)', () => {
    it('employerAdminA sets borrowerA.role to platform_admin -> 403, stored role still borrower', async () => {
      const res = await request(app)
        .put(`/api/users/${fx.borrowerA._id}`)
        .set(authHeader(fx.employerAdminA))
        .send({ role: 'platform_admin' });

      expect(res.status).toBe(403);

      const user = await User.findById(fx.borrowerA._id);
      expect(user.role).toBe('borrower');
    });

    it('employerAdminA sets borrowerA.role to employer_hr (at/below own level) -> 200, role changes (cap does not block legitimate updates)', async () => {
      const res = await request(app)
        .put(`/api/users/${fx.borrowerA._id}`)
        .set(authHeader(fx.employerAdminA))
        .send({ role: 'employer_hr' });

      expect(res.status).toBe(200);

      const user = await User.findById(fx.borrowerA._id);
      expect(user.role).toBe('employer_hr');
    });
  });
});
