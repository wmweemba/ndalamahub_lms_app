require('dotenv').config();
const mongoose = require('mongoose');
const markOverdueInstallments = require('./markOverdueInstallments');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await markOverdueInstallments();
    console.log('[job:overdue] result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('[job:overdue] failed:', error);
  process.exit(1);
});
