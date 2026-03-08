'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  FileText, Search, Filter, Calendar, User, Shield,
  AlertTriangle, Plus, Pencil, Trash2, Eye, LogIn,
  LogOut, Download, ChevronLeft, ChevronRight
} from 'lucide-react';

const ACTION_ICONS: Record<string, any> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  login: LogIn,
  logout: LogOut,
  export: Download,
  view: Eye,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-600',
  export: 'bg-amber-100 text-amber-700',
  view: 'bg-sky-100 text-sky-700',
};

export default function AuditLogPage() {
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    userId: '',
  });
  const pageSize = 25;

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Fetch audit logs
  const { data: logsRes } = useQuery({
    queryKey: ['audit-logs', companyId, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (filters.action) params.set('action', filters.action);
      if (filters.resource) params.set('resource', filters.resource);
      if (filters.userId) params.set('userId', filters.userId);

      return (await api.get(`/admin/audit-log/${companyId}?${params}`)).data;
    },
    enabled: !!companyId,
  });

  // Fetch stats
  const { data: statsRes } = useQuery({
    queryKey: ['audit-stats', companyId],
    queryFn: async () => (await api.get(`/admin/audit-log/${companyId}/stats`)).data,
    enabled: !!companyId,
  });

  const logs = logsRes?.data || [];
  const total = logsRes?.total || 0;
  const stats = statsRes?.data;
  const totalPages = Math.ceil(total / pageSize);

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" /> Audit Log
            </h1>
            <p className="text-gray-500 mt-1">Track all user actions and system changes for compliance</p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-1">Last 7 Days</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLast7Days}</p>
                <p className="text-xs text-gray-400 mt-1">total events</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-1">Top Action</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Object.entries(stats.byAction || {}).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {Object.entries(stats.byAction || {}).sort(([, a]: any, [, b]: any) => b - a)[0]?.[1] as number || 0} occurrences
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-1">Top Resource</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Object.entries(stats.byResource || {}).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">most modified</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-1">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{stats.topUsers?.length || 0}</p>
                <p className="text-xs text-gray-400 mt-1">in last 7 days</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filters.action}
              onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {['create', 'update', 'delete', 'login', 'logout', 'export', 'view'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={filters.resource}
              onChange={e => { setFilters(f => ({ ...f, resource: e.target.value })); setPage(0); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              {['user', 'agent', 'call', 'billing', 'ivr', 'queue', 'campaign', 'tool', 'company', 'sms', 'voicemail', 'qa_rule'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {(filters.action || filters.resource) && (
              <button
                onClick={() => { setFilters({ action: '', resource: '', userId: '' }); setPage(0); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}

            <div className="ml-auto text-sm text-gray-500">
              {total} total records
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Timestamp</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Resource</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.length > 0 ? logs.map((log: any) => {
                    const ActionIcon = ACTION_ICONS[log.action] || FileText;
                    const actionColor = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600';
                    const details = log.details as any;

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-900">{new Date(log.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                              {log.userEmail?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-gray-900 text-xs font-medium">{log.userEmail}</p>
                              <p className="text-gray-400 text-[10px]">{log.userRole}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionColor}`}>
                            <ActionIcon className="h-3 w-3" />
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {log.resource}
                          </span>
                          {log.resourceId && (
                            <span className="text-[10px] text-gray-400 ml-1 font-mono">{log.resourceId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-xs text-gray-500 truncate">
                            {details?.description || (details ? JSON.stringify(details).slice(0, 80) : '—')}
                          </p>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No audit log entries found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-600">Page {page + 1} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
