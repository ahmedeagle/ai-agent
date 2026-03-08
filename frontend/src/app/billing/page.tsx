'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  CreditCard, TrendingUp, Clock, AlertCircle, Users, Phone,
  MessageSquare, Zap, Download, ChevronDown, ChevronUp,
  Shield, BarChart3, Headphones, ArrowUpRight, DollarSign,
  Activity, Package, FileText, Receipt, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────
interface ActivePackage {
  id: string;
  name: string;
  type: string;
  minutesIncluded: number;
  minutesUsed: number;
  minutesRemaining: number;
  pricePerMinute: number;
  concurrentAgentsIncluded: number;
  pricePerAgent: number;
  totalPrice: number;
  billingCycle: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface UsageSummary {
  totalCost: number;
  byType: {
    call_minutes: { count: number; quantity: number; cost: number };
    concurrent_agent: { count: number; quantity: number; cost: number };
    sms: { count: number; cost: number };
    whatsapp: { count: number; cost: number };
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  tax: number;
  total: number;
  items: any;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  payments: any[];
}

interface ConcurrentStatus {
  canStart: boolean;
  currentConcurrent: number;
  maxConcurrent: number;
  remainingSlots: number;
  needsUpgrade: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const minutesToHours = (m: number) => (m / 60).toFixed(1);
const statusColor: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};
const statusIcon: Record<string, any> = {
  paid: CheckCircle2,
  pending: Clock,
  overdue: AlertTriangle,
  cancelled: XCircle,
};

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showAllInvoices, setShowAllInvoices] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // ─── Queries ──────────────────────────────────────────────────────
  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => (await api.get(`/admin/company/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  const { data: activePackage } = useQuery<ActivePackage>({
    queryKey: ['active-package', companyId],
    queryFn: async () => (await api.get(`/billing/packages/${companyId}/active`)).data.data,
    enabled: !!companyId,
  });

  const { data: allPackages } = useQuery<ActivePackage[]>({
    queryKey: ['all-packages', companyId],
    queryFn: async () => (await api.get(`/billing/packages/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  const { data: usageSummary } = useQuery<UsageSummary>({
    queryKey: ['usage-summary', companyId],
    queryFn: async () => (await api.get(`/billing/usage/${companyId}/summary`)).data.data,
    enabled: !!companyId,
  });

  const { data: concurrentStatus } = useQuery<ConcurrentStatus>({
    queryKey: ['concurrent-status', companyId],
    queryFn: async () =>
      (await api.post('/billing/concurrent-agents/check', { companyId })).data.data,
    enabled: !!companyId,
    refetchInterval: 15000,
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['invoices', companyId],
    queryFn: async () => (await api.get(`/billing/invoices/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  const { data: usageLogs } = useQuery({
    queryKey: ['usage-logs', companyId],
    queryFn: async () => (await api.get(`/billing/usage/${companyId}?limit=30`)).data.data,
    enabled: !!companyId,
  });

  // ─── Derived Values ──────────────────────────────────────────────
  const minutesUsed = companyData?.minutesUsed || 0;
  const minutesAllocated = companyData?.minutesAllocated || activePackage?.minutesIncluded || 1;
  const minutesRemaining = Math.max(minutesAllocated - minutesUsed, 0);
  const usagePercentage = Math.min((minutesUsed / minutesAllocated) * 100, 100);

  const concurrentCurrent = concurrentStatus?.currentConcurrent || companyData?.currentConcurrentAgents || 0;
  const concurrentMax = concurrentStatus?.maxConcurrent || companyData?.maxConcurrentAgents || 1;
  const concurrentPercentage = (concurrentCurrent / concurrentMax) * 100;

  const costPerMinute = activePackage
    ? activePackage.totalPrice / (activePackage.minutesIncluded || 1)
    : 0;

  const totalSpend = usageSummary?.totalCost || 0;
  const packageCost = activePackage?.totalPrice || 0;
  const overageCost = usageSummary?.byType?.call_minutes?.cost || 0;
  const agentCost = usageSummary?.byType?.concurrent_agent?.cost || 0;
  const smsCost = usageSummary?.byType?.sms?.cost || 0;
  const whatsappCost = usageSummary?.byType?.whatsapp?.cost || 0;

  // Build pie chart data
  const costBreakdown = [
    { name: 'Package', value: packageCost, color: '#3B82F6' },
    { name: 'Overage', value: overageCost, color: '#EF4444' },
    { name: 'Agents', value: agentCost, color: '#8B5CF6' },
    { name: 'SMS', value: smsCost, color: '#10B981' },
    { name: 'WhatsApp', value: whatsappCost, color: '#06B6D4' },
  ].filter((d) => d.value > 0);

  const minutesPie = [
    { name: 'Used', value: minutesUsed, color: '#3B82F6' },
    { name: 'Remaining', value: minutesRemaining, color: '#E5E7EB' },
  ];

  // Build area chart from usage logs (last 30 entries)
  const usageTimeline = (usageLogs || [])
    .filter((l: any) => l.type === 'call_minutes')
    .slice(0, 14)
    .reverse()
    .map((l: any) => ({
      date: new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      minutes: l.quantity,
      cost: l.cost,
    }));

  const visibleInvoices = showAllInvoices ? invoices : (invoices || []).slice(0, 5);

  if (!user) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
              <p className="text-gray-500 mt-1">Monitor costs, usage, and manage your subscription</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <Download className="h-4 w-4" /> Export Report
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                <ArrowUpRight className="h-4 w-4" /> Upgrade Plan
              </button>
            </div>
          </div>

          {/* Alerts */}
          {usagePercentage >= 80 && (
            <div className={`mb-6 px-5 py-4 rounded-xl flex items-start gap-3 ${
              usagePercentage >= 95
                ? 'bg-red-50 border border-red-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertCircle className={`h-5 w-5 mt-0.5 ${usagePercentage >= 95 ? 'text-red-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-sm font-semibold ${usagePercentage >= 95 ? 'text-red-800' : 'text-amber-800'}`}>
                  {usagePercentage >= 95 ? 'Critical: Minutes Almost Exhausted' : 'Warning: High Usage Detected'}
                </p>
                <p className={`text-sm mt-0.5 ${usagePercentage >= 95 ? 'text-red-700' : 'text-amber-700'}`}>
                  You&apos;ve used {usagePercentage.toFixed(0)}% of your allocated minutes.
                  {minutesRemaining > 0
                    ? ` Only ${fmt(minutesRemaining)} minutes (${minutesToHours(minutesRemaining)}h) remaining.`
                    : ' Your package is exhausted — overage charges may apply.'}
                </p>
              </div>
            </div>
          )}

          {concurrentStatus?.needsUpgrade && (
            <div className="mb-6 px-5 py-4 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3">
              <Users className="h-5 w-5 mt-0.5 text-purple-600" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Concurrent Agent Limit Reached</p>
                <p className="text-sm mt-0.5 text-purple-700">
                  All {concurrentMax} concurrent slots are in use. New calls will be queued until a slot opens.
                  Consider upgrading for more capacity.
                </p>
              </div>
            </div>
          )}

          {/* ─── Top Metrics Row ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* Current Monthly Spend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Monthly Spend</span>
                <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fmtCurrency(packageCost + totalSpend)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {fmtCurrency(packageCost)} base + {fmtCurrency(totalSpend)} usage
              </p>
            </div>

            {/* Cost Per Minute */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Cost Per Minute</span>
                <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="h-4 w-4 text-blue-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{fmtCurrency(costPerMinute)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Overage rate: {fmtCurrency(activePackage?.pricePerMinute || 0)}/min
              </p>
            </div>

            {/* Concurrent Agents */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Concurrent Agents</span>
                <div className="p-2 bg-purple-50 rounded-lg"><Users className="h-4 w-4 text-purple-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {concurrentCurrent}<span className="text-lg text-gray-400"> / {concurrentMax}</span>
              </p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    concurrentPercentage >= 90 ? 'bg-red-500' : concurrentPercentage >= 70 ? 'bg-amber-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(concurrentPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {concurrentStatus?.remainingSlots || 0} slots available
              </p>
            </div>

            {/* Total Calls This Period */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Calls This Period</span>
                <div className="p-2 bg-cyan-50 rounded-lg"><Phone className="h-4 w-4 text-cyan-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {fmt(usageSummary?.byType?.call_minutes?.count || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {fmt(Math.round(usageSummary?.byType?.call_minutes?.quantity || 0))} minutes total
              </p>
            </div>
          </div>

          {/* ─── Active Plan + Usage Donut ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Active Plan Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-2xl shadow-lg p-6 relative overflow-hidden">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white" />
                <div className="absolute -left-5 -bottom-5 w-24 h-24 rounded-full bg-white" />
              </div>

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-5 w-5 text-blue-200" />
                      <span className="text-blue-200 text-sm font-medium uppercase tracking-wide">Active Plan</span>
                    </div>
                    <h2 className="text-2xl font-bold">
                      {activePackage?.name || companyData?.subscriptionStatus || 'No Active Plan'}
                    </h2>
                    <p className="text-blue-200 mt-1">
                      {fmtCurrency(activePackage?.totalPrice || 0)}/{activePackage?.billingCycle || 'month'}
                      {activePackage?.expiresAt && (
                        <span className="ml-3 text-xs bg-blue-500/40 px-2 py-0.5 rounded-full">
                          Renews {new Date(activePackage.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-300" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-blue-300 text-xs mb-1">Minutes Used</p>
                    <p className="text-2xl font-bold">{fmt(minutesUsed)}</p>
                    <p className="text-blue-300 text-xs">{minutesToHours(minutesUsed)}h</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-xs mb-1">Minutes Left</p>
                    <p className="text-2xl font-bold">{fmt(minutesRemaining)}</p>
                    <p className="text-blue-300 text-xs">{minutesToHours(minutesRemaining)}h</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-xs mb-1">Included</p>
                    <p className="text-2xl font-bold">{fmt(activePackage?.minutesIncluded || minutesAllocated)}</p>
                    <p className="text-blue-300 text-xs">{minutesToHours(activePackage?.minutesIncluded || minutesAllocated)}h</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-xs mb-1">Agents Included</p>
                    <p className="text-2xl font-bold">{activePackage?.concurrentAgentsIncluded || concurrentMax}</p>
                    <p className="text-blue-300 text-xs">concurrent</p>
                  </div>
                </div>

                {/* Minutes Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-blue-200">Minutes Usage</span>
                    <span className="font-medium">{usagePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-900/50 rounded-full h-3">
                    <div
                      className={`rounded-full h-3 transition-all duration-500 ${
                        usagePercentage >= 90 ? 'bg-red-400' : usagePercentage >= 70 ? 'bg-amber-400' : 'bg-white'
                      }`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Minutes Donut */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 self-start">Minutes Distribution</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={minutesPie} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" strokeWidth={0}>
                    {minutesPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center -mt-2 mb-2">
                <p className="text-2xl font-bold text-gray-900">{usagePercentage.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">consumed</p>
              </div>
              <div className="flex gap-4">
                {minutesPie.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Cost Breakdown + Usage Timeline ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Cost Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" /> Cost Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Call Minutes', value: overageCost, icon: Phone, color: 'text-blue-600 bg-blue-50',
                    detail: `${fmt(Math.round(usageSummary?.byType?.call_minutes?.quantity || 0))} min` },
                  { label: 'Concurrent Agents', value: agentCost, icon: Users, color: 'text-purple-600 bg-purple-50',
                    detail: `${usageSummary?.byType?.concurrent_agent?.count || 0} upgrades` },
                  { label: 'SMS Messages', value: smsCost, icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50',
                    detail: `${usageSummary?.byType?.sms?.count || 0} sent` },
                  { label: 'WhatsApp', value: whatsappCost, icon: Zap, color: 'text-cyan-600 bg-cyan-50',
                    detail: `${usageSummary?.byType?.whatsapp?.count || 0} sent` },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${item.color}`}><Icon className="h-3.5 w-3.5" /></div>
                        <span className="text-xs font-medium text-gray-600">{item.label}</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{fmtCurrency(item.value)}</p>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                    </div>
                  );
                })}
              </div>

              {costBreakdown.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" strokeWidth={0}>
                      {costBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span className="text-xs text-gray-600">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Usage Timeline */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" /> Usage Timeline
              </h3>
              {usageTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={usageTimeline}>
                    <defs>
                      <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                      formatter={(v: number, name: string) =>
                        name === 'cost' ? fmtCurrency(v) : `${v} min`
                      }
                    />
                    <Area type="monotone" dataKey="minutes" stroke="#3B82F6" fill="url(#colorMinutes)" strokeWidth={2} name="Minutes" />
                    <Area type="monotone" dataKey="cost" stroke="#10B981" fill="none" strokeWidth={2} strokeDasharray="5 5" name="cost" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[320px] text-gray-400">
                  <Activity className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No usage data available yet</p>
                </div>
              )}
            </div>
          </div>

          {/* ─── Available Plans from API ─────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" /> Your Packages
            </h3>
            {allPackages && allPackages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allPackages.map((pkg) => {
                  const isActive = pkg.status === 'active';
                  const pkgUsage = pkg.minutesIncluded > 0
                    ? ((pkg.minutesUsed / pkg.minutesIncluded) * 100).toFixed(0)
                    : '0';
                  return (
                    <div
                      key={pkg.id}
                      className={`relative rounded-xl border-2 p-5 transition ${
                        isActive ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute -top-2.5 left-4 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      )}
                      <h4 className="text-lg font-bold text-gray-900 mt-1">{pkg.name}</h4>
                      <p className="text-2xl font-bold text-gray-900 mt-2">
                        {fmtCurrency(pkg.totalPrice)}
                        <span className="text-sm font-normal text-gray-500">/{pkg.billingCycle}</span>
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Minutes</span>
                          <span className="font-medium text-gray-900">
                            {fmt(pkg.minutesUsed)}/{fmt(pkg.minutesIncluded)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-400'}`}
                            style={{ width: `${Math.min(parseInt(pkgUsage), 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between">
                          <span>Concurrent Agents</span>
                          <span className="font-medium text-gray-900">{pkg.concurrentAgentsIncluded}</span>
                        </div>
                        {pkg.pricePerMinute > 0 && (
                          <div className="flex justify-between">
                            <span>Overage Rate</span>
                            <span className="font-medium text-gray-900">{fmtCurrency(pkg.pricePerMinute)}/min</span>
                          </div>
                        )}
                        {pkg.pricePerAgent > 0 && (
                          <div className="flex justify-between">
                            <span>Extra Agent</span>
                            <span className="font-medium text-gray-900">{fmtCurrency(pkg.pricePerAgent)}/agent</span>
                          </div>
                        )}
                      </div>

                      {pkg.expiresAt && (
                        <p className="text-xs text-gray-400 mt-3">
                          Expires {new Date(pkg.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No packages found. Contact sales to get started.</p>
              </div>
            )}
          </div>

          {/* ─── Invoice History ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" /> Invoices
              </h3>
              <span className="text-xs font-medium text-gray-400">{(invoices || []).length} total</span>
            </div>

            {invoices && invoices.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tax</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Paid At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(visibleInvoices || []).map((inv) => {
                        const StatusIcon = statusIcon[inv.status] || FileText;
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 text-right">{fmtCurrency(inv.subtotal)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtCurrency(inv.tax)}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{fmtCurrency(inv.total)}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${statusColor[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                                <StatusIcon className="h-3 w-3" />
                                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-right">
                              {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {(invoices || []).length > 5 && (
                  <div className="px-6 py-3 border-t border-gray-100 text-center">
                    <button
                      onClick={() => setShowAllInvoices(!showAllInvoices)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      {showAllInvoices ? (
                        <><ChevronUp className="h-4 w-4" /> Show Less</>
                      ) : (
                        <><ChevronDown className="h-4 w-4" /> Show All {invoices.length} Invoices</>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No invoices generated yet</p>
              </div>
            )}
          </div>

          {/* ─── Recent Usage Logs ────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" /> Recent Usage Logs
              </h3>
            </div>
            {usageLogs && usageLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(usageLogs || []).slice(0, 10).map((log: any) => {
                      const typeLabels: Record<string, { label: string; color: string }> = {
                        call_minutes: { label: 'Call', color: 'bg-blue-100 text-blue-700' },
                        concurrent_agent: { label: 'Agent', color: 'bg-purple-100 text-purple-700' },
                        sms: { label: 'SMS', color: 'bg-emerald-100 text-emerald-700' },
                        whatsapp: { label: 'WhatsApp', color: 'bg-cyan-100 text-cyan-700' },
                      };
                      const t = typeLabels[log.type] || { label: log.type, color: 'bg-gray-100 text-gray-600' };
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${t.color}`}>{t.label}</span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">{log.quantity}</td>
                          <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">{fmtCurrency(log.cost)}</td>
                          <td className="px-6 py-3 text-sm text-gray-500 max-w-xs truncate">{log.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No usage logs recorded yet</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
