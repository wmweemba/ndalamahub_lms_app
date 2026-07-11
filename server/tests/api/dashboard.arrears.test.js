const request = require('supertest');
const app = require('../../app');
const db = require('../helpers/db');
const { seedTwoTenants } = require('../helpers/fixtures');
const { authHeader } = require('../helpers/tokens');
const markOverdueInstallments = require('../../jobs/markOverdueInstallments');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('Dashboard arrears-awareness', () => {
  let fx;

  beforeAll(async () => {
    await db.connect();
    fx = await seedTwoTenants();

    // Push loanA's first installment into the past, then run the real job
    // (not a direct status write) so the job -> checkArrearsStatus -> dashboard
    // pipeline is what's actually pinned.
    fx.loanA.repaymentSchedule[0].dueDate = daysAgo(5);
    fx.loanA.markModified('repaymentSchedule');
    await fx.loanA.save();

    await markOverdueInstallments();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('lenderAdminA /lender-stats shows the arrears loan under inArrearsLoans, absent from activeLoans', async () => {
    const res = await request(app).get('/api/dashboard/lender-stats').set(authHeader(fx.lenderAdminA));
    expect(res.status).toBe(200);
    const summary = res.body.data.portfolioSummary;
    expect(summary.inArrearsLoans).toBe(1);
    expect(summary.defaultedLoans).toBe(0);
  });

  it('lenderAdminB /lender-stats is unaffected (tenancy holds on the new fields)', async () => {
    const res = await request(app).get('/api/dashboard/lender-stats').set(authHeader(fx.lenderAdminB));
    expect(res.status).toBe(200);
    const summary = res.body.data.portfolioSummary;
    expect(summary.inArrearsLoans).toBe(0);
    expect(summary.defaultedLoans).toBe(0);
  });

  it('employerHrA /hr-stats shows the arrears loan under inArrearsLoans', async () => {
    const res = await request(app).get('/api/dashboard/hr-stats').set(authHeader(fx.employerHrA));
    expect(res.status).toBe(200);
    const summary = res.body.data.loanSummary;
    expect(summary.inArrearsLoans).toBe(1);
    expect(summary.defaultedLoans).toBe(0);
  });
});
