'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, ArrowLeft, Play, Pause,
  FileText, Shield, Clock, Calendar, User, Bot, AlertTriangle,
  CheckCircle, XCircle, Download, Volume2, Wrench, MessageSquare,
  ChevronDown, ChevronUp, Star, Send
} from 'lucide-react';

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.id as string;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('transcript');
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualScore, setManualScore] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: call, isLoading } = useQuery({
    queryKey: ['call', callId],
    queryFn: async () => {
      const response = await api.get(`/admin/calls/${callId}`);
      return response.data.data;
    }
  });

  const { data: qaResult } = useQuery({
    queryKey: ['qa', callId],
    queryFn: async () => {
      try {
        const response = await api.get(`/qa/call/${callId}/qa`);
        return response.data.data;
      } catch { return null; }
    }
  });

  const submitReviewMutation = useMutation({
    mutationFn: (data: any) => api.post(`/qa/manual-review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa', callId] });
      setManualScore('');
      setReviewComment('');
    }
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </main>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Phone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">Call Not Found</h2>
            <a href="/calls" className="text-blue-600 hover:underline mt-2 inline-block">Back to Call History</a>
          </div>
        </main>
      </div>
    );
  }

  const transcriptEntries = call.transcript?.entries || [];
  const toolCalls = call.toolCalls || [];
  const recording = call.recording;

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
    ringing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    initiated: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const tabs = [
    { id: 'transcript', label: 'Transcript', icon: FileText, count: transcriptEntries.length },
    { id: 'tools', label: 'Tool Actions', icon: Wrench, count: toolCalls.length },
    { id: 'qa', label: 'QA & Scoring', icon: Shield },
    { id: 'recording', label: 'Recording', icon: Volume2 }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <a href="/calls" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </a>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Call Details</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[call.status] || statusColors.initiated}`}>
                  {call.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {call.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                  {call.status}
                </span>
                {call.escalated && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="h-3 w-3" /> Escalated
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Call SID: {call.callSid}</p>
            </div>
          </div>

          {/* Call Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {call.direction === 'inbound' ? <PhoneIncoming className="h-5 w-5 text-cyan-600" /> : <PhoneOutgoing className="h-5 w-5 text-indigo-600" />}
              <div>
                <p className="text-xs text-gray-500">Direction</p>
                <p className="text-sm font-semibold capitalize">{call.direction}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">From</p>
                <p className="text-sm font-semibold">{call.from}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">To</p>
                <p className="text-sm font-semibold">{call.to}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-semibold">{formatDuration(call.duration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Bot className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">Agent</p>
                <p className="text-sm font-semibold">{call.agent?.name || 'Unassigned'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-semibold">{formatDateTime(call.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Call Transcript</h2>
                <p className="text-sm text-gray-500">{transcriptEntries.length} messages</p>
              </div>
              {transcriptEntries.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No transcript available for this call</p>
                </div>
              ) : (
                <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                  {transcriptEntries.map((entry: any, index: number) => (
                    <div key={index} className={`flex gap-3 ${entry.speaker === 'AI' ? '' : 'flex-row-reverse'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        entry.speaker === 'AI' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {entry.speaker === 'AI' ? (
                          <Bot className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className={`max-w-[70%] ${entry.speaker === 'AI' ? '' : 'text-right'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600">{entry.speaker}</span>
                          {entry.timestamp && (
                            <span className="text-xs text-gray-400">{entry.timestamp}</span>
                          )}
                        </div>
                        <div className={`inline-block px-4 py-2 rounded-lg text-sm ${
                          entry.speaker === 'AI' 
                            ? 'bg-blue-50 text-gray-800' 
                            : 'bg-green-50 text-gray-800'
                        }`}>
                          {entry.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tool Actions Tab */}
          {activeTab === 'tools' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Tool Executions</h2>
                <p className="text-sm text-gray-500">{toolCalls.length} tools called during this call</p>
              </div>
              {toolCalls.length === 0 ? (
                <div className="p-12 text-center">
                  <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No tools were executed during this call</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {toolCalls.map((tc: any) => (
                    <div key={tc.id} className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${tc.success ? 'bg-green-100' : 'bg-red-100'}`}>
                            <Wrench className={`h-4 w-4 ${tc.success ? 'text-green-600' : 'text-red-600'}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{tc.tool?.name || 'Unknown Tool'}</p>
                            <p className="text-xs text-gray-500">Executed at {formatDateTime(tc.executedAt)}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tc.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tc.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Parameters</p>
                          <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(tc.parameters, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Result</p>
                          <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                            {tc.result ? JSON.stringify(tc.result, null, 2) : tc.error || 'No result'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QA & Scoring Tab */}
          {activeTab === 'qa' && (
            <div className="space-y-6">
              {/* Automated Score */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Automated QA Score</h2>
                {qaResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                            stroke={qaResult.automatedScore >= 70 ? '#22c55e' : qaResult.automatedScore >= 50 ? '#eab308' : '#ef4444'}
                            strokeWidth="3" strokeDasharray={`${qaResult.automatedScore}, 100`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                          {Math.round(qaResult.automatedScore)}%
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {qaResult.compliancePassed ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-sm">
                              <CheckCircle className="h-4 w-4" /> Compliance Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded text-sm">
                              <XCircle className="h-4 w-4" /> Compliance Failed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">Score threshold: 70%</p>
                      </div>
                    </div>

                    {/* Rule Results */}
                    {qaResult.ruleResults && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Rule Evaluation</h3>
                        <div className="space-y-2">
                          {(Array.isArray(qaResult.ruleResults) ? qaResult.ruleResults : []).map((rule: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span className="text-sm text-gray-700">{rule.rule || rule.name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                rule.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {rule.passed ? 'Passed' : 'Failed'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compliance Issues */}
                    {qaResult.complianceIssues && Array.isArray(qaResult.complianceIssues) && qaResult.complianceIssues.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2">Compliance Issues</h3>
                        <ul className="space-y-1">
                          {qaResult.complianceIssues.map((issue: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-red-600">
                              <AlertTriangle className="h-3 w-3" /> {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No automated QA evaluation yet</p>
                    <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                      Run QA Evaluation
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Review */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Manual Review</h2>
                {qaResult?.manualScore ? (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`h-5 w-5 ${s <= (qaResult.manualScore / 20) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="text-lg font-bold">{qaResult.manualScore}%</span>
                    </div>
                    <p className="text-sm text-gray-600">{qaResult.reviewComments}</p>
                    <p className="text-xs text-gray-400 mt-2">Reviewed at {qaResult.reviewedAt ? formatDateTime(qaResult.reviewedAt) : 'N/A'}</p>
                  </div>
                ) : (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    submitReviewMutation.mutate({
                      callId,
                      score: parseInt(manualScore),
                      comments: reviewComment,
                      reviewerId: user.id
                    });
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Score (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                        placeholder="Enter score..."
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Review Comments</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={3}
                        placeholder="Add review notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitReviewMutation.isPending}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Recording Tab */}
          {activeTab === 'recording' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Call Recording</h2>
              {recording || call.recordingUrl ? (
                <div className="space-y-4">
                  {/* Audio Player */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <audio
                      controls
                      className="w-full"
                      src={recording?.url || call.recordingUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm font-semibold">{formatDuration(recording?.duration || call.duration)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">Format</p>
                      <p className="text-sm font-semibold">{recording?.format?.toUpperCase() || 'WAV'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">Size</p>
                      <p className="text-sm font-semibold">
                        {recording?.size ? `${(recording.size / (1024 * 1024)).toFixed(1)} MB` : '—'}
                      </p>
                    </div>
                  </div>
                  <a
                    href={recording?.url || call.recordingUrl}
                    download
                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                  >
                    <Download className="h-4 w-4" />
                    Download Recording
                  </a>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Volume2 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No recording available for this call</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
