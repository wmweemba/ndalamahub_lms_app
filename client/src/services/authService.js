import api from '../utils/api';

export const authService = {
    login: async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { token, user } = response.data;
            localStorage.setItem('ndalamahub-token', token);
            return user;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Login failed');
        }
    },

    logout: () => {
        localStorage.removeItem('ndalamahub-token');
    }
};