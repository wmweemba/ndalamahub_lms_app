/**
 * One-time migration: backfill `subscription` on existing lender companies
 * that predate Phase 10 (the field is additive/optional in the schema, so
 * old lender docs have no subscription state at all until this runs).
 *
 * Every lender company missing a subscription.status gets set to `trialing`
 * with a fresh 30-day trialEndsAt, UNLESS its name matches --activate.
 *
 * Usage:
 *   node utils/migrations/backfillSubscriptions.js --activate="Manifi Investments"
 *   node utils/migrations/backfillSubscriptions.js --activate="Manifi Investments" --periodDays=365
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Company = require('../../models/Company');

async function run() {
  const activateArg = process.argv.find((a) => a.startsWith('--activate='));
  const activateName = activateArg ? activateArg.split('=')[1] : null;
  const periodArg = process.argv.find((a) => a.startsWith('--periodDays='));
  const periodDays = periodArg ? Number(periodArg.split('=')[1]) : 365;

  await mongoose.connect(process.env.MONGODB_URI);

  const lenders = await Company.find({ type: 'lender' });
  let trialed = 0;
  let activated = 0;

  for (const lender of lenders) {
    if (lender.subscription && lender.subscription.status) continue; // already has state

    if (activateName && lender.name === activateName) {
      lender.subscription = {
        status: 'active',
        plan: 'standard',
        currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        notes: 'Backfilled active via backfillSubscriptions.js'
      };
      activated += 1;
    } else {
      lender.subscription = {
        status: 'trialing',
        plan: 'standard',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
      trialed += 1;
    }
    await lender.save();
  }

  console.log(`Backfilled ${lenders.length} lender company(ies): ${activated} activated, ${trialed} set to trialing.`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
