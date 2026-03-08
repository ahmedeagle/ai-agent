'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  MessageCircle, Send, Search, Image, Paperclip,
  Check, CheckCheck, Clock, AlertCircle
} from 'lucide-react';

const STATUS_ICON: Record<string, any> = {
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [msgText, setMsgText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  // Get all conversations
  const { data: convos } = useQuery({
    queryKey: ['wa-convos', companyId],
    queryFn: async () => (await api.get(`/whatsapp/conversations/${companyId}`)).data.data,
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  // Get messages for selected contact
  const { data: messages } = useQuery({
    queryKey: ['wa-msgs', companyId, selectedContact],
    queryFn: async () => (await api.get(`/whatsapp/messages/${companyId}/${encodeURIComponent(selectedContact!)}`)).data.data,
    enabled: !!companyId && !!selectedContact,
    refetchInterval: 3000,
  });

  // Send message
  const sendMut = useMutation({
    mutationFn: async (body: string) =>
      (await api.post('/whatsapp/send', { to: selectedContact, body, companyId })).data,
    onSuccess: () => {
      setMsgText('');
      qc.invalidateQueries({ queryKey: ['wa-msgs'] });
      qc.invalidateQueries({ queryKey: ['wa-convos'] });
    },
  });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const filtered = (convos || []).filter((c: any) =>
    !search || c.contact.includes(search)
  );

  const handleSend = () => {
    if (msgText.trim() && selectedContact) sendMut.mutate(msgText.trim());
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
              <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.map((conv: any) => (
              <div key={conv.contact}
                onClick={() => setSelectedContact(conv.contact)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${
                  selectedContact === conv.contact ? 'bg-green-50 border-l-2 border-l-green-500' : ''
                }`}>
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {conv.contact.slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{conv.contact}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                    {conv.unread > 0 && (
                      <span className="ml-1 w-5 h-5 bg-green-500 text-white text-[10px] rounded-full flex items-center justify-center shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#ece5dd]">
          {selectedContact ? (
            <>
              {/* Chat header */}
              <div className="bg-white px-5 py-3 border-b border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
                  {selectedContact.slice(-2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedContact}</p>
                  <p className="text-xs text-green-600">WhatsApp Business</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {(messages || []).map((msg: any) => {
                  const isOutbound = msg.direction === 'outbound';
                  const StatusIcon = STATUS_ICON[msg.status] || Clock;
                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                        isOutbound
                          ? 'bg-[#dcf8c6] text-gray-900 rounded-br-md'
                          : 'bg-white text-gray-900 rounded-bl-md'
                      }`}>
                        {msg.mediaUrl && (
                          <div className="mb-2">
                            <Image className="h-4 w-4 text-gray-400 inline mr-1" />
                            <a href={msg.mediaUrl} target="_blank" rel="noopener" className="text-blue-600 text-xs underline">Media attachment</a>
                          </div>
                        )}
                        <p>{msg.body}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? '' : 'text-gray-400'}`}>
                          <span className="text-[10px] text-gray-500">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isOutbound && (
                            <StatusIcon className={`h-3 w-3 ${msg.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center gap-3">
                <input
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button onClick={handleSend} disabled={!msgText.trim()}
                  className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50 transition">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a contact from the left to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
