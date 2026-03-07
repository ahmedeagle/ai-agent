'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Eye, EyeOff, Users, Phone, Activity,
  Clock, Shield, Headphones, Volume2, Mic,
  PhoneIncoming, PhoneOutgoing, Radio
} from 'lucide-react';

type MonitorMode = 'listen' | 'whisper' | 'barge';

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [activeMonitor, setActiveMonitor] = useState<{ callId: string; mode: MonitorMode } | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Dashboard overview
  const { data: dashboard } = useQuery({
    queryKey: ['monitor-dashboard', companyId],
    queryFn: async () => (await api.get(`/monitor/dashboard/${companyId}`)).data.data,
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  // Active calls
  const { data: activeCalls } = useQuery({
    queryKey: ['monitor-active-calls', companyId],
    queryFn: async () => (await api.get(`/monitor/calls/active/${companyId}`)).data.data,
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  // Monitoring stats
  const { data: stats } = useQuery({
    queryKey: ['monitor-stats', companyId],
    queryFn: async () => (await api.get(`/monitor/stats/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  // Monitoring history
  const { data: history } = useQuery({
    queryKey: ['monitor-history', companyId],
    queryFn: async () => (await api.get(`/monitor/history/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  // Start monitoring
  const startMonitor = useMutation({
    mutationFn: async ({ callId, mode }: { callId: string; mode: MonitorMode }) => {
      const res = await api.post(`/monitor/${mode}`, { callId });
      return res.data;
    },
    onSuccess: (_, vars) => {
      setActiveMonitor({ callId: vars.callId, mode: vars.mode });
      queryClient.invalidateQueries({ queryKey: ['monitor-active-calls'] });
    },
  });

  // End monitoring
  const endMonitor = useMutation({
    mutationFn: async (callId: string) => {
      await api.post('/monitor/end', { callId });
    },
    onSuccess: () => {
      setActiveMonitor(null);
      queryClient.invalidateQueries({ queryKey: ['monitor-active-calls'] });
    },
  });

  const modeConfig: Record<MonitorMode, { icon: any; label: string; desc: string; color: string }> = {
    listen: { icon: Headphones, label: 'Listen', desc: 'Silent monitoring — caller and agent cannot hear you', color: 'bg-blue-600 hover:bg-blue-700' },
    whisper: { icon: Volume2, label: 'Whisper', desc: 'Coach the agent — only agent can hear you', color: 'bg-amber-600 hover:bg-amber-700' },
    barge: { icon: Mic, label: 'Barge', desc: 'Join the conversation — all parties hear you', color: 'bg-red-600 hover:bg-red-700' },
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Eye className="h-8 w-8 text-blue-600" /> Supervisor Monitoring
            </h1>
            <p className="text-gray-500 mt-1">Listen, whisper, or barge into active calls in real time</p>
          </div>

          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[
              { label: 'Active Calls', value: dashboard?.activeCalls || 0, icon: Phone, color: 'bg-blue-500' },
              { label: 'Queue Size', value: dashboard?.queueSize || 0, icon: Clock, color: 'bg-amber-500' },
              { label: 'Available Agents', value: dashboard?.availableAgents || 0, icon: Users, color: 'bg-green-500' },
              { label: 'My Sessions', value: dashboard?.monitoringSessions || 0, icon: Eye, color: 'bg-purple-500' },
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
                      <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Monitoring Banner */}
          {activeMonitor && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="animate-pulse">
                  <Radio className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Active Monitoring — {modeConfig[activeMonitor.mode].label} Mode
                  </p>
                  <p className="text-xs text-blue-600">{modeConfig[activeMonitor.mode].desc}</p>
                </div>
              </div>
              <button
                onClick={() => endMonitor.mutate(activeMonitor.callId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                <EyeOff className="h-4 w-4 inline mr-1" /> Stop
              </button>
            </div>
          )}

          {/* Active Calls Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" /> Active Calls
              </h3>
            </div>

            {activeCalls && activeCalls.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {activeCalls.map((call: any) => (
                  <div key={call.id} className="px-6 py-4 hover:bg-gray-50/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          call.direction === 'inbound' ? 'bg-cyan-50' : 'bg-indigo-50'
                        }`}>
                          {call.direction === 'inbound'
                            ? <PhoneIncoming className="h-4 w-4 text-cyan-600" />
                            : <PhoneOutgoing className="h-4 w-4 text-indigo-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {call.phone || call.phoneNumber || 'Unknown'} → {call.agent?.name || 'AI Agent'}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-500">
                              Started {new Date(call.startTime).toLocaleTimeString()}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              {call.status}
                            </span>
                            {call.isBeingMonitored && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                <Eye className="h-3 w-3" /> {call.monitorMode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {Object.entries(modeConfig).map(([mode, cfg]) => {
                          const Icon = cfg.icon;
                          const isActive = activeMonitor?.callId === call.id && activeMonitor?.mode === mode;
                          return (
                            <button
                              key={mode}
                              onClick={() => {
                                if (isActive) {
                                  endMonitor.mutate(call.id);
                                } else {
                                  startMonitor.mutate({ callId: call.id, mode: mode as MonitorMode });
                                }
                              }}
                              disabled={startMonitor.isPending || endMonitor.isPending}
                              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                                isActive
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : `text-white ${cfg.color}`
                              }`}
                              title={cfg.desc}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {isActive ? 'Stop' : cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active calls to monitor</p>
              </div>
            )}
          </div>

          {/* Stats + History Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monitoring Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" /> Statistics
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Total Sessions', value: stats?.total || 0 },
                  { label: 'Listen Mode', value: stats?.byAction?.listen || 0 },
                  { label: 'Whisper Mode', value: stats?.byAction?.whisper || 0 },
                  { label: 'Barge Mode', value: stats?.byAction?.barge || 0 },
                  { label: 'Avg Duration', value: `${stats?.averageDuration || 0}s` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent History */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Recent Monitoring Activity</h3>
              </div>
              {history && history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Supervisor</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Call</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(history || []).slice(0, 10).map((h: any) => {
                        const actionColors: Record<string, string> = {
                          listen: 'bg-blue-100 text-blue-700',
                          whisper: 'bg-amber-100 text-amber-700',
                          barge: 'bg-red-100 text-red-700',
                        };
                        return (
                          <tr key={h.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 text-sm text-gray-900">
                              {h.supervisor?.firstName} {h.supervisor?.lastName}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${actionColors[h.action] || 'bg-gray-100 text-gray-600'}`}>
                                {h.action}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">{h.call?.phone || '—'}</td>
                            <td className="px-6 py-3 text-sm text-gray-500">
                              {new Date(h.startedAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">
                              {h.duration ? `${h.duration}s` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No monitoring history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
