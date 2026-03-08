'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import StatsCards from '@/components/dashboard/StatsCards';
import CallsChart from '@/components/dashboard/CallsChart';
import ActiveCalls from '@/components/dashboard/ActiveCalls';
import RecentCalls from '@/components/dashboard/RecentCalls';
import BillingWidget from '@/components/dashboard/BillingWidget';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login');
    } else {
      setUser(JSON.parse(userData || '{}'));
    }
  }, [router]);

  const { data: kpiData, isLoading: kpiLoading, isError: kpiError } = useQuery({
    queryKey: ['kpi-summary'],
    queryFn: async () => {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      if (!userData.companyId) throw new Error('No company ID');
      const response = await api.get('/analytics/kpi/summary', {
        params: { company_id: userData.companyId }
      });
      return response.data.data;
    },
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 1000,
  });

  if (!user) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Welcome back, {user.firstName}!
            </p>
          </div>

          <StatsCards data={kpiData?.overview} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <CallsChart />
            </div>
            <BillingWidget />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <ActiveCalls />
            <RecentCalls />
          </div>
        </div>
      </main>
    </div>
  );
}
