'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  ListOrdered, Users, Clock, Phone, AlertTriangle, XCircle,
  CheckCircle2, TrendingDown, PhoneForwarded, ArrowRight, RefreshCw
} from 'lucide-react';

export default function QueuePage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'live' | 'history' | 'callbacks' | 'stats'>('live');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Live queue status
  const { data: queueStatus } = useQuery({
    queryKey: ['queue-status', companyId],
    queryFn: async () => (await api.get(`/queue/${companyId}/status`)).data.data,
    enabled: !!companyId,
    refetchInterval: 3000,
  });

  // Queue stats
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats', companyId],
    queryFn: async () => (await api.get(`/queue/${companyId}/stats`)).data.data,
    enabled: !!companyId,
  });

  // Queue history
  const { data: history } = useQuery({
    queryKey: ['queue-history', companyId],
    queryFn: async () => (await api.get(`/queue/${companyId}/history?limit=50`)).data.data,
    enabled: !!companyId && tab === 'history',
  });

  // Pending callbacks
  const { data: callbacks } = useQuery({
    queryKey: ['queue-callbacks', companyId],
    queryFn: async () => (await api.get(`/queue/${companyId}/callbacks`)).data.data,
    enabled: !!companyId && tab === 'callbacks',
  });

  // Remove from queue
  const removeMutation = useMutation({
    mutationFn: async (callId: string) =>
      (await api.post('/queue/remove', { callId, reason: 'supervisor_removed' })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue-status'] }),
  });

  const fmtDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const statusColors: Record<string, string> = {
    waiting: 'bg-amber-100 text-amber-700',
    connected: 'bg-green-100 text-green-700',
    abandoned: 'bg-red-100 text-red-700',
    timeout: 'bg-gray-100 text-gray-600',
    callback_scheduled: 'bg-blue-100 text-blue-700',
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ListOrdered className="h-8 w-8 text-blue-600" /> Queue Management
              </h1>
              <p className="text-gray-500 mt-1">Monitor and manage callers waiting in queue</p>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['queue-status'] })}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
            {[
              { label: 'In Queue Now', value: queueStatus?.queueSize || 0, icon: Users, color: 'bg-amber-500' },
              { label: 'Avg Wait Time', value: fmtDuration(queueStatus?.averageWaitTime || queueStats?.averageWaitTime || 0), icon: Clock, color: 'bg-blue-500' },
              { label: 'Connected', value: queueStats?.connected || 0, icon: CheckCircle2, color: 'bg-green-500' },
              { label: 'Abandoned', value: queueStats?.abandoned || 0, icon: XCircle, color: 'bg-red-500' },
              { label: 'Abandon Rate', value: `${queueStats?.abandonRate || 0}%`, icon: TrendingDown, color: 'bg-purple-500' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3">
                    <div className={`${s.color} p-2.5 rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {(['live', 'history', 'callbacks', 'stats'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'live' ? 'Live Queue' : t === 'callbacks' ? 'Callbacks' : t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'live' && queueStatus?.queueSize > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                    {queueStatus.queueSize}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Live Queue */}
          {tab === 'live' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {queueStatus?.entries && queueStatus.entries.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {queueStatus.entries.map((entry: any) => (
                    <div key={entry.callId} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-amber-100 text-amber-700 rounded-lg font-bold">
                          #{entry.position}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{entry.phone}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Waiting {fmtDuration(entry.waitTime)}
                            </span>
                            <span>Priority: {entry.priority}</span>
                            <span>ETA: {fmtDuration(entry.estimatedWaitTime)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMutation.mutate(entry.callId)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <ListOrdered className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Queue is empty — no callers waiting</p>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {tab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {history && history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Phone</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase">Wait Time</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase">Priority</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((h: any) => (
                        <tr key={h.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{h.phone}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[h.status] || 'bg-gray-100 text-gray-600'}`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-700 text-right">
                            {h.waitTime ? fmtDuration(h.waitTime) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-700 text-right">{h.priority}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">
                            {new Date(h.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No queue history yet</p>
                </div>
              )}
            </div>
          )}

          {/* Callbacks */}
          {tab === 'callbacks' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {callbacks && callbacks.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {callbacks.map((cb: any) => (
                    <div key={cb.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <PhoneForwarded className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cb.phone}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Scheduled: {cb.estimatedCallbackTime
                              ? new Date(cb.estimatedCallbackTime).toLocaleString()
                              : 'ASAP'}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <PhoneForwarded className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No pending callbacks</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {tab === 'stats' && queueStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Performance</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Total Queued', value: queueStats.total },
                    { label: 'Successfully Connected', value: queueStats.connected },
                    { label: 'Abandoned', value: queueStats.abandoned },
                    { label: 'Timed Out', value: queueStats.timeout },
                    { label: 'Avg Wait Time', value: fmtDuration(queueStats.averageWaitTime) },
                    { label: 'Abandon Rate', value: `${queueStats.abandonRate}%` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-semibold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Rate</h3>
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-green-600">
                      {queueStats.total > 0
                        ? ((queueStats.connected / queueStats.total) * 100).toFixed(0)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-500 mt-2">of queued callers connected</p>
                  </div>
                </div>
                {queueStats.abandonRate > 15 && (
                  <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Abandon rate is above 15%. Consider increasing concurrent agent capacity or offering callbacks.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
