function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `ZMW ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

function layout(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${title}</title></head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">NdalamaHub</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background-color:#f9fafb;color:#9ca3af;font-size:12px;">
                This is an automated message from NdalamaHub. Please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function passwordReset(user, resetUrl) {
  const title = 'Reset your password';
  return {
    subject: 'Reset your NdalamaHub password',
    html: layout(title, `
      <p>Hi ${user.firstName},</p>
      <p>We received a request to reset your NdalamaHub password. This link is valid for 10 minutes.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background-color:#111827;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `)
  };
}

function loanApproved(user, loan) {
  return {
    subject: `Loan ${loan.loanNumber} approved`,
    html: layout('Loan approved', `
      <p>Hi ${user.firstName},</p>
      <p>Your loan application <strong>${loan.loanNumber}</strong> for ${formatMoney(loan.amount)} over ${loan.term} ${loan.termUnit || 'months'} has been <strong>approved</strong>.</p>
      <p>You'll receive another notification once the funds are disbursed.</p>
    `)
  };
}

function loanRejected(user, loan, notes) {
  return {
    subject: `Loan ${loan.loanNumber} rejected`,
    html: layout('Loan rejected', `
      <p>Hi ${user.firstName},</p>
      <p>Your loan application <strong>${loan.loanNumber}</strong> for ${formatMoney(loan.amount)} was <strong>not approved</strong>.</p>
      ${notes ? `<p>Reason: ${notes}</p>` : ''}
    `)
  };
}

function loanDisbursed(user, loan) {
  const netDisbursement = loan.netDisbursement !== undefined ? loan.netDisbursement : loan.amount;
  const firstInstallment = loan.repaymentSchedule && loan.repaymentSchedule[0];
  return {
    subject: `Loan ${loan.loanNumber} disbursed`,
    html: layout('Loan disbursed', `
      <p>Hi ${user.firstName},</p>
      <p>Your loan <strong>${loan.loanNumber}</strong> has been disbursed. Net amount: <strong>${formatMoney(netDisbursement)}</strong>.</p>
      ${firstInstallment ? `<p>First payment of ${formatMoney(firstInstallment.amount)} is due on ${formatDate(firstInstallment.dueDate)}.</p>` : ''}
    `)
  };
}

function paymentReminder(user, loan, installment) {
  return {
    subject: `Upcoming payment due for loan ${loan.loanNumber}`,
    html: layout('Payment reminder', `
      <p>Hi ${user.firstName},</p>
      <p>A payment of <strong>${formatMoney(installment.amount)}</strong> for loan <strong>${loan.loanNumber}</strong> is due on <strong>${formatDate(installment.dueDate)}</strong>.</p>
      <p>Please make sure funds are available to avoid a missed payment.</p>
    `)
  };
}

function paymentOverdue(user, loan, installment) {
  const daysLate = Math.max(0, Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (24 * 60 * 60 * 1000)));
  return {
    subject: `Payment overdue for loan ${loan.loanNumber}`,
    html: layout('Payment overdue', `
      <p>Hi ${user.firstName},</p>
      <p>A payment of <strong>${formatMoney(installment.amount)}</strong> for loan <strong>${loan.loanNumber}</strong> is now <strong>${daysLate} day${daysLate === 1 ? '' : 's'} overdue</strong>.</p>
      <p>Please make this payment as soon as possible to avoid further arrears action.</p>
    `)
  };
}

function ticketUpdate(user, ticket, message) {
  return {
    subject: `Update on support ticket ${ticket.ticketNumber}`,
    html: layout('Ticket update', `
      <p>Hi ${user.firstName},</p>
      <p>There's an update on your support ticket <strong>${ticket.ticketNumber}</strong> (${ticket.subject}).</p>
      <p>Status: <strong>${ticket.status}</strong></p>
      ${message ? `<p>${message}</p>` : ''}
    `)
  };
}

module.exports = {
  passwordReset,
  loanApproved,
  loanRejected,
  loanDisbursed,
  paymentReminder,
  paymentOverdue,
  ticketUpdate
};
