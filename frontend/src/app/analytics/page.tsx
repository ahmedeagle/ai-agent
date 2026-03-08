'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Users, Phone, Clock } from 'lucide-react';

export default function AnalyticsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u.companyId) setCompanyId(u.companyId);
  }, []);

  const { data: kpiRaw } = useQuery({
    queryKey: ['kpis', companyId],
    queryFn: async () => {
      const response = await api.get(`/analytics/kpi/${companyId}`);
      return response.data.data;
    },
    enabled: !!companyId
  });

  // Map KPI data from backend shape to frontend display shape
  const kpis = kpiRaw ? {
    aiPerformance: kpiRaw.aiPerformance?.score || 0,
    successRate: kpiRaw.overview?.successRate || 0,
    avgDuration: (kpiRaw.overview?.averageDuration || 0) / 60, // seconds to minutes
    escalationRate: kpiRaw.overview?.escalationRate || 0,
    completed: kpiRaw.overview?.completedCalls || 0,
    failed: kpiRaw.overview?.failedCalls || 0,
    escalated: kpiRaw.overview?.escalatedCalls || 0,
    inProgress: 0,
    totalCalls: kpiRaw.overview?.totalCalls || 0,
    inboundCalls: kpiRaw.overview?.inboundCalls || 0,
    outboundCalls: kpiRaw.overview?.outboundCalls || 0,
  } : undefined;

  const { data: callData } = useQuery({
    queryKey: ['analytics-calls', companyId],
    queryFn: async () => {
      const response = await api.get('/analytics/calls', {
        params: { company_id: companyId, time_range: '30d', group_by: 'day' }
      });
      return response.data.data;
    },
    enabled: !!companyId
  });

  const { data: agentPerf } = useQuery({
    queryKey: ['analytics-agents', companyId],
    queryFn: async () => {
      const response = await api.get('/analytics/agent-performance', {
        params: { company_id: companyId }
      });
      return response.data.data;
    },
    enabled: !!companyId
  });

  const { data: toolData } = useQuery({
    queryKey: ['analytics-tools', companyId],
    queryFn: async () => {
      const response = await api.get('/analytics/tools', {
        params: { company_id: companyId }
      });
      return response.data.data;
    },
    enabled: !!companyId
  });

  // Build chart-compatible data from real API responses
  const trends = {
    callVolume: callData?.dataPoints || [],
    successRate: (callData?.dataPoints || []).map((p: any) => ({
      date: p.date,
      rate: p.totalCalls > 0 ? Math.round((p.completedCalls / p.totalCalls) * 100) : 0
    })),
    agentPerformance: (agentPerf?.agents || []).map((a: any) => ({
      agentName: a.agentName,
      calls: a.totalCalls,
      successRate: a.successRate
    })),
    toolUsage: (toolData?.tools || []).map((t: any) => ({
      toolName: t.name,
      count: t.count,
      successRate: t.successRate
    })),
    peakHours: (callData?.dataPoints || []).map((p: any) => ({
      hour: p.date,
      calls: p.totalCalls
    }))
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive performance insights</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">AI Performance Score</h3>
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis?.aiPerformance?.toFixed(1) || 0}%</p>
            <div className="flex items-center gap-1 mt-2 text-sm">
              {(kpis?.aiPerformance || 0) > 85 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">+2.5% from last week</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-red-600">-1.2% from last week</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Success Rate</h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis?.successRate?.toFixed(1) || 0}%</p>
            <p className="text-sm text-gray-500 mt-2">{kpis?.completed || 0} successful calls</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Avg Call Duration</h3>
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis?.avgDuration?.toFixed(1) || 0}m</p>
            <p className="text-sm text-gray-500 mt-2">Average per call</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Escalation Rate</h3>
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis?.escalationRate?.toFixed(1) || 0}%</p>
            <p className="text-sm text-gray-500 mt-2">{kpis?.escalated || 0} escalated calls</p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Call Volume Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Call Volume (30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends?.callVolume || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalCalls" stroke="#3B82F6" strokeWidth={2} name="Total Calls" />
                <Line type="monotone" dataKey="completedCalls" stroke="#10B981" strokeWidth={2} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Success Rate Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends?.successRate || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} name="Success Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Agent Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends?.agentPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agentName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls" fill="#3B82F6" name="Calls" />
                <Bar dataKey="successRate" fill="#10B981" name="Success %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Call Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Call Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: kpis?.completed || 0 },
                    { name: 'Failed', value: kpis?.failed || 0 },
                    { name: 'Escalated', value: kpis?.escalated || 0 },
                    { name: 'In Progress', value: kpis?.inProgress || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool Usage */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Tool Usage Statistics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends?.toolUsage || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="toolName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8B5CF6" name="Times Used" />
              <Bar dataKey="successRate" fill="#10B981" name="Success Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Peak Hours Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends?.peakHours || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="#F59E0B" name="Number of Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
