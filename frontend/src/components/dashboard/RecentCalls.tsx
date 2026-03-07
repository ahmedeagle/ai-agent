'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';

export default function RecentCalls() {
  const { data } = useQuery({
    queryKey: ['recent-calls'],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await api.get('/admin/call', {
        params: { companyId: user.companyId, limit: 10 }
      });
      return response.data.data.calls;
    }
  });

  const calls = data || [];

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Recent Calls</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Direction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calls.map((call: any) => (
              <tr key={call.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {call.direction === 'inbound' ? (
                    <div className="flex items-center gap-1 text-cyan-600">
                      <PhoneIncoming className="h-4 w-4" />
                      <span className="text-xs font-medium">Inbound</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-indigo-600">
                      <PhoneOutgoing className="h-4 w-4" />
                      <span className="text-xs font-medium">Outbound</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {call.from}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {call.to}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {call.agent?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full
                    ${call.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      call.status === 'failed' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {call.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {call.createdAt ? formatDistanceToNow(new Date(call.createdAt), { addSuffix: true }) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
