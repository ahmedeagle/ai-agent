'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { Plus, Edit, Trash2, Power, PowerOff, X, Save, Volume2, Phone, Brain, Code, AlertTriangle, Globe } from 'lucide-react';

const VOICES = [
  { id: 'alloy', name: 'Alloy', desc: 'Neutral, balanced' },
  { id: 'echo', name: 'Echo', desc: 'Warm, conversational' },
  { id: 'fable', name: 'Fable', desc: 'British, expressive' },
  { id: 'onyx', name: 'Onyx', desc: 'Deep, authoritative' },
  { id: 'nova', name: 'Nova', desc: 'Female, friendly' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Soft, clear' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
];

interface AgentForm {
  name: string;
  language: string;
  voice: string;
  systemPrompt: string;
  phoneNumber: string;
  tools: string[];
  knowledgeBase: string;
  escalationRules: { condition: string; action: string }[];
  active: boolean;
}

const defaultForm: AgentForm = {
  name: '',
  language: 'en',
  voice: 'alloy',
  systemPrompt: '',
  phoneNumber: '',
  tools: [],
  knowledgeBase: '',
  escalationRules: [{ condition: '', action: 'transfer_human' }],
  active: true,
};

export default function AgentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [form, setForm] = useState<AgentForm>(defaultForm);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'prompt' | 'tools' | 'escalation'>('basic');
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.get('/admin/agent', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  // Fetch available tools from admin service
  const { data: availableTools } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const response = await api.get('/admin/tool', { params: { companyId: user.companyId } });
      return response.data.data || [];
    }
  });

  useEffect(() => {
    if (selectedAgent) {
      setForm({
        name: selectedAgent.name || '',
        language: selectedAgent.language || 'en',
        voice: selectedAgent.voice || 'alloy',
        systemPrompt: selectedAgent.systemPrompt || '',
        phoneNumber: selectedAgent.phoneNumber || '',
        tools: selectedAgent.tools || [],
        knowledgeBase: selectedAgent.knowledgeBase || '',
        escalationRules: selectedAgent.escalationRules?.length
          ? selectedAgent.escalationRules
          : [{ condition: '', action: 'transfer_human' }],
        active: selectedAgent.active ?? true,
      });
    } else {
      setForm(defaultForm);
    }
    setActiveFormTab('basic');
  }, [selectedAgent]);

  const createMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      return api.post('/admin/agent', { ...data, companyId: user.companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowModal(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      return api.put(`/admin/agent/${selectedAgent.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowModal(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/agent/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedForm = {
      ...form,
      escalationRules: form.escalationRules.filter(r => r.condition.trim() !== ''),
      phoneNumber: form.phoneNumber || undefined,
    };
    if (selectedAgent) {
      updateMutation.mutate(cleanedForm);
    } else {
      createMutation.mutate(cleanedForm);
    }
  };

  const handleToolToggle = (toolName: string) => {
    setForm(prev => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter(t => t !== toolName)
        : [...prev.tools, toolName]
    }));
  };

  const addEscalationRule = () => {
    setForm(prev => ({
      ...prev,
      escalationRules: [...prev.escalationRules, { condition: '', action: 'transfer_human' }]
    }));
  };

  const removeEscalationRule = (index: number) => {
    setForm(prev => ({
      ...prev,
      escalationRules: prev.escalationRules.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Agents</h1>
            <p className="text-gray-600 mt-1">Manage your voice AI agents</p>
          </div>
          <button
            onClick={() => {
              setSelectedAgent(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Create Agent
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents?.map((agent: any) => (
              <div key={agent.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.language}</p>
                  </div>
                  {agent.active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Power className="h-3 w-3 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <PowerOff className="h-3 w-3 mr-1" />
                      Inactive
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">Voice:</span> {agent.voice}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span> {agent.phoneNumber || 'Not assigned'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Tools:</span> {agent.tools?.length || 0} enabled
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this agent?')) {
                        deleteMutation.mutate(agent.id);
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded text-sm hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!agents || agents.length === 0) && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No agents created yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Your First Agent
            </button>
          </div>
        )}

        {/* Agent Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Form Tabs */}
                <div className="flex border-b bg-white px-6">
                  {[
                    { id: 'basic', label: 'Basic Info', icon: Globe },
                    { id: 'prompt', label: 'System Prompt', icon: Brain },
                    { id: 'tools', label: 'Tools & KB', icon: Code },
                    { id: 'escalation', label: 'Escalation', icon: AlertTriangle },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveFormTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeFormTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="p-6 overflow-y-auto max-h-[55vh]">
                    {/* Basic Info Tab */}
                    {activeFormTab === 'basic' && (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name *</label>
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Healthcare Assistant"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                            <select
                              value={form.language}
                              onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value }))}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              {LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input
                              type="text"
                              value={form.phoneNumber}
                              onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                              placeholder="+1234567890"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
                          <div className="grid grid-cols-3 gap-3">
                            {VOICES.map(v => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, voice: v.id }))}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  form.voice === v.id
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Volume2 className={`h-4 w-4 ${form.voice === v.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                  <span className="font-medium text-sm">{v.name}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.active}
                              onChange={(e) => setForm(prev => ({ ...prev, active: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                          <span className="text-sm font-medium text-gray-700">Agent Active</span>
                        </div>
                      </div>
                    )}

                    {/* System Prompt Tab */}
                    {activeFormTab === 'prompt' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt *</label>
                          <p className="text-xs text-gray-500 mb-2">
                            Define the AI agent&apos;s personality, role, and behavior guidelines.
                          </p>
                          <textarea
                            required
                            rows={15}
                            value={form.systemPrompt}
                            onChange={(e) => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder={`You are a healthcare assistant for [Company Name].

Your responsibilities:
- Verify patient identity before accessing records
- Help schedule appointments
- Answer questions about services
- Escalate to a human agent if unsure

Rules:
- Always be professional and empathetic
- Never share information about other patients
- Confirm all actions before executing them`}
                          />
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-800">
                            <strong>Tip:</strong> Be specific about the agent&apos;s role, rules, and when to escalate. Include sample responses and forbidden actions for best results.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tools & Knowledge Base Tab */}
                    {activeFormTab === 'tools' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Available Tools</label>
                          <p className="text-xs text-gray-500 mb-3">Select tools this agent can use during calls.</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(availableTools || [
                              { name: 'getPatientInfo', description: 'Look up patient records' },
                              { name: 'createAppointment', description: 'Book appointments' },
                              { name: 'cancelOrder', description: 'Cancel existing orders' },
                              { name: 'createTicket', description: 'Create support tickets' },
                              { name: 'scheduleCallback', description: 'Schedule callback calls' },
                            ]).map((tool: any) => (
                              <label
                                key={tool.name}
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  form.tools.includes(tool.name)
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={form.tools.includes(tool.name)}
                                  onChange={() => handleToolToggle(tool.name)}
                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{tool.name}</span>
                                  <p className="text-xs text-gray-500">{tool.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base ID</label>
                          <p className="text-xs text-gray-500 mb-2">Link a knowledge base for context-aware responses.</p>
                          <input
                            type="text"
                            value={form.knowledgeBase}
                            onChange={(e) => setForm(prev => ({ ...prev, knowledgeBase: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Knowledge base identifier (optional)"
                          />
                        </div>
                      </div>
                    )}

                    {/* Escalation Rules Tab */}
                    {activeFormTab === 'escalation' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Escalation Rules</label>
                            <p className="text-xs text-gray-500">Define when the AI should transfer to a human.</p>
                          </div>
                          <button
                            type="button"
                            onClick={addEscalationRule}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <Plus className="h-4 w-4" />
                            Add Rule
                          </button>
                        </div>

                        <div className="space-y-3">
                          {form.escalationRules.map((rule, index) => (
                            <div key={index} className="flex gap-3 items-start p-3 border rounded-lg bg-gray-50">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
                                <input
                                  type="text"
                                  value={rule.condition}
                                  onChange={(e) => {
                                    const updated = [...form.escalationRules];
                                    updated[index] = { ...updated[index], condition: e.target.value };
                                    setForm(prev => ({ ...prev, escalationRules: updated }));
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                  placeholder="e.g., Customer asks for supervisor, Sentiment drops below 0.3"
                                />
                              </div>
                              <div className="w-48">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
                                <select
                                  value={rule.action}
                                  onChange={(e) => {
                                    const updated = [...form.escalationRules];
                                    updated[index] = { ...updated[index], action: e.target.value };
                                    setForm(prev => ({ ...prev, escalationRules: updated }));
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="transfer_human">Transfer to Human</option>
                                  <option value="transfer_department">Transfer to Department</option>
                                  <option value="create_ticket">Create Ticket</option>
                                  <option value="schedule_callback">Schedule Callback</option>
                                  <option value="end_call">End Call</option>
                                </select>
                              </div>
                              {form.escalationRules.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeEscalationRule(index)}
                                  className="mt-6 text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-800">
                            <strong>Examples:</strong> &quot;Customer mentions legal&quot;, &quot;3 failed tool attempts&quot;, &quot;Customer requests refund over $500&quot;, &quot;Negative sentiment detected 3 times&quot;
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                      <Save className="h-4 w-4" />
                      {createMutation.isPending || updateMutation.isPending
                        ? 'Saving...'
                        : selectedAgent ? 'Update Agent' : 'Create Agent'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
