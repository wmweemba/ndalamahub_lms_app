const Company = require('../models/Company');

const LENDER_SIDE_ROLES = ['lender_admin', 'lender_officer'];
const EMPLOYER_SIDE_ROLES = ['employer_admin', 'employer_hr'];

const isPlatformAdmin = (user) => user.role === 'platform_admin';
const isLenderSide = (user) => LENDER_SIDE_ROLES.includes(user.role);
const isEmployerSide = (user) => EMPLOYER_SIDE_ROLES.includes(user.role);

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  const aId = a._id ? a._id : a;
  const bId = b._id ? b._id : b;
  return aId.toString() === bId.toString();
};

/** ObjectIds of employer companies served by this lender company. */
async function clientCompanyIds(lenderCompanyId) {
  const companies = await Company.find({ lenderCompany: lenderCompanyId }).select('_id');
  return companies.map((c) => c._id);
}

/**
 * Mongo filter limiting a Loan query to the caller's tenant.
 * Returns {} for platform_admin. NOTE: returns a fragment that must be
 * combined with other criteria via $and (see mergeFilters) — never spread
 * it into an object that already has $or.
 */
async function loanScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) {
    const clients = await clientCompanyIds(user.company);
    return { $or: [{ lenderCompany: user.company }, { company: { $in: clients } }] };
  }
  if (isEmployerSide(user)) return { company: user.company };
  return { applicant: user.id }; // borrower
}

/** Combine criteria fragments without $or/$and collisions. */
function mergeFilters(...fragments) {
  const parts = fragments.filter((f) => f && Object.keys(f).length > 0);
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

/** Document-level read access to a single loan. */
function canReadLoan(user, loan) {
  if (isPlatformAdmin(user)) return true;
  if (isLenderSide(user)) return idsEqual(loan.lenderCompany, user.company);
  if (isEmployerSide(user)) return idsEqual(loan.company, user.company);
  return idsEqual(loan.applicant, user.id);
}

/** Write access to repayment/prepayment/settlement — lender side only (locked decision). */
function canWriteRepayment(user, loan) {
  if (isPlatformAdmin(user)) return true;
  return isLenderSide(user) && idsEqual(loan.lenderCompany, user.company);
}

/** Mongo filter limiting a User query to the caller's tenant. */
async function userScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) {
    const clients = await clientCompanyIds(user.company);
    return { company: { $in: [user.company, ...clients] } };
  }
  return { company: user.company };
}

/** Mongo filter limiting a Company query to the caller's tenant. */
async function companyScopeFilter(user) {
  if (isPlatformAdmin(user)) return {};
  if (isLenderSide(user)) return { $or: [{ _id: user.company }, { lenderCompany: user.company }] };
  return { _id: user.company };
}

/** Document-level access to a company record. */
function canReadCompany(user, company) {
  if (isPlatformAdmin(user)) return true;
  return idsEqual(company._id, user.company) || idsEqual(company.lenderCompany, user.company);
}

/** Document-level access to a loan product (products belong to lender companies). */
function canReadProduct(user, product) {
  if (isPlatformAdmin(user)) return true;
  if (isLenderSide(user)) return idsEqual(product.company, user.company);
  // employer-side users and borrowers may see products their lender offers them:
  // product.company must be the lender of the caller's company — the route
  // resolves this with companyLenderId() below.
  return null; // caller must use canAccessLenderProduct
}

/**
 * Resolve the paying/lender company id for a company: its own id if it's a
 * lender company (direct-model borrowers pay their own lender), otherwise
 * its lenderCompany (employer-model), or null if neither resolves.
 * Fixed 2026-07-22 (Phase 19): previously returned null for lender-type
 * companies, which fail-opened the subscription gate for direct borrowers.
 */
async function companyLenderId(companyId) {
  const company = await Company.findById(companyId).select('lenderCompany type');
  if (!company) return null;
  if (company.type === 'lender') return company._id;
  return company.lenderCompany || null;
}

module.exports = {
  isPlatformAdmin, isLenderSide, isEmployerSide, idsEqual,
  clientCompanyIds, loanScopeFilter, mergeFilters,
  canReadLoan, canWriteRepayment,
  userScopeFilter, companyScopeFilter, canReadCompany,
  canReadProduct, companyLenderId
};
