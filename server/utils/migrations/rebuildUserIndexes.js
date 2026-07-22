/**
 * One-time migration: rebuild the `users` collection indexes for Phase 19
 * (NRC-first borrower identity, email optional for borrowers).
 *
 * The old schema had `email: { unique: true }`, a plain unique index — that
 * rejects a second document with no `email` field (Mongo indexes a missing
 * field as a null-equivalent, and a plain unique index allows at most one
 * null). The new schema needs a *partial* unique index (unique only where
 * `email` exists), plus a new compound partial unique index on
 * `{ company, nrc }` (unique only where `nrc` exists) for per-tenant NRC
 * uniqueness. Mongoose does not alter existing indexes on connect — the old
 * `email_1` index has to be dropped and the new ones built explicitly.
 *
 * Safe to run against a database with no borrowers-without-email yet (the
 * old unique index has no conflicting nulls to begin with). Production is a
 * fresh DB per the locked cutover decision, so this only needs to run once
 * against the shared dev/demo Atlas cluster.
 *
 * Usage: node utils/migrations/rebuildUserIndexes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  const existing = await users.indexes();
  const emailIndex = existing.find((idx) => idx.name === 'email_1' && !idx.partialFilterExpression);
  if (emailIndex) {
    await users.dropIndex('email_1');
    console.log('Dropped old plain-unique email_1 index.');
  } else {
    console.log('No old plain-unique email_1 index found (already migrated or never built).');
  }

  await users.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $exists: true } }, name: 'email_1_partial' }
  );
  console.log('Ensured partial unique index on email.');

  await users.createIndex(
    { company: 1, nrc: 1 },
    { unique: true, partialFilterExpression: { nrc: { $exists: true } }, name: 'company_1_nrc_1_partial' }
  );
  console.log('Ensured compound partial unique index on { company, nrc }.');

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
