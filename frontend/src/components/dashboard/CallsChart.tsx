'use client';

import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';

export default function CallsChart() {
  const { data } = useQuery({
    queryKey: ['calls-analytics'],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await api.get('/analytics/calls', {
        params: { company_id: user.companyId, time_range: '7d' }
      });
      return response.data.data;
    }
  });

  const chartData = data?.dataPoints || [];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Call Volume (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="totalCalls" stroke="#3B82F6" strokeWidth={2} name="Total" />
          <Line type="monotone" dataKey="inboundCalls" stroke="#06B6D4" strokeWidth={2} name="Inbound" />
          <Line type="monotone" dataKey="outboundCalls" stroke="#6366F1" strokeWidth={2} name="Outbound" />
          <Line type="monotone" dataKey="completedCalls" stroke="#10B981" strokeWidth={2} name="Completed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
