// Phase 19 — direct-lending model, the companyLenderId subscription-gate
// fix, and the approve/reject authority matrix (lender_officer gains
// approval authority over direct loans only).
const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const Loan = require('../../models/Loan');
const db = require('../helpers/db');
const { seedTwoTenants, createUser, createLoan } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

describe('Phase 19 — direct lending & the companyLenderId fix', () => {
  let fx;
  let directLender, directBorrower, directLoan;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();

    directLender = await Company.create({
      name: 'Direct Lender Co',
      type: 'lender',
      lendingModel: 'direct',
      registrationNumber: 'DIRECT-1',
      address: { street: '1 St', city: 'Lusaka', province: 'Lusaka' },
      contactInfo: { phone: '+260970000010', email: 'direct1@example.com' },
      subscription: { status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });

    directBorrower = await createUser({
      username: 'directborrower1',
      role: 'borrower',
      company: directLender._id,
      nrc: '111111/10/1'
    });

    directLoan = await createLoan({
      applicant: directBorrower._id,
      company: directLender._id,
      lenderCompany: directLender._id,
      status: 'pending_approval'
    });
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('companyLenderId lender-self fix', () => {
    it('a direct borrower under a suspended lender gets 402', async () => {
      await Company.findByIdAndUpdate(directLender._id, { subscription: { status: 'suspended', suspendedAt: new Date() } });
      const res = await request(app).get('/api/loans').set(await authHeader(directBorrower));
      expect(res.status).toBe(402);
      expect(res.body.code).toBe('SUBSCRIPTION_LOCKED');
    });

    it('under an active lender, product listing resolves (no fail-open, no fail-closed)', async () => {
      await Company.findByIdAndUpdate(directLender._id, { subscription: { status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
      const res = await request(app).get('/api/products/available').set(await authHeader(directBorrower));
      expect(res.status).toBe(200);
    });
  });

  describe('approve/reject authority matrix', () => {
    let freshDirectPending;
    let freshEmployerPending;

    beforeEach(async () => {
      freshDirectPending = await createLoan({
        applicant: directBorrower._id,
        company: directLender._id,
        lenderCompany: directLender._id,
        status: 'pending_approval'
      });
      freshEmployerPending = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });
    });

    it('direct loan: lender_officer of the same lender approves -> 200', async () => {
      const officer = await createUser({ username: 'directofficer1', role: 'lender_officer', company: directLender._id });
      const res = await request(app)
        .put(`/api/loans/${freshDirectPending._id}/approve`)
        .set(await authHeader(officer))
        .send({});
      expect(res.status).toBe(200);
    });

    it('direct loan: employer_hr of any company gets 403', async () => {
      const res = await request(app)
        .put(`/api/loans/${freshDirectPending._id}/approve`)
        .set(await authHeader(fx.employerHrA))
        .send({});
      expect(res.status).toBe(403);
    });

    it('direct loan: a lender_officer of a different lender gets 403 (cross-tenant)', async () => {
      const res = await request(app)
        .put(`/api/loans/${freshDirectPending._id}/approve`)
        .set(await authHeader(fx.lenderOfficerA))
        .send({});
      expect(res.status).toBe(403);
    });

    it('direct loan: lender_admin approves and disburses -> 200 both', async () => {
      const admin = await createUser({ username: 'directadmin1', role: 'lender_admin', company: directLender._id });
      const approveRes = await request(app)
        .put(`/api/loans/${freshDirectPending._id}/approve`)
        .set(await authHeader(admin))
        .send({});
      expect(approveRes.status).toBe(200);

      const disburseRes = await request(app)
        .put(`/api/loans/${freshDirectPending._id}/disburse`)
        .set(await authHeader(admin))
        .send({ disbursementMethod: 'mobile_money' });
      expect(disburseRes.status).toBe(200);
    });

    it('employer loan: lender_officer still gets 403 (matrix unchanged for employer-model loans)', async () => {
      const res = await request(app)
        .put(`/api/loans/${freshEmployerPending._id}/approve`)
        .set(await authHeader(fx.lenderOfficerA))
        .send({});
      expect(res.status).toBe(403);
    });

    it('employer loan: employerHrA of the loan\'s own company still approves -> 200', async () => {
      const res = await request(app)
        .put(`/api/loans/${freshEmployerPending._id}/approve`)
        .set(await authHeader(fx.employerHrA))
        .send({});
      expect(res.status).toBe(200);
    });
  });

  describe('loan creation sets company = lenderCompany for a direct borrower', () => {
    it('POST /api/loans as a direct borrower creates a loan with company === lenderCompany === the lender', async () => {
      // A fresh borrower — directBorrower has accumulated approved/active
      // loans from the approve/reject matrix tests above, which would 400
      // this create on the "existing active loan" guard.
      const freshDirectBorrower = await createUser({
        username: 'directborrowerfresh1',
        role: 'borrower',
        company: directLender._id,
        nrc: '999999/10/1'
      });

      const res = await request(app)
        .post('/api/loans')
        .set(await authHeader(freshDirectBorrower))
        .send({ amount: 5000, term: 3, purpose: 'Test direct application' });

      expect(res.status).toBe(201);
      const loan = res.body.data.loan;
      expect(loan.company._id || loan.company).toBe(directLender._id.toString());
      expect(loan.lenderCompany._id || loan.lenderCompany).toBe(directLender._id.toString());
    });
  });
});
