// server/utils/resetAdminPassword.js
//
// One-off password reset for an existing user, run directly in the
// production container when a bootstrap run's password is in doubt
// (e.g. a terminal paste/quoting glitch corrupted what was actually set).
// Credentials come from env vars at runtime — never hardcode them here.
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

        const user = await User.findOne({ username: RESET_USERNAME });
        if (!user) {
            console.error(`❌ No user found with username: ${RESET_USERNAME}`);
            process.exitCode = 1;
            return;
        }

        user.password = RESET_PASSWORD;
        await user.save();
        console.log(`✅ Password reset for: ${user.username} (role: ${user.role})`);

    } catch (error) {
        console.error('❌ Password reset failed:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

resetPassword();
