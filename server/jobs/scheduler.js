const cron = require('node-cron');
const markOverdueInstallments = require('./markOverdueInstallments');
const sendPaymentReminders = require('./sendPaymentReminders');

function startScheduler() {
  // Daily at 01:00 Zambia time
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await markOverdueInstallments();
      console.log('[cron] markOverdueInstallments:', result);
    } catch (error) {
      console.error('[cron] markOverdueInstallments failed:', error);
    }
  }, { timezone: 'Africa/Lusaka' });

  // Daily at 08:00 Zambia time
  cron.schedule('0 8 * * *', async () => {
    try {
      const result = await sendPaymentReminders();
      console.log('[cron] sendPaymentReminders:', result);
    } catch (error) {
      console.error('[cron] sendPaymentReminders failed:', error);
    }
  }, { timezone: 'Africa/Lusaka' });

  console.log('[cron] scheduler started (markOverdueInstallments daily @ 01:00, sendPaymentReminders daily @ 08:00, Africa/Lusaka)');
}

module.exports = startScheduler;
