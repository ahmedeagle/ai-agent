'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { 
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Search, Filter, Download, Calendar, Clock, 
  ChevronLeft, ChevronRight, Eye, Play, FileText,
  CheckCircle, XCircle, AlertTriangle, ArrowUpDown
} from 'lucide-react';

export default function CallHistoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data, isLoading } = useQuery({
    queryKey: ['calls', user.companyId, page, search, directionFilter, statusFilter, sortField, sortOrder],
    queryFn: async () => {
      const response = await api.get('/admin/calls', {
        params: { 
          companyId: user.companyId, 
          page, 
          limit,
          search,
          direction: directionFilter !== 'all' ? directionFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });
      return response.data.data;
    }
  });

  const calls = data?.calls || [];
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" /> Completed</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="h-3 w-3" /> Failed</span>;
      case 'in-progress':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Phone className="h-3 w-3 animate-pulse" /> In Progress</span>;
      case 'ringing':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Phone className="h-3 w-3" /> Ringing</span>;
      case 'initiated':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><Clock className="h-3 w-3" /> Initiated</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === 'inbound') return <PhoneIncoming className="h-4 w-4 text-cyan-600" />;
    if (direction === 'outbound') return <PhoneOutgoing className="h-4 w-4 text-indigo-600" />;
    return <Phone className="h-4 w-4 text-gray-600" />;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Stats
  const totalCalls = pagination.total || 0;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
            <p className="text-gray-600 mt-1">Browse and analyze all past calls</p>
          </div>
          <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone number, agent name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="in-progress">In Progress</option>
              <option value="ringing">Ringing</option>
            </select>
          </div>
        </div>

        {/* Calls Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => { setSortField('from'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                      From <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => { setSortField('duration'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                      Duration <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Escalated</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => { setSortField('createdAt'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                      Date <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading calls...</p>
                    </td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <PhoneMissed className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No calls found</p>
                    </td>
                  </tr>
                ) : (
                  calls.map((call: any) => (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/calls/${call.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(call.direction)}
                          <span className="text-xs text-gray-600 capitalize">{call.direction}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{call.from || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{call.to || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{call.agent?.name || 'Unassigned'}</span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(call.status)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 font-mono">{formatDuration(call.duration)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {call.escalated ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{formatDate(call.createdAt)}</div>
                        <div className="text-xs text-gray-500">{formatTime(call.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a href={`/calls/${call.id}`} onClick={(e) => e.stopPropagation()} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                            <Eye className="h-4 w-4" />
                          </a>
                          {call.recordingUrl && (
                            <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Play Recording">
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {call.transcript && (
                            <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="View Transcript">
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.total)} of {pagination.total} calls
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, pagination.pages - 4)) + i;
                  if (pageNum > pagination.pages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1.5 text-sm rounded ${
                        pageNum === page 
                          ? 'bg-blue-600 text-white' 
                          : 'border border-gray-300 hover:bg-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
