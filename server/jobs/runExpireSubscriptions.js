require('dotenv').config();
const mongoose = require('mongoose');
const expireSubscriptions = require('./expireSubscriptions');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await expireSubscriptions();
    console.log('[job:subscriptions] result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('[job:subscriptions] failed:', error);
  process.exit(1);
});
