require('dotenv').config();
const mongoose = require('mongoose');
const sendPaymentReminders = require('./sendPaymentReminders');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await sendPaymentReminders();
    console.log('[job:reminders] result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('[job:reminders] failed:', error);
  process.exit(1);
});
