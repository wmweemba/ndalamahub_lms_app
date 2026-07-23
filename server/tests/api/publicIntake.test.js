// Phase 22 — public website intake: the unauthenticated submission endpoint
// plus the authenticated review/conversion routes.
const request = require('supertest');
const app = require('../../app');
const Company = require('../../models/Company');
const User = require('../../models/User');
const Loan = require('../../models/Loan');
const LoanProduct = require('../../models/LoanProduct');
const CustomerApplication = require('../../models/CustomerApplication');
const db = require('../helpers/db');
const { createCompany, createUser } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');

const ORIGIN = 'https://manifipay.com';

const validPayload = (overrides = {}) => ({
  applicant: {
    fullName: 'Chanda Mwansa',
    nrc: '123456/10/1',
    phone: '+260971234567',
    email: 'chanda@example.com',
    address: '10 Cairo Road, Lusaka',
    employmentStatus: 'employed',
    employerName: 'Acme Ltd',
    monthlyIncome: 8000
  },
  loanRequest: {
    amount: 2500,
    purpose: 'School fees',
    termDays: 30
  },
  collateral: {
    type: 'other',
    otherDescription: 'Household goods',
    description: 'TV and sofa set',
    estimatedValue: 3000
  },
  website: '',
  ...overrides
});

