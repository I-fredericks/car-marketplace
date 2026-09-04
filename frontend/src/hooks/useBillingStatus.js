import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

/**
 * Subscription/billing status for the logged-in user. Shared via TanStack
 * Query cache so Navbar, Pricing, SellCar and SellerDashboard reuse one
 * request instead of each fetching /billing/status independently.
 */
const useBillingStatus = () => {
  const { user } = useContext(AuthContext);
  return useQuery({
    queryKey: ['billing-status', user?.id ?? null],
    queryFn: async () => {
      const { data } = await api.get('/billing/status');
      return data;
    },
    enabled: Boolean(user) && user.role !== 'BUYER',
    staleTime: 60_000,
  });
};

export default useBillingStatus;
