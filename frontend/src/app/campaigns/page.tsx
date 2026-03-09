'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Plus, Play, Pause, StopCircle, Upload, X, Clock, Users, Bot,
  Search, Filter, ChevronDown, ChevronUp, BarChart3, Phone, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Zap, Target, FileText, RefreshCw,
  Calendar, ArrowUpDown, MoreHorizontal, Eye, Pencil, Trash2
} from 'lucide-react';

type TabType = 'all' | 'active' | 'draft' | 'paused' | 'completed';
type SortField = 'name' | 'createdAt' | 'totalContacts' | 'status';

export default function CampaignsPage() {
  const [showModal, setShowModal] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formStep, setFormStep] = useState(1);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [campaignType, setCampaignType] = useState('outbound');
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch agents — correct path: /admin/agent (singular)
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', user.companyId],
    queryFn: async () => {
      const response = await api.get('/admin/agent', { params: { companyId: user.companyId } });
      return response.data.data;
    }
  });

  // Fetch campaigns — correct path: /campaigns/:companyId (path param)
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', user.companyId],
    queryFn: async () => {
      const response = await api.get(`/campaigns/${user.companyId}`);
      return response.data.data;
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => api.post('/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowModal(false);
      setContactInput('');
      setFormStep(1);
    }
  });

  const controlCampaignMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/campaigns/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowModal(false);
      setEditingCampaign(null);
      setContactInput('');
      setFormStep(1);
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setDeleteConfirm(null);
    }
  });

  const openEditModal = (campaign: any) => {
    setEditingCampaign(campaign);
    setCampaignType(campaign.type || 'outbound');
    setSelectedDays(campaign.schedule?.days || [1, 2, 3, 4, 5]);
    const contacts = Array.isArray(campaign.contactList)
      ? campaign.contactList.map((c: any) => typeof c === 'string' ? c : c.phone).join('\n')
      : '';
    setContactInput(contacts);
    setFormStep(1);
    setShowModal(true);
  };

  // Computed stats
  const stats = useMemo(() => {
    if (!campaigns) return { total: 0, active: 0, paused: 0, completed: 0, draft: 0, totalContacts: 0, totalReached: 0, totalSuccess: 0, totalFailed: 0, avgSuccessRate: 0 };
    const active = campaigns.filter((c: any) => c.status === 'running' || c.status === 'active').length;
    const paused = campaigns.filter((c: any) => c.status === 'paused').length;
    const completed = campaigns.filter((c: any) => c.status === 'completed').length;
    const draft = campaigns.filter((c: any) => c.status === 'draft' || c.status === 'scheduled').length;
    const totalContacts = campaigns.reduce((s: number, c: any) => s + (c.totalContacts || 0), 0);
    const totalReached = campaigns.reduce((s: number, c: any) => s + (c.contactsReached || 0), 0);
    const totalSuccess = campaigns.reduce((s: number, c: any) => s + (c.successfulCalls || 0), 0);
    const totalFailed = campaigns.reduce((s: number, c: any) => s + (c.failedCalls || 0), 0);
    const avgSuccessRate = totalReached > 0 ? (totalSuccess / totalReached) * 100 : 0;
    return { total: campaigns.length, active, paused, completed, draft, totalContacts, totalReached, totalSuccess, totalFailed, avgSuccessRate };
  }, [campaigns]);

  // Filtered & sorted campaigns
  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    let filtered = [...campaigns];
    if (activeTab !== 'all') {
      filtered = filtered.filter((c: any) => {
        if (activeTab === 'active') return c.status === 'running' || c.status === 'active';
        if (activeTab === 'draft') return c.status === 'draft' || c.status === 'scheduled';
        return c.status === activeTab;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.name?.toLowerCase().includes(q) || c.agent?.name?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a: any, b: any) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'createdAt') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [campaigns, activeTab, searchQuery, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      running: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Running' },
      active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
      paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Paused' },
      completed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Completed' },
      draft: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Draft' },
      scheduled: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Scheduled' },
    };
    return configs[status] || configs.draft;
  };

  const getProgressPercent = (c: any) => {
    if (!c.totalContacts) return 0;
    return Math.round(((c.contactsReached || 0) / c.totalContacts) * 100);
  };

  const getSuccessRate = (c: any) => {
    const reached = c.contactsReached || 0;
    if (!reached) return 0;
    return Math.round(((c.successfulCalls || 0) / reached) * 100);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').slice(1); // skip header
      const phones = lines
        .map(line => {
          const cols = line.split(',');
          // find column that looks like a phone number
          const phoneCol = cols.find(c => /^\+?\d[\d\s\-()]{7,}/.test(c.trim()));
          return phoneCol?.trim() || '';
        })
        .filter(p => p.length > 0);
      setContactInput(prev => prev ? prev + '\n' + phones.join('\n') : phones.join('\n'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const contactCount = contactInput.split(/[\n,]+/).filter(c => c.trim().length > 0).length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-1">Manage automated outbound calling campaigns</p>
            </div>
            <button
              onClick={() => { setEditingCampaign(null); setContactInput(''); setCampaignType('outbound'); setSelectedDays([1,2,3,4,5]); setShowModal(true); setFormStep(1); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg"><Target className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-gray-500">Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><Zap className="h-4 w-4 text-emerald-600" /></div>
                <span className="text-xs font-medium text-gray-500">Active</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg"><Users className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-gray-500">Contacts</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalContacts.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-50 rounded-lg"><Phone className="h-4 w-4 text-green-600" /></div>
                <span className="text-xs font-medium text-gray-500">Reached</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReached.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                <span className="text-xs font-medium text-gray-500">Successful</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.totalSuccess.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg"><TrendingUp className="h-4 w-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-gray-500">Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.avgSuccessRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Tabs + Search + Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
              {([
                { key: 'all', label: 'All', count: stats.total },
                { key: 'active', label: 'Active', count: stats.active },
                { key: 'draft', label: 'Draft', count: stats.draft },
                { key: 'paused', label: 'Paused', count: stats.paused },
                { key: 'completed', label: 'Completed', count: stats.completed },
              ] as { key: TabType; label: string; count: number }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-blue-200' : 'text-gray-400'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => toggleSort('createdAt')}
                className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort
              </button>
            </div>
          </div>

          {/* Campaign List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Target className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No campaigns match your search' : 'No campaigns yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {searchQuery ? 'Try adjusting your filters' : 'Create your first outbound campaign to start reaching customers'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => { setEditingCampaign(null); setContactInput(''); setCampaignType('outbound'); setSelectedDays([1,2,3,4,5]); setShowModal(true); setFormStep(1); }}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Create Campaign
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((campaign: any) => {
                const sc = getStatusConfig(campaign.status);
                const progress = getProgressPercent(campaign);
                const successRate = getSuccessRate(campaign);
                const isExpanded = expandedId === campaign.id;

                return (
                  <div key={campaign.id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                    {/* Main Row */}
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        {/* Status dot + name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-semibold text-gray-900 truncate">{campaign.name}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>
                              {sc.label}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-medium capitalize">
                              {campaign.type || 'outbound'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Bot className="h-3.5 w-3.5" />
                              {campaign.agent?.name || 'No agent'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {campaign.totalContacts || 0} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(campaign.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Quick metrics */}
                        <div className="hidden lg:flex items-center gap-6 text-center">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Reached</p>
                            <p className="text-sm font-semibold text-gray-700">{campaign.contactsReached || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Success</p>
                            <p className="text-sm font-semibold text-emerald-600">{successRate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Failed</p>
                            <p className="text-sm font-semibold text-red-500">{campaign.failedCalls || 0}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="hidden md:block w-32">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {(campaign.status === 'draft' || campaign.status === 'paused') && (
                            <button
                              onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: campaign.status === 'draft' ? 'start' : 'resume' })}
                              className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="Start"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {(campaign.status === 'running' || campaign.status === 'active') && (
                            <button
                              onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: 'pause' })}
                              className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          )}
                          {campaign.status !== 'completed' && (
                            <button
                              onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: 'stop' })}
                              className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              title="Stop"
                            >
                              <StopCircle className="h-4 w-4" />
                            </button>
                          )}
                          <div className="w-px h-6 bg-gray-200 mx-0.5" />
                          <button
                            onClick={() => openEditModal(campaign)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(campaign.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Details"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Total Contacts</p>
                            <p className="text-lg font-bold text-gray-900">{campaign.totalContacts || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Reached</p>
                            <p className="text-lg font-bold text-blue-600">{campaign.contactsReached || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Successful</p>
                            <p className="text-lg font-bold text-emerald-600">{campaign.successfulCalls || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Failed</p>
                            <p className="text-lg font-bold text-red-500">{campaign.failedCalls || 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Success Rate</p>
                            <p className="text-lg font-bold text-blue-600">{successRate}%</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-400 mb-1">Max Retries</p>
                            <p className="text-lg font-bold text-gray-700">{campaign.maxRetries || 3}</p>
                          </div>
                        </div>

                        {/* Schedule & Script */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {campaign.schedule && (
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Schedule
                              </p>
                              <p className="text-sm text-gray-700">
                                {campaign.schedule.startTime || '09:00'} - {campaign.schedule.endTime || '17:00'}
                              </p>
                              {campaign.schedule.days && (
                                <div className="flex gap-1 mt-2">
                                  {['S','M','T','W','T','F','S'].map((d, i) => (
                                    <span key={i} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                                      campaign.schedule.days?.includes(i)
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>{d}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {campaign.script && (
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" /> Script
                              </p>
                              <p className="text-sm text-gray-600 line-clamp-3">{campaign.script}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Campaign Modal — Multi-step */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</h2>
                  <p className="text-xs text-gray-500">Step {formStep} of 3</p>
                </div>
                <button onClick={() => { setShowModal(false); setFormStep(1); setEditingCampaign(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-6 pt-4">
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(step => (
                    <div key={step} className="flex items-center gap-2 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        formStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>{step}</div>
                      <span className={`text-xs hidden sm:block ${formStep >= step ? 'text-gray-700' : 'text-gray-400'}`}>
                        {step === 1 ? 'Details' : step === 2 ? 'Contacts' : 'Schedule'}
                      </span>
                      {step < 3 && <div className={`flex-1 h-0.5 ${formStep > step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Body */}
              <form
                id="campaign-form"
                className="flex-1 overflow-y-auto px-6 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const contacts = contactInput
                    .split(/[\n,]+/)
                    .map(c => c.trim())
                    .filter(c => c.length > 0)
                    .map(phone => ({ phone, name: '' }));

                  const payload = {
                    companyId: user.companyId,
                    name: formData.get('name'),
                    agentId: formData.get('agentId'),
                    type: campaignType,
                    contactList: contacts,
                    schedule: {
                      startTime: formData.get('startTime') || '09:00',
                      endTime: formData.get('endTime') || '17:00',
                      days: selectedDays,
                    },
                    maxRetries: parseInt(formData.get('maxRetries') as string) || 3,
                    retryDelay: parseInt(formData.get('retryDelay') as string) || 60,
                    script: formData.get('script') || null,
                    callObjective: formData.get('callObjective') || null,
                  };

                  if (editingCampaign) {
                    updateCampaignMutation.mutate({ id: editingCampaign.id, data: payload });
                  } else {
                    createCampaignMutation.mutate(payload);
                  }
                }}
              >
                {/* Step 1: Campaign Details */}
                <div className={formStep === 1 ? 'space-y-4' : 'hidden'}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={editingCampaign?.name || ''}
                      placeholder="e.g., Q1 Customer Follow-up"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'outbound', label: 'Outbound Calls', icon: Phone },
                        { value: 'survey', label: 'Survey', icon: BarChart3 },
                        { value: 'reminder', label: 'Reminder', icon: Clock },
                      ].map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setCampaignType(t.value)}
                          className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${
                            campaignType === t.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <t.icon className="h-4 w-4 mb-1" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      AI Agent *
                    </label>
                    {agentsLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Loading agents...
                      </div>
                    ) : (
                      <select
                        name="agentId"
                        required
                        defaultValue={editingCampaign?.agentId || ''}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">Select an AI agent...</option>
                        {(agents || []).map((agent: any) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} — {agent.language?.toUpperCase()} {agent.active ? '' : '(Inactive)'}
                          </option>
                        ))}
                      </select>
                    )}
                    {!agentsLoading && (!agents || agents.length === 0) && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        No agents found. Create an AI agent first.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Call Objective</label>
                    <input
                      type="text"
                      name="callObjective"
                      defaultValue={editingCampaign?.callObjective || ''}
                      placeholder="e.g., Schedule appointment, Collect feedback, Confirm delivery"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Script / Instructions</label>
                    <textarea
                      name="script"
                      rows={3}
                      defaultValue={editingCampaign?.script || ''}
                      placeholder="Instructions for the AI agent during campaign calls..."
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Step 2: Contacts */}
                <div className={formStep === 2 ? 'space-y-4' : 'hidden'}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">Contact Numbers *</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Upload className="h-3.5 w-3.5" /> Import CSV
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={handleCSVUpload}
                        />
                      </div>
                    </div>
                    <textarea
                      value={contactInput}
                      onChange={(e) => setContactInput(e.target.value)}
                      rows={8}
                      placeholder={"Enter phone numbers (one per line or comma-separated)\n+1234567890\n+0987654321\n+1122334455"}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      required
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{contactCount}</span> contacts entered
                      </p>
                      {contactCount > 0 && (
                        <button type="button" onClick={() => setContactInput('')} className="text-xs text-red-500 hover:text-red-600">
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                    <p className="font-medium mb-1">Supported formats:</p>
                    <ul className="space-y-0.5 text-blue-600">
                      <li>One number per line: +1234567890</li>
                      <li>Comma separated: +123..., +456...</li>
                      <li>CSV upload with phone column</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3: Schedule & Settings */}
                <div className={formStep === 3 ? 'space-y-4' : 'hidden'}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Active Days</label>
                    <div className="flex gap-2">
                      {dayNames.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedDays(prev =>
                            prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort()
                          )}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            selectedDays.includes(i)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        defaultValue="09:00"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time</label>
                      <input
                        type="time"
                        name="endTime"
                        defaultValue="17:00"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Retries</label>
                      <input
                        type="number"
                        name="maxRetries"
                        defaultValue={editingCampaign?.maxRetries ?? 3}
                        min={0}
                        max={10}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">Per contact if no answer</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Retry Delay (min)</label>
                      <input
                        type="number"
                        name="retryDelay"
                        defaultValue={editingCampaign?.retryDelay ?? 60}
                        min={5}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">Minutes between retry attempts</p>
                    </div>
                  </div>

                  {/* Summary before submit */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Campaign Summary</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Contacts: <span className="font-semibold text-gray-900">{contactCount}</span></div>
                      <div>Type: <span className="font-semibold text-gray-900 capitalize">{campaignType}</span></div>
                      <div>Active Days: <span className="font-semibold text-gray-900">{selectedDays.map(d => dayNames[d]).join(', ')}</span></div>
                      <div>Max Retries: <span className="font-semibold text-gray-900">3</span></div>
                    </div>
                  </div>
                </div>
              </form>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (formStep === 1) { setShowModal(false); setFormStep(1); setEditingCampaign(null); }
                    else setFormStep(s => s - 1);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {formStep === 1 ? 'Cancel' : 'Back'}
                </button>
                {formStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(s => s + 1)}
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="campaign-form"
                    disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                    className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {(createCampaignMutation.isPending || updateCampaignMutation.isPending) ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> {editingCampaign ? 'Saving...' : 'Creating...'}</>
                    ) : (
                      editingCampaign
                        ? <><Pencil className="h-4 w-4" /> Save Changes</>
                        : <><Plus className="h-4 w-4" /> Create Campaign</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Campaign</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this campaign? All associated call records will also be removed.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteCampaignMutation.mutate(deleteConfirm)}
                  disabled={deleteCampaignMutation.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {deleteCampaignMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="h-4 w-4" /> Delete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
