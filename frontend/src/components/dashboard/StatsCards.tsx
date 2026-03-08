'use client';

import { Phone, CheckCircle, XCircle, TrendingUp, PhoneIncoming, PhoneOutgoing, Clock, DollarSign, Users, Zap } from 'lucide-react';

interface StatsCardsProps {
  data?: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    completedCalls: number;
    failedCalls: number;
    successRate: number;
    averageDuration?: number;
    escalatedCalls?: number;
    escalationRate?: number;
    firstCallResolution?: number;
  };
}

export default function StatsCards({ data }: StatsCardsProps) {
  const avgMinutes = data?.averageDuration ? data.averageDuration / 60 : 0;
  const minutesUsed = data?.averageDuration && data?.totalCalls ? (data.averageDuration * data.totalCalls) / 60 : 0;

  const stats = [
    {
      name: 'Total Calls',
      value: data?.totalCalls || 0,
      icon: Phone,
      color: 'bg-blue-500',
    },
    {
      name: 'Inbound',
      value: data?.inboundCalls || 0,
      icon: PhoneIncoming,
      color: 'bg-cyan-500',
    },
    {
      name: 'Outbound',
      value: data?.outboundCalls || 0,
      icon: PhoneOutgoing,
      color: 'bg-indigo-500',
    },
    {
      name: 'Completed',
      value: data?.completedCalls || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      name: 'Failed',
      value: data?.failedCalls || 0,
      icon: XCircle,
      color: 'bg-red-500',
    },
    {
      name: 'Success Rate',
      value: `${data?.successRate?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      name: 'Avg Duration',
      value: avgMinutes > 0 ? `${avgMinutes.toFixed(1)}m` : '—',
      icon: Clock,
      color: 'bg-amber-500',
    },
    {
      name: 'Minutes Used',
      value: minutesUsed > 0 ? minutesUsed.toFixed(0) : '0',
      icon: Zap,
      color: 'bg-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.name} className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-lg p-3 ${stat.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-xl font-bold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
