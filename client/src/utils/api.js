import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ndalamahub-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// A 402 SUBSCRIPTION_LOCKED means the caller's tenant is suspended/cancelled
// (or a lapsed trial past its full grace) — send them to the lock screen
// instead of letting the failed request surface as a generic error.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 402 && error.response?.data?.code === 'SUBSCRIPTION_LOCKED') {
            if (window.location.pathname !== '/account-locked') {
                window.location.href = '/account-locked';
            }
        }
        return Promise.reject(error);
    }
);

export default api;