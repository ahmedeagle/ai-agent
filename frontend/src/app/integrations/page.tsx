'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Save,
  Phone,
  Mail,
  MessageCircle,
  Brain,
  Webhook,
  Calendar,
  Database,
  CheckCircle,
  XCircle,
  ExternalLink,
  Shield,
  Copy,
  RefreshCw,
  AlertTriangle,
  Zap,
  LinkIcon,
  Globe,
  Send,
  Key,
  Server
} from 'lucide-react';

type IntegrationCategory = 'communication' | 'ai' | 'crm' | 'calendar' | 'webhooks' | 'api';

interface IntegrationStatus {
  connected: boolean;
  lastTested?: string;
}

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>('communication');
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company', user.companyId],
    queryFn: async () => {
      const response = await api.get(`/admin/company/${user.companyId}`);
      return response.data.data;
    },
    enabled: !!user.companyId
  });

  const { data: webhooksData } = useQuery({
    queryKey: ['webhooks', user.companyId],
    queryFn: async () => {
      const response = await api.get(`/admin/company/${user.companyId}/webhooks`);
      return response.data.data || [];
    },
    enabled: !!user.companyId
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data: any) => api.put(`/admin/company/${user.companyId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const testIntegration = async (type: string) => {
    setTestingIntegration(type);
    try {
      const response = await api.post(`/admin/company/${user.companyId}/test-integration`, { type });
      setTestResults(prev => ({
        ...prev,
        [type]: { success: true, message: response.data.message || 'Connection successful!' }
      }));
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [type]: { success: false, message: error.response?.data?.error || 'Connection failed' }
      }));
    }
    setTestingIntegration(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const categories = [
    { id: 'communication' as IntegrationCategory, name: 'Communication', icon: Phone, count: 3 },
    { id: 'ai' as IntegrationCategory, name: 'AI Services', icon: Brain, count: 3 },
    { id: 'crm' as IntegrationCategory, name: 'CRM', icon: Database, count: 4 },
    { id: 'calendar' as IntegrationCategory, name: 'Calendar', icon: Calendar, count: 2 },
    { id: 'webhooks' as IntegrationCategory, name: 'Webhooks', icon: Webhook, count: 0 },
    { id: 'api' as IntegrationCategory, name: 'API Keys', icon: Key, count: 0 },
  ];

  const isConnected = (fields: string[]) => {
    return fields.some(f => companyData?.[f]);
  };

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
      connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    }`}>
      {connected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {connected ? 'Connected' : 'Not Configured'}
    </span>
  );

  const TestButton = ({ integration }: { integration: string }) => {
    const result = testResults[integration];
    return (
      <div className="flex items-center gap-2">
        {result && (
          <span className={`text-xs ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.message}
          </span>
        )}
        <button
          onClick={() => testIntegration(integration)}
          disabled={testingIntegration === integration}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
        >
          {testingIntegration === integration ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          Test Connection
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
            <p className="text-gray-600 mt-1">
              Connect your services and tools to power your AI call center
            </p>
          </div>

          {/* Integration Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Voice & SMS</p>
                  <p className="font-semibold text-gray-900">
                    {isConnected(['twilioAccountSid']) ? 'Active' : 'Setup Required'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">WhatsApp</p>
                  <p className="font-semibold text-gray-900">
                    {isConnected(['whatsappToken']) ? 'Active' : 'Setup Required'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-900">
                    {isConnected(['smtpHost']) ? 'Active' : 'Setup Required'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Brain className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">AI Services</p>
                  <p className="font-semibold text-gray-900">
                    {isConnected(['openaiApiKey']) ? 'Custom' : 'System Default'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Sidebar Categories */}
            <div className="w-56 shrink-0">
              <div className="bg-white rounded-lg shadow">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                        activeCategory === cat.id
                          ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 space-y-6">

              {/* ==================== COMMUNICATION ==================== */}
              {activeCategory === 'communication' && (
                <>
                  {/* Twilio - Voice & SMS */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <Phone className="h-6 w-6 text-red-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Twilio</h3>
                            <p className="text-sm text-gray-600">Voice calls, SMS, and phone number management</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge connected={isConnected(['twilioAccountSid'])} />
                          <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            Console <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          twilioAccountSid: formData.get('twilioAccountSid'),
                          twilioAuthToken: formData.get('twilioAuthToken'),
                          twilioPhoneNumber: formData.get('twilioPhoneNumber'),
                        });
                      }}
                      className="p-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                          <input
                            type="text"
                            name="twilioAccountSid"
                            defaultValue={companyData?.twilioAccountSid || ''}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                          <input
                            type="password"
                            name="twilioAuthToken"
                            defaultValue={companyData?.twilioAuthToken || ''}
                            placeholder="Your Twilio Auth Token"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                          <input
                            type="text"
                            name="twilioPhoneNumber"
                            defaultValue={companyData?.twilioPhoneNumber || ''}
                            placeholder="+1234567890"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="twilio" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>

                      {/* Twilio Features */}
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-gray-500 mb-2">ENABLED FEATURES</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Inbound Calls</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Outbound Calls</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">SMS</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Recording</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">IVR System</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Transfer</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Queuing</span>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* WhatsApp */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <MessageCircle className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">WhatsApp Business API</h3>
                            <p className="text-sm text-gray-600">AI-powered WhatsApp messaging for customer support</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge connected={isConnected(['whatsappToken'])} />
                          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            Meta Console <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          whatsappPhoneId: formData.get('whatsappPhoneId'),
                          whatsappToken: formData.get('whatsappToken'),
                          whatsappNumber: formData.get('whatsappNumber'),
                        });
                      }}
                      className="p-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                          <input
                            type="text"
                            name="whatsappPhoneId"
                            defaultValue={companyData?.whatsappPhoneId || ''}
                            placeholder="Your WhatsApp Phone Number ID"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                          <input
                            type="password"
                            name="whatsappToken"
                            defaultValue={companyData?.whatsappToken || ''}
                            placeholder="Your WhatsApp Business API Token"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone Number</label>
                          <input
                            type="text"
                            name="whatsappNumber"
                            defaultValue={companyData?.whatsappNumber || ''}
                            placeholder="+1234567890"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      {/* Webhook URL for WhatsApp */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-900 mb-1">Webhook URL (paste in Meta Developer Console)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-white px-2 py-1 rounded border flex-1 text-blue-800">
                            {`${process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com'}/whatsapp/webhook`}
                          </code>
                          <button type="button" onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com'}/whatsapp/webhook`)}
                            className="p-1 text-blue-600 hover:text-blue-800">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="whatsapp" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-gray-500 mb-2">ENABLED FEATURES</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">AI Chat Responses</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Template Messages</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Media Support</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Read Receipts</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Typing Indicators</span>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Email / SMTP */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Mail className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Email / SMTP</h3>
                            <p className="text-sm text-gray-600">Send emails to customers (summaries, notifications, follow-ups)</p>
                          </div>
                        </div>
                        <StatusBadge connected={isConnected(['smtpHost'])} />
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          emailFrom: formData.get('emailFrom'),
                          smtpHost: formData.get('smtpHost'),
                          smtpPort: parseInt(formData.get('smtpPort') as string) || 587,
                          smtpUser: formData.get('smtpUser'),
                          smtpPassword: formData.get('smtpPassword'),
                          smtpSecure: formData.get('smtpSecure') === 'on',
                        });
                      }}
                      className="p-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">From Email Address</label>
                          <input
                            type="email"
                            name="emailFrom"
                            defaultValue={companyData?.emailFrom || ''}
                            placeholder="noreply@yourcompany.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                          <input
                            type="text"
                            name="smtpHost"
                            defaultValue={companyData?.smtpHost || ''}
                            placeholder="smtp.gmail.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                            <input
                              type="number"
                              name="smtpPort"
                              defaultValue={companyData?.smtpPort || 587}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="smtpSecure"
                                defaultChecked={companyData?.smtpSecure || false}
                                className="h-4 w-4 text-blue-600 rounded"
                              />
                              SSL/TLS
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                          <input
                            type="text"
                            name="smtpUser"
                            defaultValue={companyData?.smtpUser || ''}
                            placeholder="your-email@gmail.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                          <input
                            type="password"
                            name="smtpPassword"
                            placeholder="••••••••••••"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      {/* Provider Quick Setup */}
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-600 mb-2">QUICK SETUP GUIDES</p>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => {
                            const form = document.querySelector('form:last-of-type') as HTMLFormElement;
                            if (form) {
                              (form.querySelector('[name="smtpHost"]') as HTMLInputElement).value = 'smtp.gmail.com';
                              (form.querySelector('[name="smtpPort"]') as HTMLInputElement).value = '587';
                            }
                          }} className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50">
                            Gmail
                          </button>
                          <button type="button" onClick={() => {
                            const form = document.querySelector('form:last-of-type') as HTMLFormElement;
                            if (form) {
                              (form.querySelector('[name="smtpHost"]') as HTMLInputElement).value = 'smtp.sendgrid.net';
                              (form.querySelector('[name="smtpPort"]') as HTMLInputElement).value = '587';
                            }
                          }} className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50">
                            SendGrid
                          </button>
                          <button type="button" onClick={() => {
                            const form = document.querySelector('form:last-of-type') as HTMLFormElement;
                            if (form) {
                              (form.querySelector('[name="smtpHost"]') as HTMLInputElement).value = 'smtp.mailgun.org';
                              (form.querySelector('[name="smtpPort"]') as HTMLInputElement).value = '587';
                            }
                          }} className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50">
                            Mailgun
                          </button>
                          <button type="button" onClick={() => {
                            const form = document.querySelector('form:last-of-type') as HTMLFormElement;
                            if (form) {
                              (form.querySelector('[name="smtpHost"]') as HTMLInputElement).value = 'email-smtp.us-east-1.amazonaws.com';
                              (form.querySelector('[name="smtpPort"]') as HTMLInputElement).value = '587';
                            }
                          }} className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50">
                            AWS SES
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="email" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-medium text-gray-500 mb-2">ENABLED FEATURES</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Summaries</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Appointment Confirmations</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Follow-up Emails</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Survey Links</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Notification Alerts</span>
                        </div>
                      </div>
                    </form>
                  </div>
                </>
              )}

              {/* ==================== AI SERVICES ==================== */}
              {activeCategory === 'ai' && (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Optional Configuration</h4>
                        <p className="text-sm text-yellow-800 mt-1">
                          AI services use system-wide credentials by default. Only add your own keys if you want dedicated rate limits, custom billing, or to use a different model provider.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* OpenAI */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Brain className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">OpenAI</h3>
                            <p className="text-sm text-gray-600">Large Language Model for AI agent conversations</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                          companyData?.openaiApiKey ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {companyData?.openaiApiKey ? 'Custom Key' : 'Using System Default'}
                        </span>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          openaiApiKey: formData.get('openaiApiKey') || null,
                        });
                      }}
                      className="p-6"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input
                          type="password"
                          name="openaiApiKey"
                          defaultValue={companyData?.openaiApiKey || ''}
                          placeholder="sk-••••••••••••••••••••••••"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty to use system default. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-600 hover:underline">OpenAI Dashboard</a></p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="openai" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Deepgram */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                            <Server className="h-6 w-6 text-sky-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Deepgram</h3>
                            <p className="text-sm text-gray-600">Speech-to-Text for real-time call transcription</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                          companyData?.deepgramApiKey ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {companyData?.deepgramApiKey ? 'Custom Key' : 'Using System Default'}
                        </span>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          deepgramApiKey: formData.get('deepgramApiKey') || null,
                        });
                      }}
                      className="p-6"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input
                          type="password"
                          name="deepgramApiKey"
                          defaultValue={companyData?.deepgramApiKey || ''}
                          placeholder="Your Deepgram API Key"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty to use system default. Get your key from <a href="https://console.deepgram.com" target="_blank" className="text-blue-600 hover:underline">Deepgram Console</a></p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="deepgram" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* ElevenLabs */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                            <Globe className="h-6 w-6 text-violet-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">ElevenLabs</h3>
                            <p className="text-sm text-gray-600">Text-to-Speech for AI agent voice responses</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                          companyData?.elevenLabsApiKey ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {companyData?.elevenLabsApiKey ? 'Custom Key' : 'Using System Default'}
                        </span>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateCompanyMutation.mutate({
                          elevenLabsApiKey: formData.get('elevenLabsApiKey') || null,
                        });
                      }}
                      className="p-6"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input
                          type="password"
                          name="elevenLabsApiKey"
                          defaultValue={companyData?.elevenLabsApiKey || ''}
                          placeholder="Your ElevenLabs API Key"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty to use system default. Get your key from <a href="https://elevenlabs.io" target="_blank" className="text-blue-600 hover:underline">ElevenLabs Dashboard</a></p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <TestButton integration="elevenlabs" />
                        <button type="submit" disabled={updateCompanyMutation.isPending}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                          <Save className="h-4 w-4" /> Save
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}

              {/* ==================== CRM ==================== */}
              {activeCategory === 'crm' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <LinkIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">CRM Integrations</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          Connect your CRM to automatically sync customer data, log calls, create contacts, and update deals after every conversation.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Salesforce */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl font-bold text-blue-600">
                            SF
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Salesforce</h3>
                            <p className="text-sm text-gray-600">Sync contacts, log calls, update deals automatically</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Instance URL</label>
                          <input type="text" placeholder="https://your-org.salesforce.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                          <input type="password" placeholder="Your Salesforce API Token"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Contact Sync</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Logging</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Lead Creation</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Deal Updates</span>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Connect Salesforce
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* HubSpot */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-xl font-bold text-orange-600">
                            HS
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">HubSpot</h3>
                            <p className="text-sm text-gray-600">CRM, contacts, tickets, and deal management</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Private App Token</label>
                          <input type="password" placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Contact Sync</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Ticket Creation</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Call Logging</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Pipeline Management</span>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Connect HubSpot
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Zoho CRM */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-xl font-bold text-red-600">
                            Z
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Zoho CRM</h3>
                            <p className="text-sm text-gray-600">Complete CRM integration with Zoho suite</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                          <input type="text" placeholder="Your Zoho Client ID"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                          <input type="password" placeholder="Your Zoho Client Secret"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Connect Zoho
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom CRM / API */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Database className="h-6 w-6 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Custom CRM / REST API</h3>
                            <p className="text-sm text-gray-600">Connect any CRM using REST API endpoints</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CRM API Base URL</label>
                          <input type="url" placeholder="https://api.yourcrm.com/v1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Key Header</label>
                            <input type="text" placeholder="X-API-Key" defaultValue="Authorization"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Key Value</label>
                            <input type="password" placeholder="Bearer your-api-key"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium text-gray-600 mb-2">ENDPOINT MAPPING</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="w-32 text-gray-600">Create Contact:</span>
                              <input type="text" placeholder="POST /contacts" className="flex-1 px-2 py-1 border rounded text-xs" />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-32 text-gray-600">Log Call:</span>
                              <input type="text" placeholder="POST /activities" className="flex-1 px-2 py-1 border rounded text-xs" />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="w-32 text-gray-600">Search Contact:</span>
                              <input type="text" placeholder="GET /contacts/search" className="flex-1 px-2 py-1 border rounded text-xs" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Save Custom CRM
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ==================== CALENDAR ==================== */}
              {activeCategory === 'calendar' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <Calendar className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Calendar Integrations</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          Let your AI agents schedule appointments, check availability, and send calendar invites during calls.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Google Calendar */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                            📅
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Google Calendar</h3>
                            <p className="text-sm text-gray-600">Check availability & create appointments via Google Calendar</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Service Account JSON Key</label>
                          <textarea rows={3} placeholder='Paste your Google service account JSON key here'
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Calendar ID</label>
                          <input type="email" placeholder="your-calendar@group.calendar.google.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Check Availability</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Create Events</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Send Invites</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Reschedule</span>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Connect Google Calendar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Calendly */}
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                            🗓
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Calendly</h3>
                            <p className="text-sm text-gray-600">Schedule meetings using Calendly booking links</p>
                          </div>
                        </div>
                        <StatusBadge connected={false} />
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
                          <input type="password" placeholder="Your Calendly API Token"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Default Event Type URL</label>
                          <input type="url" placeholder="https://calendly.com/your-name/30-min"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Save className="h-4 w-4" /> Connect Calendly
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ==================== WEBHOOKS ==================== */}
              {activeCategory === 'webhooks' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <Webhook className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Webhooks</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          Send real-time notifications to your systems when events happen (calls, messages, escalations).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Add New Webhook */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold text-lg mb-4">Add Webhook Endpoint</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://your-server.com/webhook"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Events to Subscribe</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            'call.started', 'call.completed', 'call.failed',
                            'call.escalated', 'call.transferred', 'call.recorded',
                            'sms.received', 'sms.sent',
                            'whatsapp.received', 'whatsapp.sent',
                            'email.sent', 'email.bounced',
                            'customer.created', 'survey.completed',
                            'agent.error'
                          ].map((event) => (
                            <label key={event} className="flex items-center gap-2 text-sm p-2 border rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={webhookEvents.includes(event)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setWebhookEvents([...webhookEvents, event]);
                                  } else {
                                    setWebhookEvents(webhookEvents.filter(ev => ev !== event));
                                  }
                                }}
                                className="h-3.5 w-3.5 text-blue-600 rounded"
                              />
                              <span className="text-gray-700 text-xs font-mono">{event}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end pt-4 border-t">
                        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                          <Zap className="h-4 w-4" /> Create Webhook
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Webhook Payload Example */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold text-lg mb-4">Example Payload</h3>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "event": "call.completed",
  "timestamp": "2026-03-07T14:30:00Z",
  "data": {
    "callId": "call_abc123",
    "from": "+1234567890",
    "to": "+0987654321",
    "direction": "inbound",
    "duration": 245,
    "status": "completed",
    "agentId": "agent_xyz",
    "agentName": "Sales Assistant",
    "transcript": "...",
    "sentiment": "positive",
    "escalated": false
  }
}`}
                    </pre>
                  </div>
                </>
              )}

              {/* ==================== API KEYS ==================== */}
              {activeCategory === 'api' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                      <Key className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Your API Keys</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          Use these keys to access the AI Call Center API programmatically. Trigger calls, send messages, and access data from your own applications.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company API Key */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">API Access</h3>
                      <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100">
                        <RefreshCw className="h-3 w-3" /> Regenerate Key
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company API Key</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={companyData?.apiKey || 'No API key generated yet'}
                            readOnly
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono"
                          />
                          <button onClick={() => copyToClipboard(companyData?.apiKey || '')}
                            className="p-2 text-gray-600 hover:text-gray-800 border rounded">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company ID</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={user.companyId || ''}
                            readOnly
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono"
                          />
                          <button onClick={() => copyToClipboard(user.companyId || '')}
                            className="p-2 text-gray-600 hover:text-gray-800 border rounded">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com'}
                            readOnly
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono"
                          />
                          <button onClick={() => copyToClipboard(process.env.NEXT_PUBLIC_API_URL || '')}
                            className="p-2 text-gray-600 hover:text-gray-800 border rounded">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* API Usage Examples */}
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-medium text-gray-900 mb-3">Quick Start Examples</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Trigger an Outbound Call:</p>
                          <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com'}/voice/call \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+1234567890", "agentId": "agent_id"}'`}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Send SMS:</p>
                          <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'https://api.yourdomain.com'}/sms/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+1234567890", "body": "Hello!"}'`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rate Limits */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold text-lg mb-4">Rate Limits</h3>
                    <div className="overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-gray-600">Endpoint</th>
                            <th className="text-left py-2 font-medium text-gray-600">Limit</th>
                            <th className="text-left py-2 font-medium text-gray-600">Window</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="py-2 font-mono text-xs">POST /voice/call</td><td className="py-2">100</td><td className="py-2">per minute</td></tr>
                          <tr><td className="py-2 font-mono text-xs">POST /sms/send</td><td className="py-2">200</td><td className="py-2">per minute</td></tr>
                          <tr><td className="py-2 font-mono text-xs">POST /whatsapp/send</td><td className="py-2">200</td><td className="py-2">per minute</td></tr>
                          <tr><td className="py-2 font-mono text-xs">POST /email/send</td><td className="py-2">500</td><td className="py-2">per hour</td></tr>
                          <tr><td className="py-2 font-mono text-xs">GET /analytics/*</td><td className="py-2">1000</td><td className="py-2">per hour</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>All credentials are encrypted at rest using AES-256 encryption. We never share your keys with third parties.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
