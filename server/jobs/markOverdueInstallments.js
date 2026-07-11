const Loan = require('../models/Loan');

/**
 * Mark past-due pending/partial installments overdue and update each
 * affected loan's arrears status. Idempotent — safe to run repeatedly.
 * @returns {{loansChecked: number, loansUpdated: number, installmentsMarked: number}}
 */
async function markOverdueInstallments(asOf = new Date()) {
  const startOfDay = new Date(asOf);
  startOfDay.setHours(0, 0, 0, 0);

  const loans = await Loan.find({
    status: { $in: ['active', 'in_arrears'] },
    repaymentSchedule: {
      $elemMatch: { status: { $in: ['pending', 'partial'] }, dueDate: { $lt: startOfDay } }
    }
  });

  let loansUpdated = 0;
  let installmentsMarked = 0;

  for (const loan of loans) {
    let changed = false;
    for (const installment of loan.repaymentSchedule) {
      if (['pending', 'partial'].includes(installment.status) && installment.dueDate < startOfDay) {
        installment.status = 'overdue';
        installmentsMarked += 1;
        changed = true;
      }
    }
    if (changed) {
      // pre-save hook runs updatePaymentTracking() + checkArrearsStatus()
      await loan.save();
      loansUpdated += 1;
    }
  }

  return { loansChecked: loans.length, loansUpdated, installmentsMarked };
}

module.exports = markOverdueInstallments;
