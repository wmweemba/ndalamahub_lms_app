jest.mock('../email', () => ({ sendEmail: jest.fn().mockResolvedValue({ sent: true }) }));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Loan = require('../../models/Loan');
const User = require('../../models/User');
const { sendEmail } = require('../email');
const sendPaymentReminders = require('../../jobs/sendPaymentReminders');

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
  jest.clearAllMocks();
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

function daysFromNow(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function makeInstallment(overrides = {}) {
  return {
    installmentNumber: 1,
    dueDate: daysFromNow(3),
    amount: 1000,
    principal: 900,
    interest: 100,
    status: 'pending',
    ...overrides
  };
}

let applicantCounter = 0;

async function makeApplicant() {
  applicantCounter += 1;
  const company = new mongoose.Types.ObjectId();
  return User.create({
    firstName: 'Test',
    lastName: 'Borrower',
    username: `borrower${applicantCounter}`,
    email: `borrower${applicantCounter}@example.com`,
    phone: '0977000000',
    password: 'password123',
    role: 'borrower',
    company,
    department: 'Test Dept',
    nrc: `${100000 + applicantCounter}/10/1`
  });
}

async function makeLoan({ status = 'active', installments = [makeInstallment()], applicant } = {}) {
  const loan = new Loan({
    amount: 50000,
    interestRate: 24,
    term: 12,
    status,
    purpose: 'Test loan',
    applicant: applicant._id,
    company: new mongoose.Types.ObjectId(),
    lenderCompany: new mongoose.Types.ObjectId()
  });
  // First save lets calculateLoanDetails() generate its own schedule; then
  // overwrite with the deliberately-dated installments and save again
  // (amount/interestRate/term unchanged, so the schedule isn't clobbered) —
  // same pattern as markOverdue.test.js.
  await loan.save();
  loan.status = status;
  loan.repaymentSchedule = installments;
  loan.markModified('repaymentSchedule');
  await loan.save();
  return loan;
}

describe('sendPaymentReminders', () => {
  it('sends a reminder for an installment due in exactly 3 days', async () => {
    const applicant = await makeApplicant();
    await makeLoan({ applicant, installments: [makeInstallment({ dueDate: daysFromNow(3) })] });

    const result = await sendPaymentReminders();

    expect(result.remindersSent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: applicant.email }));

    const loan = await Loan.findOne();
    expect(loan.repaymentSchedule[0].reminderSentAt).toBeTruthy();
  });

  it('does not send a reminder for T-2 or T-4', async () => {
    const applicant = await makeApplicant();
    await makeLoan({
      applicant,
      installments: [
        makeInstallment({ installmentNumber: 1, dueDate: daysFromNow(2) }),
        makeInstallment({ installmentNumber: 2, dueDate: daysFromNow(4) })
      ]
    });

    const result = await sendPaymentReminders();

    expect(result.remindersSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not re-send once reminderSentAt is stamped', async () => {
    const applicant = await makeApplicant();
    await makeLoan({ applicant, installments: [makeInstallment({ dueDate: daysFromNow(3) })] });

    await sendPaymentReminders();
    sendEmail.mockClear();
    const second = await sendPaymentReminders();

    expect(second.remindersSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends exactly one overdue notice per overdue installment and stamps it', async () => {
    const applicant = await makeApplicant();
    await makeLoan({
      status: 'in_arrears',
      applicant,
      installments: [makeInstallment({ dueDate: daysFromNow(-5), status: 'overdue' })]
    });

    const result = await sendPaymentReminders();
    expect(result.overdueNoticesSent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    sendEmail.mockClear();
    const second = await sendPaymentReminders();
    expect(second.overdueNoticesSent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
