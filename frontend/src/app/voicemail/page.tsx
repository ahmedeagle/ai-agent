'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Voicemail, Play, Pause, Archive, Trash2, Phone,
  Clock, Search, CheckCircle2, Inbox, Volume2
} from 'lucide-react';

export default function VoicemailPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<'new' | 'listened' | 'archived'>('new');
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  // Get voicemails
  const { data: voicemails } = useQuery({
    queryKey: ['voicemails', companyId, tab],
    queryFn: async () => {
      const status = tab === 'new' ? 'new' : tab;
      return (await api.get(`/voicemail/${companyId}?status=${status}`)).data.data;
    },
    enabled: !!companyId,
  });

  // Mark as listened
  const listenMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/voicemail/${id}/listen`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voicemails'] }),
  });

  // Archive
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/voicemail/${id}/archive`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voicemails'] }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/voicemail/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voicemails'] }),
  });

  const togglePlay = (vm: any) => {
    if (playingId === vm.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(vm.recordingUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(vm.id);

      // Mark as listened
      if (vm.status === 'new') {
        listenMutation.mutate(vm.id);
      }
    }
  };

  const fmtDuration = (seconds: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const filtered = (voicemails || []).filter((vm: any) =>
    !search || vm.callerPhone?.includes(search) || vm.callerName?.toLowerCase().includes(search.toLowerCase())
    || vm.transcription?.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Voicemail className="h-8 w-8 text-blue-600" /> Voicemail
            </h1>
            <p className="text-gray-500 mt-1">Listen to and manage voicemail messages</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {(['new', 'listened', 'archived'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition capitalize ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by phone, name, or transcript..."
            />
          </div>

          {/* Voicemail List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {filtered.map((vm: any) => (
                  <div key={vm.id} className="px-6 py-5 hover:bg-gray-50/50 transition">
                    <div className="flex items-start gap-4">
                      {/* Play Button */}
                      <button
                        onClick={() => togglePlay(vm)}
                        disabled={!vm.recordingUrl}
                        className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition ${
                          playingId === vm.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        } ${!vm.recordingUrl ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {playingId === vm.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {vm.callerName || vm.callerPhone || 'Unknown'}
                          </p>
                          {vm.callerName && (
                            <span className="text-xs text-gray-400">{vm.callerPhone}</span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            vm.status === 'new' ? 'bg-blue-100 text-blue-700'
                              : vm.status === 'listened' ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {vm.status}
                          </span>
                        </div>

                        {/* Transcription */}
                        {vm.transcription ? (
                          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{vm.transcription}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic mt-1.5">No transcription available</p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtDuration(vm.duration)}
                          </span>
                          <span>{new Date(vm.createdAt).toLocaleString()}</span>
                          {vm.transcriptionConfidence > 0 && (
                            <span className="text-emerald-600">
                              {(vm.transcriptionConfidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {vm.status !== 'listened' && vm.status !== 'archived' && (
                          <button
                            onClick={() => listenMutation.mutate(vm.id)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Mark as listened"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {vm.status !== 'archived' && (
                          <button
                            onClick={() => archiveMutation.mutate(vm.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Delete this voicemail?')) deleteMutation.mutate(vm.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {search ? 'No voicemails match your search' : `No ${tab} voicemails`}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
