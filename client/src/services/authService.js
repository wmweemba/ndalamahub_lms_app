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
    }
};
