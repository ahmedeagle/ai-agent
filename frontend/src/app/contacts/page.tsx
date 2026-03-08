'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Contact, Search, UserPlus, X, Phone, Mail, Tag,
  MessageSquare, Globe, Star, ChevronRight, Upload
} from 'lucide-react';

const SEGMENTS = ['vip', 'standard', 'new'];

export default function ContactsPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ phoneNumber: '', email: '', firstName: '', lastName: '', segment: 'standard', tags: '', preferredLanguage: 'en' });

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  const { data: res } = useQuery({
    queryKey: ['contacts', companyId, search, segment],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: '100' });
      if (search) p.set('search', search);
      if (segment) p.set('segment', segment);
      return (await api.get(`/admin/customer/company/${companyId}?${p}`)).data;
    },
    enabled: !!companyId,
  });

  const { data: detail } = useQuery({
    queryKey: ['contact-detail', selected?.id],
    queryFn: async () => (await api.get(`/admin/customer/${selected.id}`)).data.data,
    enabled: !!selected?.id,
  });

  const createMut = useMutation({
    mutationFn: async (d: any) => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (!u.companyId) throw new Error('Not logged in');
      return (await api.post('/admin/customer', { ...d, companyId: u.companyId })).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowCreate(false); },
  });

  const contacts = res?.data || [];
  const total = res?.total || 0;

  const sentimentColor = (s: string) =>
    s === 'positive' ? 'text-green-600' : s === 'negative' ? 'text-red-600' : 'text-gray-500';

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Contact className="h-8 w-8 text-blue-600" /> Contacts
              </h1>
              <p className="text-gray-500 mt-1">{total} contacts across all channels</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm">
              <UserPlus className="h-4 w-4" /> Add Contact
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <select value={segment} onChange={e => setSegment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">All Segments</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact List */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {contacts.map((c: any) => (
                  <div key={c.id} onClick={() => setSelected(c)}
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition ${selected?.id === c.id ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs text-white font-bold">
                        {(c.firstName?.[0] || c.phoneNumber?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : c.phoneNumber}
                        </p>
                        <p className="text-xs text-gray-500">{c.phoneNumber}{c.email ? ` · ${c.email}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.segment && (
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                          c.segment === 'vip' ? 'bg-amber-100 text-amber-700' : c.segment === 'new' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>{c.segment}</span>
                      )}
                      <span className="text-xs text-gray-400">{c.totalCalls} calls</span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <Contact className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No contacts found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact 360 Detail Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              {detail ? (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl text-white font-bold mb-3">
                      {(detail.firstName?.[0] || '?').toUpperCase()}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {detail.firstName} {detail.lastName}
                    </h3>
                    <p className={`text-xs ${sentimentColor(detail.sentiment || '')}`}>
                      {detail.sentiment ? `Sentiment: ${detail.sentiment}` : ''}
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" /> {detail.phoneNumber}
                    </div>
                    {detail.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" /> {detail.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4 text-gray-400" /> {detail.preferredLanguage?.toUpperCase()}
                    </div>
                    {detail.lifetimeValue != null && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="h-4 w-4 text-amber-500" /> LTV: ${detail.lifetimeValue?.toFixed(2)}
                      </div>
                    )}
                    {(detail.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {detail.tags.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interaction counts */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{detail.totalCalls}</p>
                      <p className="text-[10px] text-gray-500">Calls</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{detail.smsMessages?.length || 0}</p>
                      <p className="text-[10px] text-gray-500">SMS</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{detail.whatsappMessages?.length || 0}</p>
                      <p className="text-[10px] text-gray-500">WhatsApp</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{detail.emailMessages?.length || 0}</p>
                      <p className="text-[10px] text-gray-500">Emails</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Recent Notes</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(detail.notes || []).length > 0 ? detail.notes.map((n: any) => (
                      <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-700">{n.content}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    )) : (
                      <p className="text-xs text-gray-400">No notes yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400">
                  <Contact className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a contact to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Add Contact</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                <input value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="+1234567890" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Segment</label>
                  <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                  <select value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {['en', 'ar', 'es', 'fr', 'de'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="lead, premium" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate({ ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [] })}
                disabled={!form.phoneNumber}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
