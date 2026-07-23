import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export function useCustomerApplications(status = 'pending') {
    return useQuery({
        queryKey: ['customer-applications', status],
        queryFn: async () => {
            const res = await api.get(`/customer-applications?status=${status}`);
            return res.data.data.applications;
        },
    });
}
