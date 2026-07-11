const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Company = require('../../models/Company');
const User = require('../../models/User');
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

const makeCompany = (overrides = {}) => Company.create({
  name: 'Test Co',
  type: 'lender',
  registrationNumber: `REG-${new mongoose.Types.ObjectId().toString()}`,
  address: { street: '1 Main St', city: 'Lusaka', province: 'Lusaka' },
  contactInfo: { phone: '0000000000', email: 'test@example.com' },
  ...overrides
});

const makeUser = (company, overrides = {}) => User.create({
  firstName: 'Test',
  lastName: 'User',
  username: `user${new mongoose.Types.ObjectId().toString()}`,
  email: `${new mongoose.Types.ObjectId().toString()}@example.com`,
  phone: '+260970000001',
  password: 'Test123!',
  role: 'borrower',
  company: company._id,
  department: 'Operations',
  ...overrides
});

const makeLoan = (applicant, company, overrides = {}) => new Loan({
  applicant: applicant._id,
  company: company._id,
  lenderCompany: company._id,
  amount: 10000,
  interestRate: 24,
  term: 6,
  purpose: 'Test loan purpose',
  status: 'active',
  ...overrides
}).save();

/** Mirrors the deletion policy applied in DELETE /api/users/:id (users.js). */
async function applyDeletionPolicy(userId) {
  const hasLoanHistory = await Loan.exists({ applicant: userId });
  if (hasLoanHistory) {
    const user = await User.findById(userId);
    user.isActive = false;
    await user.save();
    return { deleted: false, deactivated: true };
  }
  await User.findByIdAndDelete(userId);
  return { deleted: true, deactivated: false };
}

describe('User deletion policy', () => {
  it('deactivates (never hard-deletes) a user with any loan history, including completed loans', async () => {
    const company = await makeCompany();
    const user = await makeUser(company);
    await makeLoan(user, company, { status: 'completed' });

    const result = await applyDeletionPolicy(user._id);

    expect(result).toEqual({ deleted: false, deactivated: true });
    const stillThere = await User.findById(user._id);
    expect(stillThere).not.toBeNull();
    expect(stillThere.isActive).toBe(false);
  });

  it('hard-deletes a user with zero loan history', async () => {
    const company = await makeCompany();
    const user = await makeUser(company);

    const result = await applyDeletionPolicy(user._id);

    expect(result).toEqual({ deleted: true, deactivated: false });
    const gone = await User.findById(user._id);
    expect(gone).toBeNull();
  });

  it('does not throw when mapping over a loan whose applicant was hard-deleted (orphan)', async () => {
    const company = await makeCompany();
    const user = await makeUser(company);
    const loan = await makeLoan(user, company, { status: 'active' });

    // Simulate a pre-existing orphan: hard-delete the user directly via the collection,
    // bypassing the policy (as some past hard-delete already did in production data).
    await User.collection.deleteOne({ _id: user._id });

    const populated = await Loan.findById(loan._id).populate('applicant', 'firstName lastName');

    expect(() => {
      const applicantName = populated.applicant
        ? `${populated.applicant.firstName} ${populated.applicant.lastName}`
        : 'Deleted user';
      expect(applicantName).toBe('Deleted user');
    }).not.toThrow();
  });
});
