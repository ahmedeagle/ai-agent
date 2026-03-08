'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Webhook, Save, Eye, EyeOff, RefreshCw, Check, AlertTriangle, Copy,
  Key, Globe, Shield
} from 'lucide-react';

const ALL_EVENTS = [
  { key: 'call.completed', label: 'Call Completed', desc: 'Fires when any call finishes' },
  { key: 'call.failed', label: 'Call Failed', desc: 'Fires when a call fails or errors' },
  { key: 'call.started', label: 'Call Started', desc: 'Fires when a new call begins' },
  { key: 'escalation', label: 'Escalation', desc: 'Fires when AI escalates to a human agent' },
  { key: 'sms.received', label: 'SMS Received', desc: 'Fires on incoming SMS messages' },
  { key: 'sms.sent', label: 'SMS Sent', desc: 'Fires when an SMS is sent' },
  { key: 'whatsapp.received', label: 'WhatsApp Received', desc: 'Fires on incoming WhatsApp messages' },
  { key: 'voicemail.new', label: 'New Voicemail', desc: 'Fires when a voicemail is recorded' },
  { key: 'lead.created', label: 'Lead Created', desc: 'Fires when a new lead is created' },
  { key: 'lead.stage_changed', label: 'Lead Stage Changed', desc: 'Fires when a lead moves pipeline stages' },
  { key: 'survey.response', label: 'Survey Response', desc: 'Fires when a survey response is submitted' },
  { key: 'callback.scheduled', label: 'Callback Scheduled', desc: 'Fires when a callback is scheduled' },
  { key: 'dnc.added', label: 'DNC Added', desc: 'Fires when a number is added to DNC list' },
];

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  const { data: companyRes } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => (await api.get(`/admin/company/${companyId}`)).data,
    enabled: !!companyId,
  });

  // Sync form state from server
  useEffect(() => {
    if (companyRes?.data) {
      setUrl(companyRes.data.webhookUrl || '');
      setSecret(companyRes.data.webhookSecret || '');
      setEvents(companyRes.data.webhookEvents || []);
    }
  }, [companyRes]);

  const saveMut = useMutation({
    mutationFn: async () => {
      setSaving(true);
      return (await api.put(`/admin/company/${companyId}`, {
        webhookUrl: url || null,
        webhookSecret: secret || null,
        webhookEvents: events,
      })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      setSaved(true); setSaving(false);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setSaving(false),
  });

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setSecret(result);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleEvent = (key: string) => {
    setEvents(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]);
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Webhook className="h-8 w-8 text-violet-600" /> Webhooks
              </h1>
              <p className="text-gray-500 mt-1">Receive real-time HTTP POST notifications for platform events</p>
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 shadow-sm disabled:opacity-50">
              {saved ? <Check className="h-4 w-4" /> : saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          {/* Endpoint URL */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Endpoint URL</h2>
            </div>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks/aicallcenter"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-2">
              We&apos;ll send HTTP POST requests with JSON payload to this URL when events occur.
            </p>
          </div>

          {/* Signing Secret */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Signing Secret</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={copySecret} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button onClick={generateSecret}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                Generate
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Used to verify webhook signatures. We include a <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature</code> header with each request.
            </p>
          </div>

          {/* Events */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Events</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEvents(ALL_EVENTS.map(e => e.key))}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setEvents([])}
                  className="text-xs text-gray-500 hover:text-gray-700">Clear All</button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Choose which events trigger webhook notifications. ({events.length} selected)</p>

            <div className="space-y-1">
              {ALL_EVENTS.map(evt => (
                <label key={evt.key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition ${
                    events.includes(evt.key) ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                  <input type="checkbox" checked={events.includes(evt.key)}
                    onChange={() => toggleEvent(evt.key)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{evt.label}</p>
                    <p className="text-xs text-gray-400">{evt.desc}</p>
                  </div>
                  <code className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">{evt.key}</code>
                </label>
              ))}
            </div>
          </div>

          {/* Payload Example */}
          <div className="mt-5 bg-gray-900 rounded-2xl p-5 text-green-400 text-xs font-mono overflow-x-auto">
            <p className="text-gray-500 mb-2">// Example webhook payload</p>
            <pre>{`{
  "event": "call.completed",
  "timestamp": "${new Date().toISOString()}",
  "data": {
    "callId": "call_abc123",
    "companyId": "${companyId || 'cmp_xxx'}",
    "duration": 145,
    "direction": "inbound",
    "status": "completed",
    "from": "+1234567890",
    "to": "+0987654321"
  }
}`}</pre>
          </div>
        </div>
      </main>
    </div>
  );
}
