'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { Plus, Code, Edit, Trash2, CheckCircle, X, Save, TestTube2 } from 'lucide-react';

interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ToolForm {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  apiKey: string;
  headers: Record<string, string>;
  parameters: ToolParam[];
  active: boolean;
}

const defaultForm: ToolForm = {
  name: '',
  description: '',
  endpoint: '',
  method: 'POST',
  apiKey: '',
  headers: {},
  parameters: [{ name: '', type: 'string', description: '', required: true }],
  active: true,
};

export default function ToolsPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [form, setForm] = useState<ToolForm>(defaultForm);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (selectedTool) {
      setForm({
        name: selectedTool.name || '',
        description: selectedTool.description || '',
        endpoint: selectedTool.endpoint || '',
        method: selectedTool.method || 'POST',
        apiKey: selectedTool.apiKey || '',
        headers: selectedTool.headers || {},
        parameters: selectedTool.parameters?.length
          ? selectedTool.parameters
          : [{ name: '', type: 'string', description: '', required: true }],
        active: selectedTool.active ?? true,
      });
    } else {
      setForm(defaultForm);
    }
    setTestResult(null);
  }, [selectedTool]);

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools', user.companyId],
    queryFn: async () => {
      const response = await api.get('/admin/tool', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tool/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: ToolForm) => {
      return api.post('/admin/tool', {
        ...data,
        companyId: user.companyId,
        parameters: data.parameters.filter(p => p.name.trim() !== ''),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      setShowModal(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ToolForm) => {
      return api.put(`/admin/tool/${selectedTool.id}`, {
        ...data,
        parameters: data.parameters.filter(p => p.name.trim() !== ''),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      setShowModal(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTool) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const addParameter = () => {
    setForm(prev => ({
      ...prev,
      parameters: [...prev.parameters, { name: '', type: 'string', description: '', required: false }]
    }));
  };

  const removeParameter = (index: number) => {
    setForm(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index)
    }));
  };

  const addHeader = () => {
    if (headerKey.trim()) {
      setForm(prev => ({
        ...prev,
        headers: { ...prev.headers, [headerKey]: headerValue }
      }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    setForm(prev => {
      const h = { ...prev.headers };
      delete h[key];
      return { ...prev, headers: h };
    });
  };

  const handleTestTool = async () => {
    try {
      setTestResult({ status: 'testing' });
      const response = await api.post('/tools/test', {
        endpoint: form.endpoint,
        method: form.method,
        headers: form.headers,
        apiKey: form.apiKey
      });
      setTestResult({ status: 'success', data: response.data });
    } catch (error: any) {
      setTestResult({ status: 'error', message: error.message || 'Connection failed' });
    }
  };

  const getMethodBadge = (method: string) => {
    const colors = {
      GET: 'bg-blue-100 text-blue-800',
      POST: 'bg-green-100 text-green-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800'
    };
    return colors[method as keyof typeof colors] || colors.GET;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tools Management</h1>
            <p className="text-gray-600 mt-1">Configure external API integrations for your AI agents</p>
          </div>
          <button
            onClick={() => {
              setSelectedTool(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Add Tool
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : tools?.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Code className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No tools configured yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Your First Tool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tools?.map((tool: any) => (
              <div key={tool.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Code className="h-6 w-6 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{tool.description}</p>
                    </div>
                    {tool.active && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>

                  {/* API Details */}
                  <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-mono font-semibold rounded ${getMethodBadge(tool.method)}`}>
                        {tool.method}
                      </span>
                      <code className="text-sm text-gray-700 break-all">{tool.endpoint}</code>
                    </div>
                    {tool.authentication && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Auth:</span> {tool.authentication.type}
                      </p>
                    )}
                  </div>

                  {/* Parameters */}
                  {tool.parameters && tool.parameters.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Parameters:</p>
                      <div className="flex flex-wrap gap-2">
                        {tool.parameters.map((param: any, index: number) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200"
                          >
                            {param.name}
                            {param.required && <span className="text-red-600">*</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => {
                        setSelectedTool(tool);
                        setShowModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this tool?')) {
                          deleteMutation.mutate(tool.id);
                        }
                      }}
                      className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded text-sm hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tool Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTool ? 'Edit Tool' : 'Add New Tool'}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="p-6 overflow-y-auto max-h-[65vh] space-y-5">
                    {/* Tool Name & Description */}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., getPatientInfo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <textarea
                          required
                          rows={2}
                          value={form.description}
                          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="What does this tool do? The AI uses this to decide when to call it."
                        />
                      </div>
                    </div>

                    {/* Endpoint & Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint *</label>
                      <div className="flex gap-2">
                        <select
                          value={form.method}
                          onChange={(e) => setForm(prev => ({ ...prev, method: e.target.value }))}
                          className="px-3 py-2 border rounded-lg font-mono text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                        <input
                          type="url"
                          required
                          value={form.endpoint}
                          onChange={(e) => setForm(prev => ({ ...prev, endpoint: e.target.value }))}
                          className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="https://api.example.com/endpoint"
                        />
                        <button
                          type="button"
                          onClick={handleTestTool}
                          className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                        >
                          <TestTube2 className="h-4 w-4" />
                          Test
                        </button>
                      </div>
                      {testResult && (
                        <div className={`mt-2 p-2 rounded text-xs ${
                          testResult.status === 'success' ? 'bg-green-50 text-green-700' :
                          testResult.status === 'error' ? 'bg-red-50 text-red-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {testResult.status === 'testing' ? 'Testing connection...' :
                           testResult.status === 'success' ? '✓ Connection successful' :
                           `✗ ${testResult.message}`}
                        </div>
                      )}
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Key (optional)</label>
                      <input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Bearer token or API key"
                      />
                    </div>

                    {/* Custom Headers */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Headers</label>
                      {Object.entries(form.headers).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{key}</span>
                          <span className="text-gray-400">:</span>
                          <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono flex-1 truncate">{value}</span>
                          <button type="button" onClick={() => removeHeader(key)} className="text-red-400 hover:text-red-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={headerKey}
                          onChange={(e) => setHeaderKey(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                          placeholder="Header name"
                        />
                        <input
                          type="text"
                          value={headerValue}
                          onChange={(e) => setHeaderValue(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                          placeholder="Header value"
                        />
                        <button type="button" onClick={addHeader} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Parameters */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Parameters</label>
                        <button type="button" onClick={addParameter} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                          <Plus className="h-4 w-4" /> Add Parameter
                        </button>
                      </div>
                      <div className="space-y-2">
                        {form.parameters.map((param, index) => (
                          <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={param.name}
                                onChange={(e) => {
                                  const updated = [...form.parameters];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setForm(prev => ({ ...prev, parameters: updated }));
                                }}
                                className="w-full px-2 py-1.5 border rounded text-sm mb-1"
                                placeholder="Parameter name"
                              />
                              <input
                                type="text"
                                value={param.description}
                                onChange={(e) => {
                                  const updated = [...form.parameters];
                                  updated[index] = { ...updated[index], description: e.target.value };
                                  setForm(prev => ({ ...prev, parameters: updated }));
                                }}
                                className="w-full px-2 py-1.5 border rounded text-sm"
                                placeholder="Description"
                              />
                            </div>
                            <select
                              value={param.type}
                              onChange={(e) => {
                                const updated = [...form.parameters];
                                updated[index] = { ...updated[index], type: e.target.value };
                                setForm(prev => ({ ...prev, parameters: updated }));
                              }}
                              className="px-2 py-1.5 border rounded text-sm"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="object">Object</option>
                              <option value="array">Array</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs whitespace-nowrap mt-2">
                              <input
                                type="checkbox"
                                checked={param.required}
                                onChange={(e) => {
                                  const updated = [...form.parameters];
                                  updated[index] = { ...updated[index], required: e.target.checked };
                                  setForm(prev => ({ ...prev, parameters: updated }));
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                              />
                              Required
                            </label>
                            {form.parameters.length > 1 && (
                              <button type="button" onClick={() => removeParameter(index)} className="text-red-400 hover:text-red-600 mt-2">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Toggle */}
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
                      <span className="text-sm font-medium text-gray-700">Tool Active</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
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
                        : selectedTool ? 'Update Tool' : 'Create Tool'}
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
