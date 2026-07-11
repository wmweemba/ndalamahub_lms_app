const { Resend } = require('resend');

const enabled = !!process.env.RESEND_API_KEY;
const resend = enabled ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send an email. No-ops (with a warn log) when RESEND_API_KEY is unset,
 * so dev environments and tests never require credentials.
 * Never throws — callers must not fail their request because mail failed.
 */
async function sendEmail({ to, subject, html }) {
  if (!enabled) {
    console.warn(`[email] disabled (no RESEND_API_KEY) — would send "${subject}" to ${to}`);
    return { sent: false, reason: 'disabled' };
  }
  try {
    const from = `${process.env.FROM_NAME || 'NdalamaHub'} <${process.env.FROM_EMAIL}>`;
    const result = await resend.emails.send({ from, to, subject, html });
    return { sent: true, id: result.data && result.data.id };
  } catch (error) {
    console.error('[email] send failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendEmail };
