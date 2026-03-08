'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Sidebar from '@/components/dashboard/Sidebar';
import { Phone, Play, Pause, Volume2, PhoneOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LiveCall {
  id: string;
  callSid: string;
  from: string;
  to: string;
  agent?: { name: string };
  status: string;
  startTime: Date;
  transcript: Array<{
    speaker: 'ai' | 'user';
    text: string;
    timestamp: Date;
  }>;
}

function getWsUrl(): string {
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
  // Socket.IO needs http(s):// — convert ws:// if needed
  return url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
}

export default function LiveCallsPage() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedCallRef = useRef<LiveCall | null>(null);

  // Keep ref in sync with state so Socket.IO callbacks see latest value
  useEffect(() => {
    selectedCallRef.current = selectedCall;
  }, [selectedCall]);

  // Fetch active calls on page load
  const fetchActiveCalls = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice/call/active?companyId=${encodeURIComponent(user.companyId || '')}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          setCalls(data.data.map((c: any) => ({ ...c, transcript: c.transcript || [] })));
        }
      }
    } catch (err) {
      console.error('Failed to fetch active calls:', err);
    }
  }, []);

  // Socket.IO connection — runs once on mount
  useEffect(() => {
    fetchActiveCalls();

    const newSocket = io(getWsUrl(), { transports: ['websocket', 'polling'] });
    socketRef.current = newSocket;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    newSocket.on('connect', () => {
      newSocket.emit('join-company', user.companyId);
    });

    newSocket.on('call:started', (call: LiveCall) => {
      setCalls((prev) => {
        if (prev.some((c) => c.callSid === call.callSid)) return prev;
        return [...prev, { ...call, transcript: call.transcript || [] }];
      });
    });

    newSocket.on('call:updated', (call: LiveCall) => {
      setCalls((prev) => prev.map((c) => (c.callSid === call.callSid ? { ...c, ...call } : c)));
      if (selectedCallRef.current?.callSid === call.callSid) {
        setSelectedCall((prev) => prev ? { ...prev, ...call } : null);
      }
    });

    newSocket.on('call:ended', (call: LiveCall) => {
      setCalls((prev) => prev.filter((c) => c.callSid !== call.callSid));
      if (selectedCallRef.current?.callSid === call.callSid) {
        setSelectedCall(null);
      }
    });

    newSocket.on('transcript', ({ callSid, speaker, text, timestamp }) => {
      const entry = { speaker, text, timestamp };
      setCalls((prev) =>
        prev.map((c) =>
          c.callSid === callSid
            ? { ...c, transcript: [...c.transcript, entry] }
            : c
        )
      );
      if (selectedCallRef.current?.callSid === callSid) {
        setSelectedCall((prev) =>
          prev ? { ...prev, transcript: [...prev.transcript, entry] } : null
        );
      }
    });

    return () => {
      newSocket.close();
    };
  }, [fetchActiveCalls]);

  // Join/leave call room for transcript streaming when selecting a call
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    if (selectedCall) {
      sock.emit('join-call', selectedCall.callSid);
    }
    return () => {
      if (selectedCall) {
        sock.emit('leave-call', selectedCall.callSid);
      }
    };
  }, [selectedCall?.callSid]);

  const endCall = async (callSid: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice/call/${callSid}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-hidden flex">
        {/* Calls List */}
        <div className="w-96 bg-white border-r overflow-y-auto">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900">Live Calls</h1>
            <p className="text-sm text-gray-600 mt-1">
              {calls.length} active {calls.length === 1 ? 'call' : 'calls'}
            </p>
          </div>

          <div className="divide-y">
            {calls.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No active calls</p>
              </div>
            ) : (
              calls.map((call) => (
                <div
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedCall?.id === call.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{call.from}</p>
                      <p className="text-sm text-gray-500">{call.agent?.name || 'AI Agent'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      Live
                    </span>
                    <span>{formatDistanceToNow(new Date(call.startTime), { addSuffix: true })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Call Details */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedCall ? (
            <>
              {/* Call Header */}
              <div className="bg-white border-b p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedCall.from}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedCall.agent?.name || 'AI Agent'} • {selectedCall.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <Volume2 className="h-5 w-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => endCall(selectedCall.callSid)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <PhoneOff className="h-5 w-5" />
                      End Call
                    </button>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-4">
                  {selectedCall.transcript.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex ${entry.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xl px-4 py-3 rounded-lg ${
                          entry.speaker === 'ai'
                            ? 'bg-gray-200 text-gray-900'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <p className="text-sm font-medium mb-1">
                          {entry.speaker === 'ai' ? 'AI Agent' : 'Caller'}
                        </p>
                        <p>{entry.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {selectedCall.transcript.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                      <p>Waiting for conversation to start...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Phone className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Select a call to view details</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
