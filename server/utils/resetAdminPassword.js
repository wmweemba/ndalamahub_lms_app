// server/utils/resetAdminPassword.js
//
// One-off password reset for an existing user, run directly in the
// production container when a bootstrap run's password is in doubt
// (e.g. a terminal paste/quoting glitch corrupted what was actually set).
// Credentials come from env vars at runtime — never hardcode them here.
//
// This version includes a full diagnostic pass: it reports exactly what's
// stored before and after the reset, and independently verifies the new
// password against a freshly-reloaded document using the same comparePassword()
// the login route itself calls — so a login failure afterward can only be a
// browser/typing mismatch, not a backend hashing/lookup problem.
//
// Usage:
//   RESET_USERNAME=... RESET_PASSWORD=... node utils/resetAdminPassword.js

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const REQUIRED_ENV_VARS = ['RESET_USERNAME', 'RESET_PASSWORD'];

const resetPassword = async () => {
    const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        console.error(`❌ Missing required env var(s): ${missing.join(', ')}`);
        console.error('   Set RESET_USERNAME and RESET_PASSWORD before running.');
        process.exitCode = 1;
        return;
    }

    const { RESET_USERNAME, RESET_PASSWORD } = process.env;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected.');

        // Diagnostic: how many documents even loosely match this username?
        // Schema has trim+unique, so this should always be 0 or 1 — a count
        // above 1 means something bypassed the schema (shouldn't happen, but
        // this has been a session full of surprises).
        const looseMatches = await User.find({
            username: { $regex: `^${RESET_USERNAME.trim()}$`, $options: 'i' }
        });
        console.log(`🔍 Case-insensitive username matches found: ${looseMatches.length}`);
        looseMatches.forEach((u, i) => {
            console.log(`   [${i}] username=${JSON.stringify(u.username)} role=${u.role} isActive=${u.isActive} passwordHashPrefix=${(u.password || '').slice(0, 7)} passwordLen=${(u.password || '').length}`);
        });

        const user = await User.findOne({ username: RESET_USERNAME });
        if (!user) {
            console.error(`❌ No exact match for username: ${JSON.stringify(RESET_USERNAME)}`);
            process.exitCode = 1;
            return;
        }

        if (!user.isActive) {
            console.log('⚠️  This user is currently isActive=false — login would 401 regardless of password. Setting isActive=true.');
            user.isActive = true;
        }

        user.password = RESET_PASSWORD;
        await user.save();
        console.log(`✅ Password reset for: ${user.username} (role: ${user.role})`);

        // Independent verification: reload fresh from the DB (not the same
        // in-memory document instance) and run the exact method the login
        // route calls, against the exact value just set.
        const reloaded = await User.findOne({ username: RESET_USERNAME });
        const correctMatches = await reloaded.comparePassword(RESET_PASSWORD);
        const wrongMatches = await reloaded.comparePassword(`${RESET_PASSWORD}-definitely-wrong`);
        console.log(`🔍 Self-check — comparePassword(correct value) => ${correctMatches} (expect true)`);
        console.log(`🔍 Self-check — comparePassword(wrong value)   => ${wrongMatches} (expect false)`);

        if (correctMatches && !wrongMatches) {
            console.log('✅ Backend hash/compare pipeline verified working end-to-end. If login still fails, the mismatch is in what is typed into the login form, not this script or the database.');
        } else {
            console.log('❌ Self-check did not behave as expected — this points at a real bug in the hashing/compare pipeline, not a typing mismatch. Report this output back.');
        }

    } catch (error) {
        console.error('❌ Password reset failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

resetPassword();
