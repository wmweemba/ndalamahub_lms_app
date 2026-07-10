const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Company = require('../../models/Company');
const {
  loanScopeFilter,
  mergeFilters,
  canReadLoan,
  canWriteRepayment,
  userScopeFilter,
  companyScopeFilter
} = require('../tenantScope');

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

describe('tenantScope', () => {
  describe('loanScopeFilter', () => {
    it('platform_admin gets an empty filter', async () => {
      const filter = await loanScopeFilter({ role: 'platform_admin', id: 'u1', company: 'c1' });
      expect(filter).toEqual({});
    });

    it('lender_admin gets $or of lenderCompany + client companies', async () => {
      const lenderCo = await makeCompany({ type: 'lender' });
      const clientCo = await makeCompany({ type: 'corporate', lenderCompany: lenderCo._id });

      const filter = await loanScopeFilter({ role: 'lender_admin', id: 'u1', company: lenderCo._id });

      expect(filter.$or).toBeDefined();
      expect(filter.$or[0]).toEqual({ lenderCompany: lenderCo._id });
      expect(filter.$or[1].company.$in.map((id) => id.toString())).toEqual([clientCo._id.toString()]);
    });

    it('employer_hr gets a plain company filter', async () => {
      const filter = await loanScopeFilter({ role: 'employer_hr', id: 'u1', company: 'c1' });
      expect(filter).toEqual({ company: 'c1' });
    });

    it('borrower gets an applicant filter', async () => {
      const filter = await loanScopeFilter({ role: 'borrower', id: 'u1', company: 'c1' });
      expect(filter).toEqual({ applicant: 'u1' });
    });
  });

  describe('mergeFilters', () => {
    it('combines two $or-bearing fragments under $and (search-overwrite regression)', () => {
      const searchFilter = { $or: [{ name: /a/ }, { code: /a/ }] };
      const scopeFilter = { $or: [{ lenderCompany: 'L1' }, { company: { $in: ['C1'] } }] };

      const merged = mergeFilters(searchFilter, scopeFilter);

      expect(merged).toEqual({ $and: [searchFilter, scopeFilter] });
    });

    it('returns {} when all fragments are empty', () => {
      expect(mergeFilters({}, {})).toEqual({});
    });

    it('returns the single fragment unwrapped when only one is non-empty', () => {
      const frag = { status: 'active' };
      expect(mergeFilters({}, frag)).toEqual(frag);
    });
  });

  describe('canReadLoan / canWriteRepayment', () => {
    it('denies a lender_admin of L2 reading an L1 loan', () => {
      const loan = { lenderCompany: 'L1' };
      const user = { role: 'lender_admin', id: 'u1', company: 'L2' };
      expect(canReadLoan(user, loan)).toBe(false);
      expect(canWriteRepayment(user, loan)).toBe(false);
    });

    it('allows a lender_admin of L1 reading/writing an L1 loan', () => {
      const loan = { lenderCompany: 'L1' };
      const user = { role: 'lender_admin', id: 'u1', company: 'L1' };
      expect(canReadLoan(user, loan)).toBe(true);
      expect(canWriteRepayment(user, loan)).toBe(true);
    });

    it('fails closed (no throw) when lenderCompany is missing on a legacy loan', () => {
      const loan = {};
      const user = { role: 'lender_admin', id: 'u1', company: 'L1' };
      expect(() => canReadLoan(user, loan)).not.toThrow();
      expect(canReadLoan(user, loan)).toBe(false);
      expect(canWriteRepayment(user, loan)).toBe(false);
    });

    it('denies employer_admin write access even on their own company loan', () => {
      const loan = { company: 'E1', lenderCompany: 'L1' };
      const user = { role: 'employer_admin', id: 'u1', company: 'E1' };
      expect(canReadLoan(user, loan)).toBe(true);
      expect(canWriteRepayment(user, loan)).toBe(false);
    });
  });

  describe('userScopeFilter / companyScopeFilter', () => {
    it('userScopeFilter: platform_admin -> {}', async () => {
      expect(await userScopeFilter({ role: 'platform_admin', id: 'u1', company: 'c1' })).toEqual({});
    });

    it('userScopeFilter: lender_admin -> own company + client companies', async () => {
      const lenderCo = await makeCompany({ type: 'lender' });
      const clientCo = await makeCompany({ type: 'corporate', lenderCompany: lenderCo._id });

      const filter = await userScopeFilter({ role: 'lender_admin', id: 'u1', company: lenderCo._id });

      const ids = filter.company.$in.map((id) => id.toString());
      expect(ids).toEqual([lenderCo._id.toString(), clientCo._id.toString()]);
    });

    it('userScopeFilter: employer_hr -> own company only', async () => {
      const filter = await userScopeFilter({ role: 'employer_hr', id: 'u1', company: 'E1' });
      expect(filter).toEqual({ company: 'E1' });
    });

    it('companyScopeFilter: platform_admin -> {}', async () => {
      expect(await companyScopeFilter({ role: 'platform_admin', id: 'u1', company: 'c1' })).toEqual({});
    });

    it('companyScopeFilter: lender_admin -> own company or its clients', async () => {
      const filter = await companyScopeFilter({ role: 'lender_admin', id: 'u1', company: 'L1' });
      expect(filter).toEqual({ $or: [{ _id: 'L1' }, { lenderCompany: 'L1' }] });
    });

    it('companyScopeFilter: employer_hr -> own company only', async () => {
      const filter = await companyScopeFilter({ role: 'employer_hr', id: 'u1', company: 'E1' });
      expect(filter).toEqual({ _id: 'E1' });
    });
  });
});
