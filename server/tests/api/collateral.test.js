// Phase 21 — collateral register: CRUD, tenancy, and the approve/disburse
// enforcement gates.
const request = require('supertest');
const app = require('../../app');
const LoanProduct = require('../../models/LoanProduct');
const Collateral = require('../../models/Collateral');
const db = require('../helpers/db');
const { seedTwoTenants, createUser, createLoan } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const makeProduct = (companyId, collateralRequired) => LoanProduct.create({
  name: 'Test Product',
  description: 'Test product',
  category: 'business',
  company: companyId,
  interestRate: { min: 10, max: 30, default: 25 },
  term: { min: 1, max: 12, default: 3 },
  amount: { min: 1000, max: 100000 },
  collateralRequired
});

describe('Phase 21 — collateral register', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('CRUD + tenancy', () => {
    it('lender_officer can declare collateral on their own tenant loan -> 201', async () => {
      const res = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ type: 'vehicle', description: 'Toyota Hilux', estimatedValue: 50000 });
      expect(res.status).toBe(201);
      expect(res.body.data.collateral.status).toBe('declared');
    });

    it('lender_officer of a different tenant gets 403 declaring on another lender\'s loan', async () => {
      const res = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.lenderOfficerB))
        .send({ type: 'vehicle', description: 'Toyota Hilux', estimatedValue: 50000 });
      expect(res.status).toBe(403);
    });

    it('a borrower can declare collateral on their own loan -> 201', async () => {
      const res = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.borrowerA))
        .send({ type: 'vehicle', description: 'Toyota Hilux', estimatedValue: 50000 });
      expect(res.status).toBe(201);
    });

    it('a borrower cannot declare collateral on someone else\'s loan -> 403', async () => {
      const res = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.borrowerB))
        .send({ type: 'vehicle', description: 'Toyota Hilux', estimatedValue: 50000 });
      expect(res.status).toBe(403);
    });

    it('borrower reads their own loan\'s collateral via GET /loans/:id', async () => {
      const res = await request(app)
        .get(`/api/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.borrowerA));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.collateral)).toBe(true);
      expect(res.body.data.collateral.length).toBeGreaterThan(0);
    });

    it('type "other" requires otherDescription', async () => {
      const res = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ type: 'other', description: 'Something unusual', estimatedValue: 1000 });
      expect(res.status).toBe(400);
    });

    it('editing a verified record resets it to declared', async () => {
      const created = await request(app)
        .post(`/api/collateral/loans/${fx.loanA_pending._id}`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ type: 'title_deed', description: 'Plot 123', estimatedValue: 80000 });
      const id = created.body.data.collateral._id;

      await request(app).put(`/api/collateral/${id}/verify`).set(authHeader(fx.lenderOfficerA)).send({});

      const edited = await request(app)
        .put(`/api/collateral/${id}`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ estimatedValue: 90000 });

      expect(edited.status).toBe(200);
      expect(edited.body.data.collateral.status).toBe('declared');
    });
  });

  describe('register scoping', () => {
    it('GET /api/collateral only returns the caller\'s own tenant records', async () => {
      const res = await request(app).get('/api/collateral').set(authHeader(fx.lenderAdminA));
      expect(res.status).toBe(200);
      const lenderIds = res.body.data.collateral.map((c) => c.lenderCompany?._id || c.lenderCompany);
      expect(lenderIds.every((id) => id === fx.lenderA._id.toString())).toBe(true);
    });

    it('platform_admin sees all tenants', async () => {
      const res = await request(app).get('/api/collateral').set(authHeader(fx.platformAdmin));
      expect(res.status).toBe(200);
    });
  });

  describe('approve/disburse enforcement', () => {
    it('blocks approval until collateral is verified, then allows it', async () => {
      const product = await makeProduct(fx.lenderA._id, true);
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });
      loan.product = product._id;
      await loan.save();

      const blocked = await request(app)
        .put(`/api/loans/${loan._id}/approve`)
        .set(authHeader(fx.employerHrA))
        .send({});
      expect(blocked.status).toBe(422);
      expect(blocked.body.message).toMatch(/collateral/i);

      const declared = await request(app)
        .post(`/api/collateral/loans/${loan._id}`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ type: 'vehicle', description: 'Delivery van', estimatedValue: 30000 });
      const collateralId = declared.body.data.collateral._id;

      const stillBlocked = await request(app)
        .put(`/api/loans/${loan._id}/approve`)
        .set(authHeader(fx.employerHrA))
        .send({});
      expect(stillBlocked.status).toBe(422);

      await request(app).put(`/api/collateral/${collateralId}/verify`).set(authHeader(fx.lenderOfficerA)).send({});

      const approved = await request(app)
        .put(`/api/loans/${loan._id}/approve`)
        .set(authHeader(fx.employerHrA))
        .send({});
      expect(approved.status).toBe(200);
    });

    it('blocks disbursement until letter of sale is on file, then allows it', async () => {
      const product = await makeProduct(fx.lenderA._id, true);
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });
      loan.product = product._id;
      await loan.save();

      const collateral = await Collateral.create({
        lenderCompany: fx.lenderA._id,
        loan: loan._id,
        type: 'vehicle',
        description: 'Sedan',
        estimatedValue: 20000,
        status: 'verified',
        vettedBy: fx.lenderOfficerA._id,
        vettedAt: new Date()
      });

      await request(app).put(`/api/loans/${loan._id}/approve`).set(authHeader(fx.employerHrA)).send({});

      const blocked = await request(app)
        .put(`/api/loans/${loan._id}/disburse`)
        .set(authHeader(fx.lenderAdminA))
        .send({ disbursementMethod: 'mobile_money' });
      expect(blocked.status).toBe(422);
      expect(blocked.body.message).toMatch(/letter of sale/i);

      await request(app)
        .put(`/api/collateral/${collateral._id}/letter-of-sale`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ onFile: true, reference: 'LOS-001' });

      const disbursed = await request(app)
        .put(`/api/loans/${loan._id}/disburse`)
        .set(authHeader(fx.lenderAdminA))
        .send({ disbursementMethod: 'mobile_money' });
      expect(disbursed.status).toBe(200);
    });

    it('non-collateral products are unaffected', async () => {
      const product = await makeProduct(fx.lenderA._id, false);
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });
      loan.product = product._id;
      await loan.save();

      const approved = await request(app)
        .put(`/api/loans/${loan._id}/approve`)
        .set(authHeader(fx.employerHrA))
        .send({});
      expect(approved.status).toBe(200);

      const disbursed = await request(app)
        .put(`/api/loans/${loan._id}/disburse`)
        .set(authHeader(fx.lenderAdminA))
        .send({ disbursementMethod: 'mobile_money' });
      expect(disbursed.status).toBe(200);
    });

    it('loans with no product at all are unaffected', async () => {
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'pending_approval'
      });

      const approved = await request(app)
        .put(`/api/loans/${loan._id}/approve`)
        .set(authHeader(fx.employerHrA))
        .send({});
      expect(approved.status).toBe(200);
    });
  });
});
