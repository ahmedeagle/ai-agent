'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  MessageSquare, Send, Search, Phone, Clock, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, Filter, ArrowUpRight
} from 'lucide-react';

export default function SMSPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'inbox' | 'send'>('inbox');
  const [search, setSearch] = useState('');
  const [sendForm, setSendForm] = useState({ to: '', body: '' });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Get SMS messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['sms-messages', companyId],
    queryFn: async () => (await api.get(`/sms/messages/${companyId}?limit=100`)).data.data,
    enabled: !!companyId,
  });

  // SMS stats
  const { data: stats } = useQuery({
    queryKey: ['sms-stats', companyId],
    queryFn: async () => (await api.get(`/sms/stats/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  // Send SMS
  const sendMutation = useMutation({
    mutationFn: async (data: { to: string; body: string }) => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (!u.companyId) throw new Error('Not logged in – no company ID');
      return (await api.post('/sms/send', { ...data, companyId: u.companyId, type: 'manual' })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] });
      setSendForm({ to: '', body: '' });
      setTab('inbox');
    },
  });

  const filtered = (messages || []).filter((m: any) =>
    !search || m.to?.includes(search) || m.from?.includes(search) || m.body?.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig: Record<string, { color: string; icon: any }> = {
    sent: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    delivered: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700', icon: XCircle },
    scheduled: { color: 'bg-blue-100 text-blue-700', icon: Clock },
    received: { color: 'bg-cyan-100 text-cyan-700', icon: ArrowUpRight },
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
                <MessageSquare className="h-8 w-8 text-blue-600" /> SMS Inbox
              </h1>
              <p className="text-gray-500 mt-1">Send and manage SMS messages</p>
            </div>
            <button
              onClick={() => setTab(tab === 'send' ? 'inbox' : 'send')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {tab === 'send' ? <MessageSquare className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {tab === 'send' ? 'View Inbox' : 'New Message'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
            {[
              { label: 'Total Sent', value: stats?.totalSent || (messages || []).length, icon: Send, color: 'bg-blue-500' },
              { label: 'Delivered', value: stats?.delivered || 0, icon: CheckCircle2, color: 'bg-green-500' },
              { label: 'Failed', value: stats?.failed || 0, icon: XCircle, color: 'bg-red-500' },
              { label: 'Scheduled', value: stats?.scheduled || 0, icon: Clock, color: 'bg-amber-500' },
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

          {/* Send Form */}
          {tab === 'send' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Compose SMS</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To (Phone Number)</label>
                  <input
                    type="text"
                    value={sendForm.to}
                    onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={sendForm.body}
                    onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type your message..."
                    maxLength={1600}
                  />
                  <p className="text-xs text-gray-400 mt-1">{sendForm.body.length}/1600 characters</p>
                </div>
                <button
                  onClick={() => sendMutation.mutate(sendForm)}
                  disabled={sendMutation.isPending || !sendForm.to || !sendForm.body}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sendMutation.isPending ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </div>
          )}

          {/* Inbox */}
          {tab === 'inbox' && (
            <>
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search by phone number or message content..."
                />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {filtered.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {filtered.map((msg: any) => {
                      const sc = statusConfig[msg.status] || statusConfig.sent;
                      const StatusIcon = sc.icon;
                      return (
                        <div key={msg.id} className="px-6 py-4 hover:bg-gray-50/50 transition">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                                <Phone className="h-4 w-4 text-gray-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">{msg.to}</p>
                                  <span className="text-xs text-gray-400">from {msg.from}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{msg.body}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${sc.color}`}>
                                    <StatusIcon className="h-3 w-3" /> {msg.status}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {msg.sentAt
                                      ? new Date(msg.sentAt).toLocaleString()
                                      : new Date(msg.createdAt).toLocaleString()}
                                  </span>
                                  {msg.type && msg.type !== 'manual' && (
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                      {msg.type.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{search ? 'No messages match your search' : 'No SMS messages yet'}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
