// Phase 20 — rollover engine: job-level grace boundary/idempotency/defaulted
// exclusion, and the manual /default kill-switch route (authority + tenancy).
const request = require('supertest');
const app = require('../../app');
const Loan = require('../../models/Loan');
const LoanProduct = require('../../models/LoanProduct');
const db = require('../helpers/db');
const { seedTwoTenants, createLoan } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');
const rolloverLoans = require('../../jobs/rolloverLoans');

async function makeRolloverProduct(companyId, overrides = {}) {
  return LoanProduct.create({
    name: 'Payday 30',
    description: 'Rollover test product',
    category: 'payday',
    company: companyId,
    interestRate: { min: 25, max: 25, default: 25 },
    term: { min: 30, max: 30, default: 30, unit: 'days' },
    amount: { min: 500, max: 5000, currency: 'ZMW' },
    interestCalculation: { method: 'flat_rate', rateBasis: 'per_term', dayCountConvention: 'actual/365' },
    repaymentFrequency: ['monthly'],
    fees: { processingFee: { type: 'percentage', amount: 0 } },
    rollover: { enabled: true, graceDays: 14 },
    ...overrides
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function makeRolloverLoan({ applicant, company, lenderCompany, product, status = 'active', dueDate }) {
  const loan = new Loan({
    applicant,
    company,
    lenderCompany,
    product: product._id,
    amount: 1000,
    interestRate: 25,
    term: 30,
    termUnit: 'days',
    purpose: 'Rollover test loan',
    status: 'pending_approval',
    disbursedAt: new Date(),
    repaymentFrequency: 'monthly',
    interestCalculation: { method: 'flat_rate', rateBasis: 'per_term', accrualBasis: 'actual/365', accrualFrequency: 'daily' }
  });
  await loan.save();
  loan.status = status;
  loan.repaymentSchedule[0].dueDate = dueDate;
  loan.markModified('repaymentSchedule');
  await loan.save();
  return loan;
}

describe('Phase 20 — rollover engine', () => {
  let fx;
  let productA;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();
    productA = await makeRolloverProduct(fx.lenderA._id);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('rolloverLoans() job — grace boundary', () => {
    it('does not roll a loan still within the grace window (due 13 days ago)', async () => {
      const loan = await makeRolloverLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        product: productA,
        dueDate: daysAgo(13)
      });

      const result = await rolloverLoans();
      expect(result.loansRolled).toBe(0);

      const fresh = await Loan.findById(loan._id);
      expect(fresh.rolloverCount).toBe(0);
      expect(fresh.repaymentSchedule[0].status).toBe('pending');
    });

    it('rolls a loan strictly past due date + grace days (due 15 days ago)', async () => {
      const loan = await makeRolloverLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        product: productA,
        dueDate: daysAgo(15)
      });

      const result = await rolloverLoans();
      expect(result.loansRolled).toBe(1);

      const fresh = await Loan.findById(loan._id);
      expect(fresh.rolloverCount).toBe(1);
      expect(fresh.status).toBe('active');
      expect(fresh.repaymentSchedule[0].status).toBe('rolled');
      expect(fresh.repaymentSchedule[1].status).toBe('pending');
      expect(fresh.repaymentSchedule[1].amount).toBe(1562.5);
    });

    it('is idempotent — a second same-day run does nothing further to an already-rolled loan', async () => {
      const loan = await makeRolloverLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        product: productA,
        dueDate: daysAgo(15)
      });

      await rolloverLoans();
      const afterFirst = await Loan.findById(loan._id);
      expect(afterFirst.rolloverCount).toBe(1);

      const second = await rolloverLoans();
      expect(second.loansRolled).toBe(0);

      const afterSecond = await Loan.findById(loan._id);
      expect(afterSecond.rolloverCount).toBe(1);
    });

    it('excludes defaulted loans from rollover', async () => {
      const loan = await makeRolloverLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        product: productA,
        status: 'defaulted',
        dueDate: daysAgo(30)
      });

      const result = await rolloverLoans();

      const fresh = await Loan.findById(loan._id);
      expect(fresh.rolloverCount).toBe(0);
      expect(fresh.status).toBe('defaulted');
      void result;
    });
  });

  describe('PUT /api/loans/:id/default', () => {
    it('lender_admin can default their own loan with a reason', async () => {
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'active'
      });

      const res = await request(app)
        .put(`/api/loans/${loan._id}/default`)
        .set(authHeader(fx.lenderAdminA))
        .send({ reason: 'Borrower unreachable, moving to collateral recovery' });

      expect(res.status).toBe(200);
      expect(res.body.data.loan.status).toBe('defaulted');
    });

    it('requires a reason', async () => {
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'active'
      });

      const res = await request(app)
        .put(`/api/loans/${loan._id}/default`)
        .set(authHeader(fx.lenderAdminA))
        .send({});

      expect(res.status).toBe(400);
    });

    it('lender_officer has no authority over /default', async () => {
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'active'
      });

      const res = await request(app)
        .put(`/api/loans/${loan._id}/default`)
        .set(authHeader(fx.lenderOfficerA))
        .send({ reason: 'attempted' });

      expect(res.status).toBe(403);
    });

    it('cross-tenant lender_admin cannot default another lender\'s loan', async () => {
      const loan = await createLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        status: 'active'
      });

      const res = await request(app)
        .put(`/api/loans/${loan._id}/default`)
        .set(authHeader(fx.lenderAdminB))
        .send({ reason: 'attempted cross-tenant default' });

      expect(res.status).toBe(403);

      const fresh = await Loan.findById(loan._id);
      expect(fresh.status).toBe('active');
    });

    it('a defaulted loan never rolls over again', async () => {
      const loan = await makeRolloverLoan({
        applicant: fx.borrowerA._id,
        company: fx.employerA._id,
        lenderCompany: fx.lenderA._id,
        product: productA,
        dueDate: daysAgo(15)
      });

      await request(app)
        .put(`/api/loans/${loan._id}/default`)
        .set(authHeader(fx.lenderAdminA))
        .send({ reason: 'defaulting before rollover would otherwise fire' });

      const result = await rolloverLoans();
      expect(result.loansRolled).toBe(0);

      const fresh = await Loan.findById(loan._id);
      expect(fresh.rolloverCount).toBe(0);
      expect(fresh.status).toBe('defaulted');
    });
  });
});
