'use client';

import { Phone, CheckCircle, XCircle, TrendingUp, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Zap, MessageCircle, Mail, MessageSquare, Activity } from 'lucide-react';

interface ChannelData {
  total: number;
  inbound?: number;
  outbound?: number;
  delivered?: number;
  failed?: number;
  sent?: number;
}

interface StatsCardsProps {
  data?: {
    totalInteractions?: number;
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    completedCalls: number;
    failedCalls: number;
    missedCalls?: number;
    successRate: number;
    averageDuration?: number;
  };
  channels?: {
    whatsapp?: ChannelData;
    sms?: ChannelData;
    email?: ChannelData;
  };
}

function StatCard({ name, value, icon: Icon, color, subtitle }: {
  name: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 rounded-lg p-3 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="ml-4 w-0 flex-1">
            <dl>
              <dt className="text-xs font-medium text-gray-500 truncate">{name}</dt>
              <dd className="text-xl font-bold text-gray-900">{value}</dd>
              {subtitle && <dd className="text-xs text-gray-400 mt-0.5">{subtitle}</dd>}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({ data, channels }: StatsCardsProps) {
  const avgMinutes = data?.averageDuration ? data.averageDuration / 60 : 0;
  const minutesUsed = data?.averageDuration && data?.totalCalls ? (data.averageDuration * data.totalCalls) / 60 : 0;
  const wa = channels?.whatsapp || { total: 0, inbound: 0, outbound: 0, delivered: 0, failed: 0 };
  const sms = channels?.sms || { total: 0, inbound: 0, outbound: 0, delivered: 0, failed: 0 };
  const email = channels?.email || { total: 0, sent: 0, delivered: 0, failed: 0 };
  const totalInteractions = data?.totalInteractions || (data?.totalCalls || 0) + wa.total + sms.total + email.total;

  return (
    <div className="space-y-6">
      {/* Channel Overview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Channel Overview</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            name="Total Interactions"
            value={totalInteractions}
            icon={Activity}
            color="bg-gray-800"
          />
          <StatCard
            name="Voice Calls"
            value={data?.totalCalls || 0}
            icon={Phone}
            color="bg-blue-500"
            subtitle={`${data?.inboundCalls || 0} in · ${data?.outboundCalls || 0} out`}
          />
          <StatCard
            name="WhatsApp"
            value={wa.total}
            icon={MessageCircle}
            color="bg-green-500"
            subtitle={`${wa.inbound || 0} in · ${wa.outbound || 0} out`}
          />
          <StatCard
            name="SMS"
            value={sms.total}
            icon={MessageSquare}
            color="bg-violet-500"
            subtitle={`${sms.inbound || 0} in · ${sms.outbound || 0} out`}
          />
          <StatCard
            name="Email"
            value={email.total}
            icon={Mail}
            color="bg-rose-500"
            subtitle={`${email.sent || 0} sent · ${email.delivered || 0} delivered`}
          />
        </div>
      </div>

      {/* Voice Performance */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Voice Performance</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard name="Completed" value={data?.completedCalls || 0} icon={CheckCircle} color="bg-green-500" />
          <StatCard name="Failed" value={data?.failedCalls || 0} icon={XCircle} color="bg-red-500" />
          <StatCard name="Missed" value={data?.missedCalls || 0} icon={PhoneMissed} color="bg-orange-500" />
          <StatCard name="Success Rate" value={`${data?.successRate?.toFixed(1) || 0}%`} icon={TrendingUp} color="bg-purple-500" />
          <StatCard name="Avg Duration" value={avgMinutes > 0 ? `${avgMinutes.toFixed(1)}m` : '—'} icon={Clock} color="bg-amber-500" />
          <StatCard name="Minutes Used" value={minutesUsed > 0 ? minutesUsed.toFixed(0) : '0'} icon={Zap} color="bg-teal-500" />
        </div>
      </div>

      {/* Digital Channels Delivery */}
      {(wa.total > 0 || sms.total > 0 || email.total > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Delivery Status</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wa.total > 0 && (
              <StatCard
                name="WhatsApp Delivered"
                value={wa.total > 0 ? `${((wa.delivered || 0) / wa.total * 100).toFixed(0)}%` : '—'}
                icon={MessageCircle}
                color="bg-green-600"
                subtitle={`${wa.delivered || 0} delivered · ${wa.failed || 0} failed`}
              />
            )}
            {sms.total > 0 && (
              <StatCard
                name="SMS Delivered"
                value={sms.total > 0 ? `${((sms.delivered || 0) / sms.total * 100).toFixed(0)}%` : '—'}
                icon={MessageSquare}
                color="bg-violet-600"
                subtitle={`${sms.delivered || 0} delivered · ${sms.failed || 0} failed`}
              />
            )}
            {email.total > 0 && (
              <StatCard
                name="Email Delivered"
                value={email.total > 0 ? `${((email.delivered || 0) / email.total * 100).toFixed(0)}%` : '—'}
                icon={Mail}
                color="bg-rose-600"
                subtitle={`${email.delivered || 0} delivered · ${email.failed || 0} failed`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
