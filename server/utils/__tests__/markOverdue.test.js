const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Loan = require('../../models/Loan');
const markOverdueInstallments = require('../../jobs/markOverdueInstallments');

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

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function makeInstallment(overrides = {}) {
  return {
    installmentNumber: 1,
    dueDate: daysAgo(1),
    amount: 1000,
    principal: 900,
    interest: 100,
    status: 'pending',
    ...overrides
  };
}

async function makeLoan({ status = 'active', installments = [makeInstallment()] } = {}) {
  const loan = new Loan({
    amount: 50000,
    interestRate: 24,
    term: 12,
    status,
    purpose: 'Test loan',
    applicant: new mongoose.Types.ObjectId(),
    company: new mongoose.Types.ObjectId(),
    lenderCompany: new mongoose.Types.ObjectId()
  });
  // First save lets calculateLoanDetails() generate its own schedule (runs
  // unconditionally on a new doc); overwrite it afterward with the
  // deliberately-aged installments this test needs, then save again —
  // amount/interestRate/term are unchanged on this second save, so
  // calculateLoanDetails() does not re-run and clobber it.
  await loan.save();
  loan.status = status;
  loan.repaymentSchedule = installments;
  loan.markModified('repaymentSchedule');
  await loan.save();
  return loan;
}

describe('markOverdueInstallments', () => {
  it('marks an installment due yesterday overdue and the loan in_arrears', async () => {
    await makeLoan({ installments: [makeInstallment({ dueDate: daysAgo(1) })] });

    const result = await markOverdueInstallments();

    expect(result).toEqual({ loansChecked: 1, loansUpdated: 1, installmentsMarked: 1 });

    const loan = await Loan.findOne();
    expect(loan.repaymentSchedule[0].status).toBe('overdue');
    expect(loan.status).toBe('in_arrears');
  });

  it('leaves an installment due today untouched', async () => {
    await makeLoan({ installments: [makeInstallment({ dueDate: new Date() })] });

    const result = await markOverdueInstallments();

    expect(result).toEqual({ loansChecked: 0, loansUpdated: 0, installmentsMarked: 0 });

    const loan = await Loan.findOne();
    expect(loan.repaymentSchedule[0].status).toBe('pending');
    expect(loan.status).toBe('active');
  });

  it('marks a loan defaulted when an installment is 100 days overdue', async () => {
    await makeLoan({ installments: [makeInstallment({ dueDate: daysAgo(100) })] });

    await markOverdueInstallments();

    const loan = await Loan.findOne();
    expect(loan.repaymentSchedule[0].status).toBe('overdue');
    expect(loan.status).toBe('defaulted');
  });

  it('is idempotent — a second run finds nothing left to mark', async () => {
    await makeLoan({ installments: [makeInstallment({ dueDate: daysAgo(1) })] });

    await markOverdueInstallments();
    const second = await markOverdueInstallments();

    expect(second).toEqual({ loansChecked: 0, loansUpdated: 0, installmentsMarked: 0 });
  });

  it('recovers a loan to active once its overdue installment is paid', async () => {
    await makeLoan({ installments: [makeInstallment({ dueDate: daysAgo(1) })] });
    await markOverdueInstallments();

    const loan = await Loan.findOne();
    expect(loan.status).toBe('in_arrears');

    loan.repaymentSchedule[0].status = 'paid';
    loan.repaymentSchedule[0].paidAmount = loan.repaymentSchedule[0].amount;
    loan.markModified('repaymentSchedule');
    await loan.save();

    expect(loan.status).toBe('active');
  });

  it('never transitions waived or paid installments', async () => {
    await makeLoan({
      installments: [
        makeInstallment({ installmentNumber: 1, dueDate: daysAgo(10), status: 'waived' }),
        makeInstallment({ installmentNumber: 2, dueDate: daysAgo(5), status: 'paid', paidAmount: 1000 })
      ]
    });

    const result = await markOverdueInstallments();

    expect(result).toEqual({ loansChecked: 0, loansUpdated: 0, installmentsMarked: 0 });

    const loan = await Loan.findOne();
    expect(loan.repaymentSchedule[0].status).toBe('waived');
    expect(loan.repaymentSchedule[1].status).toBe('paid');
    expect(loan.status).toBe('active');
  });
});
