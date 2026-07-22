const Loan = require('../models/Loan');
require('../models/User'); // registers the schema populate('applicant', ...) needs
const LoanProduct = require('../models/LoanProduct');
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');

/**
 * Roll over loans whose product has rollover enabled, are still active/in
 * arrears with outstanding balance, and are past due date + grace days.
 * Idempotent — a loan whose latest cycle's due date is still in the future
 * is skipped, so a second same-day run does nothing.
 * @returns {{productsChecked: number, loansChecked: number, loansRolled: number}}
 */
async function rolloverLoans(asOf = new Date()) {
  const rolloverProducts = await LoanProduct.find({ 'rollover.enabled': true }, '_id rollover');
  const productsById = new Map(rolloverProducts.map(p => [p._id.toString(), p]));

  if (rolloverProducts.length === 0) {
    return { productsChecked: 0, loansChecked: 0, loansRolled: 0 };
  }

  const loans = await Loan.find({
    status: { $in: ['active', 'in_arrears'] },
    product: { $in: rolloverProducts.map(p => p._id) }
  }).populate('applicant', 'firstName lastName email');

  let loansRolled = 0;

  for (const loan of loans) {
    const product = productsById.get(loan.product?.toString());
    if (!product) continue;

    const graceDays = product.rollover?.graceDays ?? 14;

    const outstandingInstallments = loan.repaymentSchedule.filter(
      i => !['paid', 'waived', 'rolled'].includes(i.status)
    );
    if (outstandingInstallments.length === 0) continue;

    const currentDueDate = outstandingInstallments.reduce(
      (latest, i) => (!latest || i.dueDate > latest ? i.dueDate : latest), null
    );

    const graceExpiry = new Date(currentDueDate);
    graceExpiry.setDate(graceExpiry.getDate() + graceDays);
    if (asOf <= graceExpiry) continue; // strictly past — not yet due for rollover

    const outstandingBefore = outstandingInstallments.reduce(
      (sum, i) => sum + (i.amount - (i.paidAmount || 0)), 0
    );
    if (outstandingBefore <= 0) continue;

    const entry = loan.rollover();
    await loan.save();
    loansRolled += 1;

    const borrower = loan.applicant;
    if (borrower?.email) {
      void sendEmail({ to: borrower.email, ...emailTemplates.loanRolledOver(borrower, loan, entry) });
    }
  }

  return { productsChecked: rolloverProducts.length, loansChecked: loans.length, loansRolled };
}

module.exports = rolloverLoans;
