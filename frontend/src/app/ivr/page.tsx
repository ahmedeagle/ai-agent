'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  GitBranch, Plus, Trash2, Save, Phone, Volume2,
  Hash, ArrowRight, Users, Voicemail, Globe, MessageSquare,
  Settings, X, Pencil, ToggleLeft, ToggleRight, BarChart3
} from 'lucide-react';

interface IVROption {
  key: string;
  label: string;
  action: 'route_agent' | 'route_human' | 'submenu' | 'voicemail' | 'callback' | 'language';
  target: string;
}

interface IVRMenu {
  id: string;
  name: string;
  companyId: string;
  entryPrompt: string;
  language: string;
  timeout: number;
  maxRetries: number;
  active: boolean;
  options: IVROption[];
  createdAt: string;
}

const actionIcons: Record<string, any> = {
  route_agent: Phone,
  route_human: Users,
  submenu: GitBranch,
  voicemail: Voicemail,
  callback: ArrowRight,
  language: Globe,
};

const actionLabels: Record<string, string> = {
  route_agent: 'Route to AI Agent',
  route_human: 'Route to Human',
  submenu: 'Go to Submenu',
  voicemail: 'Leave Voicemail',
  callback: 'Schedule Callback',
  language: 'Switch Language',
};

export default function IVRPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingMenu, setEditingMenu] = useState<IVRMenu | null>(null);
  const [form, setForm] = useState({
    name: '',
    entryPrompt: '',
    language: 'en',
    timeout: 5,
    maxRetries: 3,
    options: [] as IVROption[],
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Get company IVR menus
  const { data: menus } = useQuery({
    queryKey: ['ivr-menus', companyId],
    queryFn: async () => {
      // Get all menus via the company active endpoint + we'll also fetch by listing 
      const res = await api.get(`/ivr/company/${companyId}`);
      return res.data.data;
    },
    enabled: !!companyId,
  });

  // Analytics
  const { data: analytics } = useQuery({
    queryKey: ['ivr-analytics', companyId],
    queryFn: async () => (await api.get(`/ivr/analytics/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  // Create/Update menu
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMenu) {
        return (await api.put(`/ivr/menu/${editingMenu.id}`, data)).data;
      }
      return (await api.post('/ivr/menu', { ...data, companyId })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ivr-menus'] });
      queryClient.invalidateQueries({ queryKey: ['ivr-analytics'] });
      resetForm();
    },
  });

  // Delete menu
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/ivr/menu/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ivr-menus'] }),
  });

  const resetForm = () => {
    setShowEditor(false);
    setEditingMenu(null);
    setForm({ name: '', entryPrompt: '', language: 'en', timeout: 5, maxRetries: 3, options: [] });
  };

  const openEditor = (menu?: IVRMenu) => {
    if (menu) {
      setEditingMenu(menu);
      setForm({
        name: menu.name,
        entryPrompt: menu.entryPrompt,
        language: menu.language,
        timeout: menu.timeout,
        maxRetries: menu.maxRetries,
        options: Array.isArray(menu.options) ? menu.options : [],
      });
    } else {
      setEditingMenu(null);
      setForm({ name: '', entryPrompt: '', language: 'en', timeout: 5, maxRetries: 3, options: [] });
    }
    setShowEditor(true);
  };

  const addOption = () => {
    if (form.options.length >= 9) return;
    const nextKey = String(form.options.length + 1);
    setForm({
      ...form,
      options: [...form.options, { key: nextKey, label: '', action: 'route_agent', target: '' }],
    });
  };

  const updateOption = (index: number, field: keyof IVROption, value: string) => {
    const updated = [...form.options];
    (updated[index] as any)[field] = value;
    setForm({ ...form, options: updated });
  };

  const removeOption = (index: number) => {
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
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
                <GitBranch className="h-8 w-8 text-blue-600" /> IVR Builder
              </h1>
              <p className="text-gray-500 mt-1">Design interactive voice menus for incoming calls</p>
            </div>
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Create Menu
            </button>
          </div>

          {/* Analytics Summary */}
          {analytics && analytics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              {analytics.map((a: any) => (
                <div key={a.menuId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <p className="text-sm font-medium text-gray-500 mb-1">{a.menuName}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{a.totalSessions}</span>
                    <span className="text-xs text-gray-500">sessions</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="text-green-600 font-medium">{a.completionRate.toFixed(0)}% completed</span>
                    <span>Avg {a.avgRetries.toFixed(1)} retries</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Menu */}
          {menus ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-blue-600" /> Active IVR Menu
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  menus.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {menus.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mb-4">
                <h4 className="text-xl font-bold text-gray-900">{menus.name}</h4>
                <p className="text-sm text-gray-600 mt-1 italic">&ldquo;{menus.entryPrompt}&rdquo;</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>Language: {menus.language?.toUpperCase()}</span>
                  <span>Timeout: {menus.timeout}s</span>
                  <span>Max Retries: {menus.maxRetries}</span>
                </div>
              </div>

              {/* Visual IVR Flow */}
              <div className="mt-6 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Menu Options</p>
                {Array.isArray(menus.options) && menus.options.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {menus.options.map((opt: IVROption, i: number) => {
                      const Icon = actionIcons[opt.action] || Hash;
                      return (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-700 rounded-lg font-bold text-lg">
                            {opt.key}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{opt.label || 'Unnamed'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Icon className="h-3 w-3" /> {actionLabels[opt.action]}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No options configured</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => openEditor(menus)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  onClick={() => deleteMutation.mutate(menus.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center mb-8">
              <GitBranch className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No IVR Menu Configured</h3>
              <p className="text-sm text-gray-500 mb-4">Create an IVR menu to route incoming calls through an interactive voice menu</p>
              <button
                onClick={() => openEditor()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 inline mr-1" /> Create Your First Menu
              </button>
            </div>
          )}

          {/* Editor Modal */}
          {showEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingMenu ? 'Edit IVR Menu' : 'Create IVR Menu'}
                  </h3>
                  <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Main Menu"
                    />
                  </div>

                  {/* Entry Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entry Prompt (spoken to caller)</label>
                    <textarea
                      value={form.entryPrompt}
                      onChange={(e) => setForm({ ...form, entryPrompt: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Welcome to our service. Press 1 for sales, Press 2 for support..."
                    />
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                      <select
                        value={form.language}
                        onChange={(e) => setForm({ ...form, language: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (sec)</label>
                      <input
                        type="number"
                        value={form.timeout}
                        onChange={(e) => setForm({ ...form, timeout: parseInt(e.target.value) })}
                        min={1} max={30}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                      <input
                        type="number"
                        value={form.maxRetries}
                        onChange={(e) => setForm({ ...form, maxRetries: parseInt(e.target.value) })}
                        min={1} max={10}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Menu Options</label>
                      <button
                        onClick={addOption}
                        disabled={form.options.length >= 9}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add Option
                      </button>
                    </div>

                    <div className="space-y-3">
                      {form.options.map((opt, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded font-bold text-sm shrink-0">
                            {opt.key}
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => updateOption(i, 'label', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                              placeholder="Label"
                            />
                            <select
                              value={opt.action}
                              onChange={(e) => updateOption(i, 'action', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            >
                              {Object.entries(actionLabels).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={opt.target}
                              onChange={(e) => updateOption(i, 'target', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                              placeholder="Target ID"
                            />
                          </div>
                          <button
                            onClick={() => removeOption(i)}
                            className="p-1.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {form.options.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-4">
                          No options yet. Click &ldquo;Add Option&rdquo; to start building your menu.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                  <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
                    Cancel
                  </button>
                  <button
                    onClick={() => saveMutation.mutate(form)}
                    disabled={saveMutation.isPending || !form.name || !form.entryPrompt}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? 'Saving...' : editingMenu ? 'Update Menu' : 'Create Menu'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
