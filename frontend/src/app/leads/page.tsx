'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Target, Plus, X, DollarSign, User, Phone, Mail,
  Calendar, ArrowRight, GripVertical, TrendingUp
} from 'lucide-react';

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-gray-100 border-gray-300 text-gray-700' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-300 text-blue-700' },
  { key: 'qualified', label: 'Qualified', color: 'bg-indigo-50 border-indigo-300 text-indigo-700' },
  { key: 'proposal', label: 'Proposal', color: 'bg-purple-50 border-purple-300 text-purple-700' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-50 border-amber-300 text-amber-700' },
  { key: 'won', label: 'Won', color: 'bg-green-50 border-green-300 text-green-700' },
  { key: 'lost', label: 'Lost', color: 'bg-red-50 border-red-300 text-red-700' },
];

const SOURCES = ['inbound_call', 'outbound_campaign', 'whatsapp', 'sms', 'web_chat', 'email', 'referral', 'manual'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', company: '',
    source: 'manual', priority: 'medium', estimatedValue: '', stage: 'new', notes: '',
  });

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  const { data: leadsRes } = useQuery({
    queryKey: ['leads', companyId],
    queryFn: async () => (await api.get(`/admin/lead/company/${companyId}?limit=200`)).data,
    enabled: !!companyId,
  });

  const { data: pipelineRes } = useQuery({
    queryKey: ['pipeline', companyId],
    queryFn: async () => (await api.get(`/admin/lead/pipeline/${companyId}`)).data,
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: async (d: any) => (await api.post('/admin/lead', { ...d, companyId })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); setShowCreate(false); },
  });

  const updateStageMut = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) =>
      (await api.put(`/admin/lead/${id}`, { stage })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); },
  });

  const leads = leadsRes?.data || [];
  const pipeline = pipelineRes?.data;

  const moveStage = (leadId: string, currentStage: string, direction: 1 | -1) => {
    const idx = STAGES.findIndex(s => s.key === currentStage);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < STAGES.length) {
      updateStageMut.mutate({ id: leadId, stage: STAGES[newIdx].key });
    }
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Target className="h-8 w-8 text-blue-600" /> Leads Pipeline
              </h1>
              <p className="text-gray-500 mt-1">
                {pipeline?.totalLeads || 0} leads · ${(pipeline?.totalPipelineValue || 0).toLocaleString()} pipeline value
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white rounded-lg border border-gray-200">
                <button onClick={() => setView('pipeline')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${view === 'pipeline' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
                  Pipeline
                </button>
                <button onClick={() => setView('list')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-r-lg ${view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
                  List
                </button>
              </div>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm">
                <Plus className="h-4 w-4" /> Add Lead
              </button>
            </div>
          </div>

          {/* Pipeline Summary */}
          {pipeline && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {STAGES.filter(s => s.key !== 'lost').map(stage => {
                const data = pipeline.stages?.[stage.key] || { count: 0, value: 0 };
                return (
                  <div key={stage.key} className={`flex-1 min-w-[120px] rounded-xl border p-3 ${stage.color}`}>
                    <p className="text-xs font-medium">{stage.label}</p>
                    <p className="text-lg font-bold">{data.count}</p>
                    <p className="text-[10px] opacity-70">${data.value.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pipeline Kanban View */}
          {view === 'pipeline' && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map(stage => {
                const stageLeads = leads.filter((l: any) => l.stage === stage.key);
                return (
                  <div key={stage.key} className="min-w-[260px] w-[260px] shrink-0">
                    <div className={`px-3 py-2 rounded-t-xl border-t-2 ${stage.color} mb-2`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{stage.label}</span>
                        <span className="text-xs opacity-70">{stageLeads.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2 min-h-[200px]">
                      {stageLeads.map((lead: any) => (
                        <div key={lead.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition group">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${PRIORITY_COLORS[lead.priority] || ''}`}>
                              {lead.priority}
                            </span>
                          </div>
                          {lead.company && <p className="text-xs text-gray-500 mb-1">{lead.company}</p>}
                          {lead.estimatedValue && (
                            <p className="text-xs text-green-600 font-medium mb-2">
                              <DollarSign className="h-3 w-3 inline" />{lead.estimatedValue.toLocaleString()}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            {lead.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{lead.phone.slice(-4)}</span>}
                            {lead.source && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{lead.source.replace('_', ' ')}</span>}
                          </div>
                          {/* Stage move buttons */}
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                            {stage.key !== 'new' && (
                              <button onClick={() => moveStage(lead.id, stage.key, -1)}
                                className="flex-1 py-1 text-[10px] bg-gray-100 rounded hover:bg-gray-200 text-gray-600">
                                ← Back
                              </button>
                            )}
                            {stage.key !== 'lost' && stage.key !== 'won' && (
                              <button onClick={() => moveStage(lead.id, stage.key, 1)}
                                className="flex-1 py-1 text-[10px] bg-blue-100 rounded hover:bg-blue-200 text-blue-700">
                                Next →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Contact</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Stage</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Source</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Value</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Priority</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((lead: any) => (
                    <tr key={lead.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                        {lead.company && <p className="text-xs text-gray-400">{lead.company}</p>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600">
                        {lead.phone && <p>{lead.phone}</p>}
                        {lead.email && <p className="text-gray-400">{lead.email}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STAGES.find(s => s.key === lead.stage)?.color || ''}`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{lead.source?.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-xs font-medium text-green-600">
                        {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${PRIORITY_COLORS[lead.priority] || ''}`}>
                          {lead.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">{new Date(lead.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-blue-600" /> New Lead</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Est. Value ($)</label>
                  <input type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate({
                ...form,
                estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : null,
              })}
                disabled={!form.firstName}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Create Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
