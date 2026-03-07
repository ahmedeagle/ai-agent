'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DollarSign, Clock, TrendingUp, AlertCircle, Users,
  Package, Phone, MessageSquare, Zap, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function BillingWidget() {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setCompanyId(JSON.parse(u).companyId);
  }, []);

  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => (await api.get(`/admin/company/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  const { data: activePackage } = useQuery({
    queryKey: ['active-package', companyId],
    queryFn: async () => (await api.get(`/billing/packages/${companyId}/active`)).data.data,
    enabled: !!companyId,
  });

  const { data: usageSummary } = useQuery({
    queryKey: ['usage-summary', companyId],
    queryFn: async () => (await api.get(`/billing/usage/${companyId}/summary`)).data.data,
    enabled: !!companyId,
  });

  const { data: concurrentStatus } = useQuery({
    queryKey: ['concurrent-status', companyId],
    queryFn: async () =>
      (await api.post('/billing/concurrent-agents/check', { companyId })).data.data,
    enabled: !!companyId,
    refetchInterval: 15000,
  });

  const minutesUsed = companyData?.minutesUsed || 0;
  const minutesAllocated = companyData?.minutesAllocated || activePackage?.minutesIncluded || 1;
  const minutesRemaining = Math.max(minutesAllocated - minutesUsed, 0);
  const usagePct = Math.min((minutesUsed / minutesAllocated) * 100, 100);

  const concurrentCurrent = concurrentStatus?.currentConcurrent || 0;
  const concurrentMax = concurrentStatus?.maxConcurrent || 1;
  const concurrentPct = (concurrentCurrent / concurrentMax) * 100;

  const packageCost = activePackage?.totalPrice || 0;
  const overageCost = usageSummary?.totalCost || 0;

  const costItems = [
    { label: 'Calls', value: usageSummary?.byType?.call_minutes?.cost || 0, icon: Phone, color: 'text-blue-600' },
    { label: 'Agents', value: usageSummary?.byType?.concurrent_agent?.cost || 0, icon: Users, color: 'text-purple-600' },
    { label: 'SMS', value: usageSummary?.byType?.sms?.cost || 0, icon: MessageSquare, color: 'text-emerald-600' },
    { label: 'WhatsApp', value: usageSummary?.byType?.whatsapp?.cost || 0, icon: Zap, color: 'text-cyan-600' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600" /> Billing Overview
        </h3>
        <Link
          href="/billing"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Spend Summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Monthly Spend</p>
          <p className="text-xl font-bold text-gray-900">{fmtCurrency(packageCost + overageCost)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {fmtCurrency(packageCost)} base + {fmtCurrency(overageCost)} usage
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Plan</p>
          <p className="text-xl font-bold text-gray-900 truncate">
            {activePackage?.name || 'None'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {fmtCurrency(activePackage?.totalPrice || 0)}/{activePackage?.billingCycle || 'mo'}
          </p>
        </div>
      </div>

      {/* Minutes Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-600 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Minutes
          </span>
          <span className="font-medium text-gray-900">
            {minutesUsed.toLocaleString()} / {minutesAllocated.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-500 mt-1">
          <span>{minutesRemaining.toLocaleString()} remaining</span>
          <span>{usagePct.toFixed(0)}% used</span>
        </div>
      </div>

      {/* Concurrent Agents */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-600 flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Concurrent Agents
          </span>
          <span className="font-medium text-gray-900">
            {concurrentCurrent} / {concurrentMax}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              concurrentPct >= 90 ? 'bg-red-500' : concurrentPct >= 70 ? 'bg-amber-500' : 'bg-purple-500'
            }`}
            style={{ width: `${Math.min(concurrentPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Alerts */}
      {usagePct >= 80 && (
        <div className={`mb-4 px-3 py-2.5 rounded-lg flex items-start gap-2 text-xs ${
          usagePct >= 95 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {usagePct >= 95
              ? 'Critical: Minutes nearly exhausted. Overage charges will apply.'
              : `${usagePct.toFixed(0)}% of minutes used. Consider upgrading.`}
          </span>
        </div>
      )}

      {concurrentStatus?.needsUpgrade && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-purple-50 text-purple-700 flex items-start gap-2 text-xs">
          <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>All concurrent slots in use. New calls will be queued.</span>
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Usage Costs</p>
        <div className="space-y-2">
          {costItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                  {item.label}
                </span>
                <span className="font-medium text-gray-900">{fmtCurrency(item.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
