/**
 * One-time migration: rename user roles to industry-standard names.
 * Usage:  node utils/migrations/renameRoles.js         (apply)
 *         node utils/migrations/renameRoles.js --down  (revert)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const UP = {
  super_user: 'platform_admin',
  lender_user: 'lender_officer',
  corporate_admin: 'employer_admin',
  corporate_hr: 'employer_hr',
  corporate_user: 'borrower'
};

async function run() {
  const down = process.argv.includes('--down');
  const mapping = down
    ? Object.fromEntries(Object.entries(UP).map(([k, v]) => [v, k]))
    : UP;

  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  for (const [from, to] of Object.entries(mapping)) {
    const { modifiedCount } = await users.updateMany({ role: from }, { $set: { role: to } });
    console.log(`${from} -> ${to}: ${modifiedCount} user(s)`);
  }

  const legacy = await users.countDocuments({ role: { $in: Object.keys(UP) } });
  console.log(down ? 'Revert complete.' : `Remaining legacy-role users (must be 0): ${legacy}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
