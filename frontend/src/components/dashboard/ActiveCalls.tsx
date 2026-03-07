'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react';

interface ActiveCall {
  id: string;
  from: string;
  to: string;
  direction: string;
  duration: string;
  status: string;
}

export default function ActiveCalls() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');
    setSocket(newSocket);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    newSocket.emit('join-company', user.companyId);

    newSocket.on('call:started', (call) => {
      setActiveCalls((prev) => [...prev, call]);
    });

    newSocket.on('call:ended', (call) => {
      setActiveCalls((prev) => prev.filter((c) => c.id !== call.id));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Active Calls</h3>
      
      {activeCalls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Phone className="mx-auto h-12 w-12 mb-2 opacity-50" />
          <p>No active calls</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCalls.map((call) => (
            <div key={call.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                {call.direction === 'inbound' ? (
                  <PhoneIncoming className="h-5 w-5 text-cyan-600" />
                ) : (
                  <PhoneOutgoing className="h-5 w-5 text-indigo-600" />
                )}
                <div>
                  <p className="font-medium text-sm">{call.from} → {call.to}</p>
                  <p className="text-xs text-gray-500">Duration: {call.duration}</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {call.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
