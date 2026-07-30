import api from '@/utils/api';
import { setCurrentUser, clearCurrentUser } from '../utils/roleUtils';

export const authService = {
    login: async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { user } = response.data;
            setCurrentUser(user);
            return user;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Login failed');
        }
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // best-effort — the session is treated as gone client-side either way
        } finally {
            clearCurrentUser();
        }
    },

    // The server deliberately answers the same way whether or not the address is on
    // file, so nothing here may branch on the response — see ForgotPasswordPage.
    requestPasswordReset: async (email) => {
        try {
            await api.post('/auth/forgot-password', { email });
        } catch (error) {
            throw new Error(
                error.response?.data?.message || 'Could not send the reset link. Please try again.'
            );
        }
    },

    // Serves three server flows, all of which mail a /reset-password?token= link:
    // forgot-password (10-minute token), staff account invite and customer account
    // invite (7-day tokens). The client cannot tell them apart, and does not need to.
    resetPassword: async (token, newPassword) => {
        try {
            await api.post('/auth/reset-password', { token, newPassword });
        } catch (error) {
            const data = error.response?.data;
            // The server returns a `errors` array for password-policy failures.
            if (Array.isArray(data?.errors) && data.errors.length > 0) {
                const err = new Error(data.message || 'Password does not meet requirements');
                err.details = data.errors;
                throw err;
            }
            throw new Error(data?.message || 'Could not reset the password. Please try again.');
        }
    }
};
