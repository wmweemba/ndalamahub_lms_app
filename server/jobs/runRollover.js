require('dotenv').config();
const mongoose = require('mongoose');
const rolloverLoans = require('./rolloverLoans');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await rolloverLoans();
    console.log('[job:rollover] result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('[job:rollover] failed:', error);
  process.exit(1);
});