describe('Phase 22 — public intake API', () => {
  let lenderDirect;
  let lenderEmployer;
  let lenderAdmin;
  let lenderOfficer;
  let otherLenderOfficer;
  let product;

  beforeAll(async () => {
    await db.connect();

    lenderDirect = await createCompany({ name: 'Manifi', type: 'lender', lendingModel: 'direct' });
    await Company.findByIdAndUpdate(lenderDirect._id, {
      publicIntake: { enabled: true, slug: 'manifipay', allowedOrigin: ORIGIN }
    });
    lenderDirect = await Company.findById(lenderDirect._id);

    lenderEmployer = await createCompany({ name: 'PayrollLender', type: 'lender' });
    await Company.findByIdAndUpdate(lenderEmployer._id, {
      publicIntake: { enabled: true, slug: 'payroll-lender', allowedOrigin: ORIGIN }
    });

    lenderAdmin = await createUser({ username: 'manifiadmin', role: 'lender_admin', company: lenderDirect._id });
    lenderOfficer = await createUser({ username: 'manifiofficer', role: 'lender_officer', company: lenderDirect._id });
    otherLenderOfficer = await createUser({ username: 'otherofficer', role: 'lender_officer', company: lenderEmployer._id });

    product = await LoanProduct.create({
      name: 'Payday Loan',
      description: 'Short term payday loan',
      category: 'payday',
      company: lenderDirect._id,
      interestRate: { min: 20, max: 30, default: 25 },
      term: { min: 7, max: 60, unit: 'days', default: 30 },
      amount: { min: 500, max: 10000 }
    });

    // A month-unit product in the same amount range — must never be matched
    // against a website submission's termDays (see findMatchingProduct's
    // comment; this pins the live-Atlas bug found during Phase 22 verification).
    await LoanProduct.create({
      name: 'Monthly Business Loan',
      description: 'Month-term product, same amount range as the payday product',
      category: 'business',
      company: lenderDirect._id,
      interestRate: { min: 20, max: 30, default: 25 },
      term: { min: 1, max: 12, unit: 'months', default: 3 },
      amount: { min: 500, max: 10000 }
    });
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('POST /api/public/:slug/applications', () => {
    it('creates a pending application on a valid submission', async () => {
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.reference).toMatch(/^APP/);

      const stored = await CustomerApplication.findOne({ reference: res.body.reference });
      expect(stored).not.toBeNull();
      expect(stored.status).toBe('pending');
      expect(stored.applicant.nrc).toBe('123456/10/1');
    });

    it('reflects the lender\'s registered origin in CORS headers', async () => {
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '223344/10/1' } }));

      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    });

    it('does not reflect a mismatched origin', async () => {
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', 'https://evil.example.com')
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '334455/10/1' } }));

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('honeypot field silently drops the submission', async () => {
      const before = await CustomerApplication.countDocuments({});
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ website: 'http://spam.example.com' }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reference).toBeDefined();
      const after = await CustomerApplication.countDocuments({});
      expect(after).toBe(before);
    });

    it('404s on an unknown slug', async () => {
      const res = await request(app)
        .post('/api/public/no-such-lender/applications')
        .send(validPayload());
      expect(res.status).toBe(404);
    });

    it('404s when the lender has intake disabled', async () => {
      const disabled = await createCompany({ name: 'DisabledLender', type: 'lender' });
      await Company.findByIdAndUpdate(disabled._id, {
        publicIntake: { enabled: false, slug: 'disabled-lender', allowedOrigin: ORIGIN }
      });

      const res = await request(app)
        .post('/api/public/disabled-lender/applications')
        .send(validPayload());
      expect(res.status).toBe(404);
    });

    it('refuses submissions when the lender is locked (suspended subscription)', async () => {
      const locked = await createCompany({
        name: 'LockedLender',
        type: 'lender',
        subscription: { status: 'suspended' }
      });
      await Company.findByIdAndUpdate(locked._id, {
        publicIntake: { enabled: true, slug: 'locked-lender', allowedOrigin: ORIGIN }
      });

      const res = await request(app)
        .post('/api/public/locked-lender/applications')
        .send(validPayload());
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });

    it('400s on validation failures', async () => {
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '' }, loanRequest: { amount: -5, purpose: '', termDays: 0 } }));

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('rate-limits rapid submissions (probe-only, does not affect other tests)', async () => {
      const send = () => request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .set('x-test-rate-limit', 'probe')
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: `${Date.now()}/10/1` } }));

      let lastStatus;
      for (let i = 0; i < 6; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await send();
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    });
  });

  describe('GET/PUT /api/customer-applications — tenancy and review', () => {
    let applicationId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '900001/10/1', email: 'review.test@example.com' } }));
      const stored = await CustomerApplication.findOne({ reference: res.body.reference });
      applicationId = stored._id.toString();
    });

    it('lists pending applications with a dedupe flag for the owning tenant', async () => {
      const res = await request(app)
        .get('/api/customer-applications')
        .set(await authHeader(lenderOfficer));
      expect(res.status).toBe(200);
      const found = res.body.data.applications.find((a) => a._id === applicationId);
      expect(found).toBeDefined();
      expect(found.dedupe === null || typeof found.dedupe === 'object').toBe(true);
    });

    it('denies GET/:id to a different lender\'s staff', async () => {
      const res = await request(app)
        .get(`/api/customer-applications/${applicationId}`)
        .set(await authHeader(otherLenderOfficer));
      expect(res.status).toBe(403);
    });

    it('denies reject to a different lender\'s staff', async () => {
      const res = await request(app)
        .put(`/api/customer-applications/${applicationId}/reject`)
        .set(await authHeader(otherLenderOfficer))
        .send({ reason: 'not mine' });
      expect(res.status).toBe(403);
    });

    it('requires a reason to reject', async () => {
      const res = await request(app)
        .put(`/api/customer-applications/${applicationId}/reject`)
        .set(await authHeader(lenderOfficer))
        .send({});
      expect(res.status).toBe(400);
    });

    it('approve creates a borrower, a pending loan, and declared collateral, correctly linked', async () => {
      const res = await request(app)
        .put(`/api/customer-applications/${applicationId}/approve`)
        .set(await authHeader(lenderAdmin))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('borrower');
      expect(res.body.data.user.company.toString()).toBe(lenderDirect._id.toString());
      expect(res.body.data.loan.applicant.toString()).toBe(res.body.data.user._id.toString());
      expect(res.body.data.loan.lenderCompany.toString()).toBe(lenderDirect._id.toString());
      expect(res.body.data.collateral).not.toBeNull();
      expect(res.body.data.collateral.loan.toString()).toBe(res.body.data.loan._id.toString());
      expect(res.body.data.collateral.status).toBe('declared');

      const application = await CustomerApplication.findById(applicationId);
      expect(application.status).toBe('approved');
      expect(application.createdUser.toString()).toBe(res.body.data.user._id.toString());
      expect(application.createdLoan.toString()).toBe(res.body.data.loan._id.toString());

      const loan = await Loan.findById(res.body.data.loan._id);
      expect(loan.product.toString()).toBe(product._id.toString());
      expect(loan.termUnit).toBe('days');
      expect(loan.term).toBe(30);
    });

    it('rejects re-approving an already-approved application', async () => {
      const res = await request(app)
        .put(`/api/customer-applications/${applicationId}/approve`)
        .set(await authHeader(lenderAdmin))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('conversion edge cases', () => {
    it('duplicate NRC on a fresh approve surfaces a dedupe conflict instead of 500ing', async () => {
      const submit = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '900001/10/1', email: 'dup.test@example.com' } }));
      const stored = await CustomerApplication.findOne({ reference: submit.body.reference });

      const res = await request(app)
        .put(`/api/customer-applications/${stored._id}/approve`)
        .set(await authHeader(lenderAdmin))
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.data.dedupe.matchType).toBe('nrc');

      const reload = await CustomerApplication.findById(stored._id);
      expect(reload.status).toBe('pending');
    });

    it('attach-to-existing path attaches the loan to an existing customer instead of creating a duplicate', async () => {
      const existing = await createUser({ username: 'existingborrower', role: 'borrower', company: lenderDirect._id, nrc: '600001/10/1' });

      const submit = await request(app)
        .post('/api/public/manifipay/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '777777/10/1', email: 'attach.test@example.com' } }));
      const stored = await CustomerApplication.findOne({ reference: submit.body.reference });

      const usersBefore = await User.countDocuments({});

      const res = await request(app)
        .put(`/api/customer-applications/${stored._id}/approve`)
        .set(await authHeader(lenderAdmin))
        .send({ attachToUserId: existing._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.user._id.toString()).toBe(existing._id.toString());

      const usersAfter = await User.countDocuments({});
      expect(usersAfter).toBe(usersBefore);
    });

    it('employer-model lender cannot create a new borrower without attachToUserId', async () => {
      const submit = await request(app)
        .post('/api/public/payroll-lender/applications')
        .set('Origin', ORIGIN)
        .send(validPayload({ applicant: { ...validPayload().applicant, nrc: '111222/10/1', email: 'employer.model@example.com' } }));
      const stored = await CustomerApplication.findOne({ reference: submit.body.reference });

      const res = await request(app)
        .put(`/api/customer-applications/${stored._id}/approve`)
        .set(await authHeader(otherLenderOfficer))
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
