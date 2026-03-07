'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Bell, BellOff, CheckCheck, Trash2, AlertTriangle, Info,
  PhoneCall, CreditCard, Shield, MessageSquare, Filter
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  escalation: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  alert: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  system: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100' },
  billing: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-100' },
  call: { icon: PhoneCall, color: 'text-violet-600', bg: 'bg-violet-100' },
  security: { icon: Shield, color: 'text-red-600', bg: 'bg-red-100' },
  message: { icon: MessageSquare, color: 'text-cyan-600', bg: 'bg-cyan-100' },
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-300',
  normal: 'bg-blue-400',
  high: 'bg-orange-500',
  urgent: 'bg-red-500 animate-pulse',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  const { data: notifRes } = useQuery({
    queryKey: ['notifications', companyId, tab, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (tab === 'unread') params.set('read', 'false');
      if (typeFilter) params.set('type', typeFilter);
      return (await api.get(`/admin/notification/${companyId}?${params}`)).data;
    },
    enabled: !!companyId,
    refetchInterval: 15000,
  });

  const markReadMut = useMutation({
    mutationFn: async (id: string) => (await api.put(`/admin/notification/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => (await api.put(`/admin/notification/${companyId}/read-all`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/notification/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = notifRes?.data || [];
  const unreadCount = notifRes?.unreadCount || 0;

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Bell className="h-8 w-8 text-blue-600" /> Notifications
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </h1>
              <p className="text-gray-500 mt-1">System alerts, escalations & activity updates</p>
            </div>
            {unreadCount > 0 && (
              <button onClick={() => markAllReadMut.mutate()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                <CheckCheck className="h-4 w-4" /> Mark All Read
              </button>
            )}
          </div>

          {/* Tabs + Filter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-white rounded-lg border border-gray-200">
              <button onClick={() => setTab('all')}
                className={`px-4 py-2 text-xs font-medium rounded-l-lg ${tab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
                All
              </button>
              <button onClick={() => setTab('unread')}
                className={`px-4 py-2 text-xs font-medium rounded-r-lg ${tab === 'unread' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
                Unread ({unreadCount})
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                <option value="">All Types</option>
                {Object.keys(TYPE_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-2">
            {notifications.map((n: any) => {
              const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
              const Icon = config.icon;
              return (
                <div key={n.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-4 transition ${
                    !n.read ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                        <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[n.priority] || PRIORITY_DOT.normal}`} />
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                    {n.metadata && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(n.metadata).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.read && (
                      <button onClick={() => markReadMut.mutate(n.id)}
                        className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-400" title="Mark as read">
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deleteMut.mutate(n.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {notifications.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <BellOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm">{tab === 'unread' ? 'All caught up!' : 'Nothing here yet.'}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}
