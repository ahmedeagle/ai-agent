'use client';

import { useEffect, useState } from 'react';
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

export default function LiveCallsPage() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');
    setSocket(newSocket);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    newSocket.emit('join-company', user.companyId);

    newSocket.on('call:started', (call: LiveCall) => {
      setCalls((prev) => [...prev, call]);
    });

    newSocket.on('call:updated', (call: LiveCall) => {
      setCalls((prev) => prev.map((c) => (c.id === call.id ? call : c)));
      if (selectedCall?.id === call.id) {
        setSelectedCall(call);
      }
    });

    newSocket.on('call:ended', (call: LiveCall) => {
      setCalls((prev) => prev.filter((c) => c.id !== call.id));
      if (selectedCall?.id === call.id) {
        setSelectedCall(null);
      }
    });

    newSocket.on('transcript', ({ callId, speaker, text, timestamp }) => {
      setCalls((prev) =>
        prev.map((c) =>
          c.id === callId
            ? { ...c, transcript: [...c.transcript, { speaker, text, timestamp }] }
            : c
        )
      );
      if (selectedCall?.id === callId) {
        setSelectedCall((prev) =>
          prev
            ? { ...prev, transcript: [...prev.transcript, { speaker, text, timestamp }] }
            : null
        );
      }
    });

    return () => {
      newSocket.close();
    };
  }, [selectedCall]);

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
