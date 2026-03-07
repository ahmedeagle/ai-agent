'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Inbox, Phone, MessageSquare, MessageCircle, Mail,
  Search, Filter, Clock, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, AlertCircle
} from 'lucide-react';

const CHANNEL_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  voice: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Voice' },
  sms: { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-100', label: 'SMS' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'WhatsApp' },
  email: { icon: Mail, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Email' },
};

interface UnifiedItem {
  id: string;
  channel: string;
  contact: string;
  direction: string;
  preview: string;
  status: string;
  timestamp: string;
  _raw: any;
}

export default function OmnichannelPage() {
  const [user, setUser] = useState<any>(null);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UnifiedItem | null>(null);

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  // Fetch recent calls
  const { data: calls } = useQuery({
    queryKey: ['omni-calls', companyId],
    queryFn: async () => (await api.get(`/admin/call/company/${companyId}?limit=30`)).data.data,
    enabled: !!companyId,
  });

  // Fetch recent SMS
  const { data: smsData } = useQuery({
    queryKey: ['omni-sms', companyId],
    queryFn: async () => (await api.get(`/sms/messages/${companyId}?limit=30`)).data.data,
    enabled: !!companyId,
  });

  // Fetch recent WhatsApp conversations
  const { data: waData } = useQuery({
    queryKey: ['omni-wa', companyId],
    queryFn: async () => (await api.get(`/whatsapp/conversations/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  // Fetch recent emails
  const { data: emailData } = useQuery({
    queryKey: ['omni-email', companyId],
    queryFn: async () => (await api.get(`/email/history/${companyId}?limit=30`)).data.data,
    enabled: !!companyId,
  });

  // Unify all channel items into a single timeline
  const unified: UnifiedItem[] = [];

  (calls || []).forEach((c: any) => unified.push({
    id: c.id,
    channel: 'voice',
    contact: c.direction === 'inbound' ? c.from : c.to,
    direction: c.direction,
    preview: `${c.direction} call — ${c.status} — ${c.duration || 0}s`,
    status: c.status,
    timestamp: c.createdAt,
    _raw: c,
  }));

  (smsData || []).forEach((m: any) => unified.push({
    id: m.id,
    channel: 'sms',
    contact: m.direction === 'inbound' ? m.from : m.to,
    direction: m.direction || 'outbound',
    preview: m.body?.slice(0, 100) || '[no content]',
    status: m.status,
    timestamp: m.createdAt,
    _raw: m,
  }));

  (waData || []).forEach((w: any) => unified.push({
    id: w.contact,
    channel: 'whatsapp',
    contact: w.contact,
    direction: w.direction || 'inbound',
    preview: w.lastMessage || '[media]',
    status: w.status || 'delivered',
    timestamp: w.lastMessageAt,
    _raw: w,
  }));

  (emailData || []).forEach((e: any) => unified.push({
    id: e.id,
    channel: 'email',
    contact: e.to,
    direction: 'outbound',
    preview: e.subject || e.body?.slice(0, 100),
    status: e.status,
    timestamp: e.createdAt,
    _raw: e,
  }));

  // Sort by timestamp descending
  unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply filters
  const filtered = unified.filter(item => {
    if (channelFilter !== 'all' && item.channel !== channelFilter) return false;
    if (search && !item.contact.includes(search) && !item.preview.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Channel counts
  const counts = { all: unified.length, voice: 0, sms: 0, whatsapp: 0, email: 0 };
  unified.forEach(i => { counts[i.channel as keyof typeof counts]++; });

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Inbox className="h-8 w-8 text-blue-600" /> Omnichannel Inbox
            </h1>
            <p className="text-gray-500 mt-1">All customer interactions across voice, SMS, WhatsApp, and email in one place</p>
          </div>

          {/* Channel Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'all', label: 'All', icon: Inbox, color: 'blue' },
              { key: 'voice', label: 'Voice', icon: Phone, color: 'blue' },
              { key: 'sms', label: 'SMS', icon: MessageSquare, color: 'purple' },
              { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'green' },
              { key: 'email', label: 'Email', icon: Mail, color: 'amber' },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setChannelFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  channelFilter === tab.key
                    ? `bg-${tab.color}-600 text-white shadow-sm`
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span className={`ml-1 text-xs ${channelFilter === tab.key ? 'text-white/70' : 'text-gray-400'}`}>
                  {counts[tab.key as keyof typeof counts] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search across all channels..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Unified Timeline */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filtered.length > 0 ? filtered.map(item => {
                  const cfg = CHANNEL_CONFIG[item.channel];
                  const ChannelIcon = cfg.icon;
                  const isInbound = item.direction === 'inbound';

                  return (
                    <div key={`${item.channel}-${item.id}`}
                      onClick={() => setSelected(item)}
                      className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition ${
                        selected?.id === item.id && selected?.channel === item.channel ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
                      }`}>
                      <div className={`p-2.5 rounded-xl ${cfg.bg}`}>
                        <ChannelIcon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isInbound ? <ArrowDownLeft className="h-3 w-3 text-green-500" /> : <ArrowUpRight className="h-3 w-3 text-blue-500" />}
                          <span className="text-sm font-medium text-gray-900">{item.contact}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.preview}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] mt-0.5 ${
                          item.status === 'completed' || item.status === 'delivered' || item.status === 'read'
                            ? 'text-green-600'
                            : item.status === 'failed' ? 'text-red-500'
                            : 'text-gray-400'
                        }`}>
                          {item.status === 'completed' || item.status === 'delivered' ? <CheckCircle2 className="h-3 w-3" /> : null}
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-16 text-gray-400">
                    <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No interactions found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              {selected ? (() => {
                const cfg = CHANNEL_CONFIG[selected.channel];
                const ChannelIcon = cfg.icon;
                return (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`p-3 rounded-xl ${cfg.bg}`}>
                        <ChannelIcon className={`h-6 w-6 ${cfg.color}`} />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{selected.contact}</p>
                        <p className={`text-xs ${cfg.color}`}>{cfg.label} · {selected.direction}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          selected.status === 'completed' || selected.status === 'delivered' ? 'bg-green-100 text-green-700'
                          : selected.status === 'failed' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{selected.status}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Timestamp</label>
                        <p className="text-sm text-gray-900">{new Date(selected.timestamp).toLocaleString()}</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Preview</label>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.preview}</p>
                      </div>

                      {/* Channel-specific details */}
                      {selected.channel === 'voice' && selected._raw && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Duration</span>
                            <span className="text-gray-900">{selected._raw.duration || 0}s</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Call SID</span>
                            <span className="text-gray-900 font-mono text-xs">{selected._raw.callSid?.slice(0, 16)}…</span>
                          </div>
                        </div>
                      )}

                      {selected.channel === 'whatsapp' && selected._raw && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Messages</span>
                            <span className="text-gray-900">{selected._raw.messageCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Unread</span>
                            <span className="text-gray-900">{selected._raw.unread}</span>
                          </div>
                        </div>
                      )}

                      {selected.channel === 'email' && selected._raw && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                          <p className="text-sm text-gray-900">{selected._raw.subject}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Quick Actions</p>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`/contacts`}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
                          View Contact
                        </a>
                        {selected.channel === 'whatsapp' && (
                          <a href={`/whatsapp`}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100">
                            Open Chat
                          </a>
                        )}
                        {selected.channel === 'voice' && (
                          <a href={`/calls/${selected._raw?.id}`}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
                            Call Details
                          </a>
                        )}
                        {selected.channel === 'sms' && (
                          <a href={`/sms`}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100">
                            SMS Inbox
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center py-20 text-gray-400">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select an interaction to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
