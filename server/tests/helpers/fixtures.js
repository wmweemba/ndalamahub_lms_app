const Company = require('../../models/Company');
const User = require('../../models/User');
const Loan = require('../../models/Loan');

const PASSWORD = 'Test123!';

let regCounter = 0;
const nextRegNumber = (prefix) => {
  regCounter += 1;
  return `${prefix}-${regCounter}`;
};

const createCompany = async (overrides = {}) => {
  return Company.create({
    name: overrides.name,
    type: overrides.type,
    registrationNumber: overrides.registrationNumber || nextRegNumber(overrides.type === 'lender' ? 'LEN' : 'COR'),
    address: {
      street: '1 Test Street',
      city: 'Lusaka',
      province: 'Lusaka'
    },
    contactInfo: {
      phone: '+260970000000',
      email: `${overrides.name.toLowerCase().replace(/\s+/g, '')}@example.com`
    },
    ...(overrides.lenderCompany ? { lenderCompany: overrides.lenderCompany } : {})
  });
};

const createUser = async (overrides = {}) => {
  return User.create({
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    username: overrides.username,
    email: overrides.email || `${overrides.username}@example.com`,
    phone: '+260970000001',
    password: PASSWORD,
    role: overrides.role,
    company: overrides.company,
    department: overrides.department
  });
};

const createLoan = async (overrides = {}) => {
  const loan = new Loan({
    applicant: overrides.applicant,
    company: overrides.company,
    lenderCompany: overrides.lenderCompany,
    amount: overrides.amount || 10000,
    interestRate: overrides.interestRate || 24,
    term: overrides.term || 6,
    purpose: overrides.purpose || 'Test loan purpose',
    status: overrides.status || 'active'
  });
  await loan.save();
  return loan;
};

const seedTwoTenants = async () => {
  const lenderA = await createCompany({ name: 'Lender A', type: 'lender' });
  const lenderB = await createCompany({ name: 'Lender B', type: 'lender' });

  const employerA = await createCompany({ name: 'Employer A', type: 'corporate', lenderCompany: lenderA._id });
  const employerB = await createCompany({ name: 'Employer B', type: 'corporate', lenderCompany: lenderB._id });

  await Company.findByIdAndUpdate(lenderA._id, { $addToSet: { corporateClients: employerA._id } });
  await Company.findByIdAndUpdate(lenderB._id, { $addToSet: { corporateClients: employerB._id } });

  const platformAdmin = await createUser({ username: 'platformadmin', role: 'platform_admin', company: lenderA._id });

  const lenderAdminA = await createUser({ username: 'lenderadmina', role: 'lender_admin', company: lenderA._id });
  const lenderOfficerA = await createUser({ username: 'lenderofficera', role: 'lender_officer', company: lenderA._id });
  const employerAdminA = await createUser({ username: 'employeradmina', role: 'employer_admin', company: employerA._id });
  const employerHrA = await createUser({ username: 'employerhra', role: 'employer_hr', company: employerA._id, department: 'HR' });
  const borrowerA = await createUser({ username: 'borrowera', role: 'borrower', company: employerA._id, department: 'Operations' });

  const lenderAdminB = await createUser({ username: 'lenderadminb', role: 'lender_admin', company: lenderB._id });
  const lenderOfficerB = await createUser({ username: 'lenderofficerb', role: 'lender_officer', company: lenderB._id });
  const employerAdminB = await createUser({ username: 'employeradminb', role: 'employer_admin', company: employerB._id });
  const employerHrB = await createUser({ username: 'employerhrb', role: 'employer_hr', company: employerB._id, department: 'HR' });
  const borrowerB = await createUser({ username: 'borrowerb', role: 'borrower', company: employerB._id, department: 'Operations' });

  const loanA = await createLoan({
    applicant: borrowerA._id,
    company: employerA._id,
    lenderCompany: lenderA._id,
    status: 'active'
  });
  const loanB = await createLoan({
    applicant: borrowerB._id,
    company: employerB._id,
    lenderCompany: lenderB._id,
    status: 'active'
  });

  const loanA_pending = await createLoan({
    applicant: borrowerA._id,
    company: employerA._id,
    lenderCompany: lenderA._id,
    status: 'pending_approval'
  });
  const loanB_pending = await createLoan({
    applicant: borrowerB._id,
    company: employerB._id,
    lenderCompany: lenderB._id,
    status: 'pending_approval'
  });

  return {
    lenderA,
    lenderB,
    employerA,
    employerB,
    platformAdmin,
    lenderAdminA,
    lenderOfficerA,
    employerAdminA,
    employerHrA,
    borrowerA,
    lenderAdminB,
    lenderOfficerB,
    employerAdminB,
    employerHrB,
    borrowerB,
    loanA,
    loanB,
    loanA_pending,
    loanB_pending
  };
};

module.exports = { seedTwoTenants, PASSWORD, createLoan, createUser };
