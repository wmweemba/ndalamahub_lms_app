const Loan = require('../models/Loan');
require('../models/User'); // registers the schema populate('applicant', ...) needs
const { sendEmail } = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');

/**
 * Sends T-3-day payment reminders and overdue notices, stamping each
 * installment sent (reminderSentAt / overdueNoticeSentAt) so reruns don't
 * double-send. Idempotent — safe to run repeatedly.
 * @returns {{remindersSent: number, overdueNoticesSent: number}}
 */
async function sendPaymentReminders(asOf = new Date()) {
  const startOfDay = new Date(asOf);
  startOfDay.setHours(0, 0, 0, 0);

  const reminderWindowStart = new Date(startOfDay);
  reminderWindowStart.setDate(reminderWindowStart.getDate() + 3);
  const reminderWindowEnd = new Date(reminderWindowStart);
  reminderWindowEnd.setDate(reminderWindowEnd.getDate() + 1);

  let remindersSent = 0;
  let overdueNoticesSent = 0;

  const reminderLoans = await Loan.find({
    status: { $in: ['active', 'in_arrears'] },
    repaymentSchedule: {
      $elemMatch: {
        status: 'pending',
        dueDate: { $gte: reminderWindowStart, $lt: reminderWindowEnd },
        reminderSentAt: { $exists: false }
      }
    }
  }).populate('applicant', 'firstName lastName email');

  for (const loan of reminderLoans) {
    if (!loan.applicant || !loan.applicant.email) continue;
    let changed = false;
    for (const installment of loan.repaymentSchedule) {
      if (
        installment.status === 'pending' &&
        !installment.reminderSentAt &&
        installment.dueDate >= reminderWindowStart &&
        installment.dueDate < reminderWindowEnd
      ) {
        void sendEmail({
          to: loan.applicant.email,
          ...emailTemplates.paymentReminder(loan.applicant, loan, installment)
        });
        installment.reminderSentAt = new Date();
        remindersSent += 1;
        changed = true;
      }
    }
    if (changed) await loan.save();
  }

  const overdueLoans = await Loan.find({
    status: { $in: ['active', 'in_arrears'] },
    repaymentSchedule: {
      $elemMatch: { status: 'overdue', overdueNoticeSentAt: { $exists: false } }
    }
  }).populate('applicant', 'firstName lastName email');

  for (const loan of overdueLoans) {
    if (!loan.applicant || !loan.applicant.email) continue;
    let changed = false;
    for (const installment of loan.repaymentSchedule) {
      if (installment.status === 'overdue' && !installment.overdueNoticeSentAt) {
        void sendEmail({
          to: loan.applicant.email,
          ...emailTemplates.paymentOverdue(loan.applicant, loan, installment)
        });
        installment.overdueNoticeSentAt = new Date();
        overdueNoticesSent += 1;
        changed = true;
      }
    }
    if (changed) await loan.save();
  }

  return { remindersSent, overdueNoticesSent };
}

module.exports = sendPaymentReminders;
