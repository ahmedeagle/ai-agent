'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { Search, Filter, Play, CheckCircle, XCircle, Edit2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function QAPage() {
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: qaResults, isLoading } = useQuery({
    queryKey: ['qa-results', user.companyId, filter],
    queryFn: async () => {
      const response = await api.get('/qa/results', {
        params: {
          companyId: user.companyId,
          filter: filter !== 'all' ? filter : undefined
        }
      });
      return response.data.data;
    }
  });

  const updateManualScoreMutation = useMutation({
    mutationFn: (data: { callId: string; manualScore: number; reviewNotes: string }) =>
      api.post('/qa/manual-review', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-results'] });
      setSelectedCall(null);
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusBadge = (passed: boolean) => {
    return passed ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3" />
        Passed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-hidden flex">
        {/* QA Results List */}
        <div className="w-96 bg-white border-r overflow-y-auto">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Quality Assurance</h1>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('passed')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'passed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Passed
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Failed
              </button>
              <button
                onClick={() => setFilter('review')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'review' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Review
              </button>
            </div>
          </div>

          <div className="divide-y">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              </div>
            ) : qaResults?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No QA results found</p>
              </div>
            ) : (
              qaResults?.map((result: any) => (
                <div
                  key={result.id}
                  onClick={() => setSelectedCall(result)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedCall?.id === result.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {result.call?.from || 'Unknown Caller'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {result.call?.agent?.name || 'AI Agent'}
                      </p>
                    </div>
                    {getStatusBadge(result.passed)}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Automated</p>
                        <p className={`text-lg font-bold ${getScoreColor(result.automatedScore).split(' ')[0]}`}>
                          {result.automatedScore}
                        </p>
                      </div>
                      {result.manualScore && (
                        <div>
                          <p className="text-xs text-gray-500">Manual</p>
                          <p className={`text-lg font-bold ${getScoreColor(result.manualScore).split(' ')[0]}`}>
                            {result.manualScore}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QA Details */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {selectedCall ? (
            <div className="p-8">
              <div className="bg-white rounded-lg shadow mb-6">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedCall.call?.from || 'Unknown Caller'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedCall.call?.agent?.name || 'AI Agent'} •{' '}
                        {formatDistanceToNow(new Date(selectedCall.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {getStatusBadge(selectedCall.passed)}
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg ${getScoreColor(selectedCall.automatedScore)}`}>
                      <p className="text-sm font-medium mb-1">Automated Score</p>
                      <p className="text-3xl font-bold">{selectedCall.automatedScore}</p>
                    </div>
                    {selectedCall.manualScore && (
                      <div className={`p-4 rounded-lg ${getScoreColor(selectedCall.manualScore)}`}>
                        <p className="text-sm font-medium mb-1">Manual Score</p>
                        <p className="text-3xl font-bold">{selectedCall.manualScore}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Criteria Breakdown */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Criteria Breakdown</h3>
                  <div className="space-y-3">
                    {selectedCall.criteriaBreakdown &&
                      Object.entries(selectedCall.criteriaBreakdown).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between items-center py-2 border-b">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className={`font-semibold ${value >= 8 ? 'text-green-600' : value >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {value}/10
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Issues Found */}
                {selectedCall.issuesFound && selectedCall.issuesFound.length > 0 && (
                  <div className="p-6 border-t">
                    <h3 className="text-lg font-semibold mb-4 text-red-600">Issues Found</h3>
                    <ul className="space-y-2">
                      {selectedCall.issuesFound.map((issue: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Manual Review */}
                <div className="p-6 border-t bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Edit2 className="h-5 w-5" />
                    Manual Review
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      updateManualScoreMutation.mutate({
                        callId: selectedCall.callId,
                        manualScore: Number(formData.get('score')),
                        reviewNotes: formData.get('notes') as string
                      });
                    }}
                  >
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Manual Score (0-100)
                      </label>
                      <input
                        type="number"
                        name="score"
                        min="0"
                        max="100"
                        defaultValue={selectedCall.manualScore || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Review Notes
                      </label>
                      <textarea
                        name="notes"
                        rows={4}
                        defaultValue={selectedCall.reviewNotes || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Add your review notes here..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                    >
                      Save Manual Review
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>Select a call to review QA details</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
