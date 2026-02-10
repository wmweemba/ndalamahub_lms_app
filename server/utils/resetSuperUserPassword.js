// Reset super user password
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const resetPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🌱 Database connected.');

        // Find super user
        const superUser = await User.findOne({ username: 'superadmin' });
        
        if (!superUser) {
            console.log('❌ Super user not found!');
            return;
        }

        // Reset password - just set the plain password, the pre-save hook will hash it
        const newPassword = 'Password10$';
        superUser.password = newPassword;
        await superUser.save();

        console.log('✅ Super user password has been reset!');
        console.log('\n🔑 Login credentials:');
        console.log('Username: superadmin');
        console.log('Password: Password10$');

    } catch (error) {
        console.error('❌ Password reset failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
    }
};

resetPassword();
