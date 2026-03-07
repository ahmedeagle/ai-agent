'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import Link from 'next/link';
import {
  Mic, FileText, Search, Filter, Download, Calendar,
  Play, Pause, Square, Volume2, VolumeX, Clock,
  ChevronLeft, ChevronRight, Eye, ExternalLink,
  Phone, PhoneIncoming, PhoneOutgoing, ArrowUpDown,
  Headphones, MessageSquare, SkipBack, SkipForward
} from 'lucide-react';

type TabType = 'recordings' | 'transcripts';

export default function RecordingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('recordings');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const limit = 20;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch calls that have recordings/transcripts
  const { data, isLoading } = useQuery({
    queryKey: ['recordings', user.companyId, page, search, dateFilter, directionFilter, activeTab],
    queryFn: async () => {
      const params: Record<string, any> = {
        companyId: user.companyId,
        page,
        limit,
        search,
        hasRecording: activeTab === 'recordings' ? true : undefined,
        hasTranscript: activeTab === 'transcripts' ? true : undefined,
        direction: directionFilter !== 'all' ? directionFilter : undefined,
      };

      if (dateFilter !== 'all') {
        const now = new Date();
        switch (dateFilter) {
          case 'today':
            params.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            break;
          case 'week':
            params.startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
            break;
          case 'month':
            params.startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
            break;
        }
      }

      const response = await api.get('/admin/call', { params });
      return response.data.data;
    }
  });

  const calls = data?.calls || [];
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePlay = async (callId: string, recordingUrl?: string) => {
    if (playingId === callId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    try {
      // Fetch signed URL from recording service
      const response = await api.get(`/recording/${callId}`);
      const url = response.data.data?.signedUrl || recordingUrl;
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setPlayingId(callId);
      
      audio.onended = () => setPlayingId(null);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const handleDownload = async (callId: string, callSid: string) => {
    try {
      const response = await api.get(`/recording/${callId}`);
      const url = response.data.data?.signedUrl;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${callSid}.wav`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const tabs = [
    { id: 'recordings' as TabType, label: 'Recordings', icon: Headphones, count: pagination.total },
    { id: 'transcripts' as TabType, label: 'Transcripts', icon: MessageSquare, count: pagination.total },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recordings & Transcripts</h1>
              <p className="text-sm text-gray-500 mt-1">Browse, play, and download call recordings and transcripts</p>
            </div>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm">
              <Download className="h-4 w-4" />
              Export All
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-200 p-1 rounded-lg w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setPage(1); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by phone number, call SID, or agent..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <select
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              <select
                value={directionFilter}
                onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">Loading {activeTab}...</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              {activeTab === 'recordings' ? (
                <Headphones className="h-12 w-12 text-gray-300 mx-auto" />
              ) : (
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto" />
              )}
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No {activeTab} found
              </h3>
              <p className="mt-2 text-gray-500 text-sm">
                {activeTab === 'recordings'
                  ? 'Call recordings will appear here once calls are completed.'
                  : 'Call transcripts will appear here once calls are processed.'}
              </p>
            </div>
          ) : activeTab === 'recordings' ? (
            /* Recordings Grid */
            <div className="grid gap-4">
              {calls.map((call: any) => (
                <div
                  key={call.id}
                  className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Play Button */}
                    <button
                      onClick={() => handlePlay(call.id, call.recordingUrl)}
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        playingId === call.id
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                      }`}
                    >
                      {playingId === call.id ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                      )}
                    </button>

                    {/* Call Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="h-4 w-4 text-green-500" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium text-gray-900 truncate">
                          {call.from} → {call.to}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          call.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : call.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {call.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(call.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration)}
                        </span>
                        {call.agent && (
                          <span className="text-indigo-600 font-medium">
                            Agent: {call.agent.name}
                          </span>
                        )}
                        {call.recording && (
                          <span className="flex items-center gap-1">
                            <Mic className="h-3 w-3" />
                            {call.recording.format?.toUpperCase()} · {formatFileSize(call.recording.size)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Waveform Placeholder */}
                    {playingId === call.id && (
                      <div className="hidden sm:flex items-center gap-0.5 h-8">
                        {Array.from({ length: 20 }, (_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-indigo-400 rounded-full animate-pulse"
                            style={{
                              height: `${Math.random() * 100}%`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(call.id, call.callSid)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/calls/${call.id}`}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Call Details"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Player (when playing) */}
                  {playingId === call.id && (
                    <div className="border-t px-4 py-3 bg-gray-50 rounded-b-xl">
                      <div className="flex items-center gap-3">
                        <Volume2 className="h-4 w-4 text-gray-400" />
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full w-1/3 transition-all" />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {formatDuration(call.duration)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Transcripts List */
            <div className="grid gap-4">
              {calls.map((call: any) => {
                const transcript = call.transcript?.entries || [];
                const preview = Array.isArray(transcript)
                  ? transcript.slice(0, 3)
                  : [];

                return (
                  <div
                    key={call.id}
                    className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {call.direction === 'inbound' ? (
                                <PhoneIncoming className="h-4 w-4 text-green-500" />
                              ) : (
                                <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                              )}
                              <span className="font-medium text-gray-900">
                                {call.from} → {call.to}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(call.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(call.duration)}
                              </span>
                              {call.agent && (
                                <span className="text-indigo-600 font-medium">
                                  Agent: {call.agent.name}
                                </span>
                              )}
                              {Array.isArray(transcript) && (
                                <span className="text-gray-400">
                                  {transcript.length} messages
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/calls/${call.id}`}
                          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          Full Transcript
                        </Link>
                      </div>

                      {/* Transcript Preview */}
                      {preview.length > 0 && (
                        <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                          {preview.map((entry: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                entry.speaker === 'AI' || entry.speaker === 'ai' || entry.speaker === 'agent'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {entry.speaker === 'AI' || entry.speaker === 'ai' || entry.speaker === 'agent'
                                  ? 'AI'
                                  : 'User'}
                              </span>
                              <p className="text-sm text-gray-600 line-clamp-1 flex-1">
                                {entry.text || entry.content || entry.message}
                              </p>
                              {entry.timestamp && (
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {entry.timestamp}
                                </span>
                              )}
                            </div>
                          ))}
                          {Array.isArray(transcript) && transcript.length > 3 && (
                            <p className="text-xs text-gray-400 italic">
                              +{transcript.length - 3} more messages...
                            </p>
                          )}
                        </div>
                      )}

                      {preview.length === 0 && (
                        <div className="text-sm text-gray-400 italic pl-4 border-l-2 border-gray-200">
                          Transcript processing...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border p-4">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, pagination.total)} of {pagination.total} {activeTab}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${
                        page === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Headphones className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
                  <p className="text-xs text-gray-500">Total Recordings</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {calls.length > 0
                      ? formatDuration(Math.round(calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) / calls.length))
                      : '0:00'}
                  </p>
                  <p className="text-xs text-gray-500">Avg Duration</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <PhoneIncoming className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {calls.filter((c: any) => c.direction === 'inbound').length}
                  </p>
                  <p className="text-xs text-gray-500">Inbound</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <PhoneOutgoing className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {calls.filter((c: any) => c.direction === 'outbound').length}
                  </p>
                  <p className="text-xs text-gray-500">Outbound</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
