const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Loan = require('../../models/Loan');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// Manifi's confirmed default product shape: 25% flat per 30-day term.
async function makeLoan({
  amount = 1000,
  interestRate = 25,
  term = 30,
  termUnit = 'days',
  status = 'active',
  disbursedAt = new Date('2026-08-01T00:00:00Z')
} = {}) {
  const loan = new Loan({
    amount,
    interestRate,
    term,
    termUnit,
    status,
    disbursedAt,
    purpose: 'Test loan',
    applicant: new mongoose.Types.ObjectId(),
    company: new mongoose.Types.ObjectId(),
    lenderCompany: new mongoose.Types.ObjectId(),
    repaymentFrequency: 'monthly',
    interestCalculation: {
      method: 'flat_rate',
      rateBasis: 'per_term',
      accrualBasis: 'actual/365',
      accrualFrequency: 'daily'
    }
  });
  await loan.save();
  return loan;
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

describe('Loan.rollover()', () => {
  it('reproduces the worked example exactly, dates included', async () => {
    const loan = await makeLoan();

    // Sanity: the base loan itself matches "K1,000 → K1,250 due 31 Aug"
    expect(loan.totalAmount).toBe(1250);
    expect(isoDate(loan.repaymentSchedule[0].dueDate)).toBe('2026-08-31');

    const entry = loan.rollover();
    await loan.save();

    expect(entry.capitalizedPrincipal).toBe(1250);
    expect(entry.newInterest).toBe(312.5);
    expect(entry.newTotalDue).toBe(1562.5);
    expect(isoDate(entry.previousDueDate)).toBe('2026-08-31');
    expect(isoDate(entry.newDueDate)).toBe('2026-09-30');

    expect(loan.rolloverCount).toBe(1);
    expect(loan.status).toBe('active');
    expect(loan.repaymentSchedule[0].status).toBe('rolled');
    expect(loan.repaymentSchedule[1]).toMatchObject({
      status: 'pending',
      amount: 1562.5,
      principal: 1250,
      interest: 312.5
    });
    expect(isoDate(loan.repaymentSchedule[1].dueDate)).toBe('2026-09-30');

    // Original disbursed principal is never mutated by rollover
    expect(loan.amount).toBe(1000);
  });

  it('rolls only the outstanding amount when a partial payment was made during grace', async () => {
    const loan = await makeLoan();
    loan.repaymentSchedule[0].status = 'partial';
    loan.repaymentSchedule[0].paidAmount = 250;
    loan.markModified('repaymentSchedule');
    await loan.save();

    const entry = loan.rollover();
    await loan.save();

    expect(entry.capitalizedPrincipal).toBe(1000);
    expect(entry.newInterest).toBe(250);
    expect(entry.newTotalDue).toBe(1250);
  });

  it('repeats indefinitely across a second cycle', async () => {
    const loan = await makeLoan();
    loan.rollover();
    await loan.save();

    const before = loan.repaymentSchedule.find(i => i.status === 'pending');
    const expectedNewInterest = parseFloat((before.amount * 0.25).toFixed(2));
    const expectedNewTotal = parseFloat((before.amount + expectedNewInterest).toFixed(2));

    const entry2 = loan.rollover();
    await loan.save();

    expect(entry2.capitalizedPrincipal).toBe(before.amount);
    expect(entry2.newInterest).toBe(expectedNewInterest);
    expect(entry2.newTotalDue).toBe(expectedNewTotal);
    expect(isoDate(entry2.previousDueDate)).toBe(isoDate(before.dueDate));
    expect(loan.rolloverCount).toBe(2);

    // Both superseded installments are 'rolled', only the latest is 'pending'
    const statuses = loan.repaymentSchedule.map(i => i.status);
    expect(statuses.filter(s => s === 'rolled').length).toBe(2);
    expect(statuses.filter(s => s === 'pending').length).toBe(1);
  });

  it('quotes a settlement off the post-rollover schedule, not the original terms', async () => {
    const loan = await makeLoan();
    loan.rollover();
    await loan.save();

    const quote = loan.calculateEarlySettlementAmount();

    // Capitalized principal, no interest accrued yet (new due date is in the future)
    expect(quote.principalBalance).toBe(1250);
    expect(quote.interestBalance).toBe(0);
    expect(quote.totalPayoff).toBe(1250);
  });

  it('excludes rolled installments from summary totals', async () => {
    const loan = await makeLoan();
    loan.rollover();
    await loan.save();

    const summary = loan.getSummary();
    expect(summary.remainingBalance).toBe(1562.5);
    expect(summary.nextPayment.amount).toBe(1562.5);
    expect(summary.totalPaid).toBe(0);
  });

  it('refuses to roll a defaulted loan', async () => {
    const loan = await makeLoan({ status: 'defaulted' });
    expect(() => loan.rollover()).toThrow(/defaulted/i);
  });

  it('refuses to roll a completed loan', async () => {
    const loan = await makeLoan({ status: 'completed' });
    expect(() => loan.rollover()).toThrow(/cannot roll over/i);
  });
});
