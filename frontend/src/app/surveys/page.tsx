'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  ClipboardCheck, Plus, X, BarChart3, Star, ThumbsUp, ThumbsDown,
  Minus, ToggleLeft, ToggleRight, Trash2, Eye, ChevronDown, ChevronUp
} from 'lucide-react';

const SURVEY_TYPES = ['csat', 'nps', 'custom'];
const TRIGGER_TYPES = ['post_call', 'post_chat', 'scheduled', 'manual'];

export default function SurveysPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'csat', triggerType: 'post_call',
    questions: [{ text: '', type: 'rating' }],
  });

  useEffect(() => { const u = localStorage.getItem('user'); if (u) setUser(JSON.parse(u)); }, []);
  const companyId = user?.companyId;

  const { data: surveysRes } = useQuery({
    queryKey: ['surveys', companyId],
    queryFn: async () => (await api.get(`/surveys/${companyId}`)).data,
    enabled: !!companyId,
  });

  const { data: analyticsRes } = useQuery({
    queryKey: ['surveys-analytics', companyId],
    queryFn: async () => (await api.get(`/surveys/${companyId}/analytics`)).data,
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: async (d: any) => (await api.post('/surveys', { ...d, companyId })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surveys'] }); setShowCreate(false); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/surveys/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  });

  const surveys = surveysRes?.data || [];
  const analytics = analyticsRes?.data;

  const addQuestion = () => setForm(f => ({
    ...f, questions: [...f.questions, { text: '', type: 'rating' }],
  }));

  const removeQuestion = (i: number) => setForm(f => ({
    ...f, questions: f.questions.filter((_, idx) => idx !== i),
  }));

  const updateQuestion = (i: number, field: string, value: string) =>
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, idx) => idx === i ? { ...q, [field]: value } : q),
    }));

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-emerald-600" /> Surveys
              </h1>
              <p className="text-gray-500 mt-1">Customer satisfaction & NPS tracking</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm">
              <Plus className="h-4 w-4" /> Create Survey
            </button>
          </div>

          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">Total Surveys</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSurveys}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalResponses}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">CSAT Score</p>
                <p className="text-2xl font-bold text-emerald-600">{analytics.csat?.toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">NPS Score</p>
                <p className={`text-2xl font-bold ${analytics.nps >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {analytics.nps > 0 ? '+' : ''}{analytics.nps?.toFixed(0)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500">Avg Score</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.averageScore?.toFixed(1)}</p>
                <div className="flex gap-1 mt-1">
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">{analytics.promoters} promoters</span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded">{analytics.detractors} detractors</span>
                </div>
              </div>
            </div>
          )}

          {/* Survey List */}
          <div className="space-y-3">
            {surveys.map((survey: any) => (
              <div key={survey.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      survey.type === 'nps' ? 'bg-purple-100' : survey.type === 'csat' ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      {survey.type === 'nps' ? <BarChart3 className="h-5 w-5 text-purple-600" /> :
                       survey.type === 'csat' ? <ThumbsUp className="h-5 w-5 text-emerald-600" /> :
                       <Star className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{survey.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full uppercase">{survey.type}</span>
                        <span className="text-xs text-gray-400">Trigger: {survey.triggerType?.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{survey._count?.responses || 0} responses</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      survey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {survey.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => setExpandedId(expandedId === survey.id ? null : survey.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                      {expandedId === survey.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => deleteMut.mutate(survey.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === survey.id && (
                  <SurveyDetail surveyId={survey.id} questions={survey.questions} />
                )}
              </div>
            ))}

            {surveys.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No surveys yet</p>
                <p className="text-sm">Create your first survey to start collecting feedback</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Survey Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">New Survey</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Survey Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Post-Call CSAT" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {SURVEY_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trigger</label>
                  <select value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Questions Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Questions</label>
                  <button onClick={addQuestion} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Question</button>
                </div>
                <div className="space-y-3">
                  {form.questions.map((q, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)}
                          placeholder={`Question ${i + 1}`}
                          className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <select value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs text-gray-600">
                          <option value="rating">Rating (1-5)</option>
                          <option value="nps">NPS (0-10)</option>
                          <option value="yes_no">Yes / No</option>
                          <option value="text">Free Text</option>
                        </select>
                      </div>
                      {form.questions.length > 1 && (
                        <button onClick={() => removeQuestion(i)}
                          className="p-1.5 text-red-400 hover:text-red-600 mt-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate({ name: form.name, type: form.type, triggerType: form.triggerType, questions: form.questions })}
                disabled={!form.name || !form.questions[0]?.text}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                Create Survey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Survey Detail (expanded stats + responses) ---------- */
function SurveyDetail({ surveyId, questions }: { surveyId: string; questions: any[] }) {
  const { data: statsRes } = useQuery({
    queryKey: ['survey-stats', surveyId],
    queryFn: async () => (await api.get(`/surveys/${surveyId}/stats`)).data,
  });

  const { data: responsesRes } = useQuery({
    queryKey: ['survey-responses', surveyId],
    queryFn: async () => (await api.get(`/surveys/${surveyId}/responses`)).data,
  });

  const stats = statsRes?.data;
  const responses = responsesRes?.data || [];

  return (
    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border p-3">
            <p className="text-[10px] text-gray-500">Responses</p>
            <p className="text-lg font-bold">{stats.totalResponses}</p>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <p className="text-[10px] text-gray-500">CSAT %</p>
            <p className="text-lg font-bold text-emerald-600">{stats.csatScore?.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <p className="text-[10px] text-gray-500">NPS</p>
            <p className={`text-lg font-bold ${stats.npsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.npsScore > 0 ? '+' : ''}{stats.npsScore?.toFixed(0)}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <p className="text-[10px] text-gray-500">Avg Score</p>
            <p className="text-lg font-bold text-blue-600">{stats.averageScore?.toFixed(1)}</p>
          </div>
        </div>
      )}

      {/* Score Distribution */}
      {stats?.scoreDistribution && (
        <div className="bg-white rounded-xl border p-3 mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Score Distribution</p>
          <div className="flex gap-2 items-end h-16">
            {Object.entries(stats.scoreDistribution).map(([score, count]: [string, any]) => {
              const maxCount = Math.max(...Object.values(stats.scoreDistribution) as number[], 1);
              const height = (count / maxCount) * 100;
              return (
                <div key={score} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-200 rounded-t" style={{ height: `${Math.max(height, 4)}%` }}>
                    <span className="text-[9px] text-center block pt-0.5 font-medium text-emerald-800">{count}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{score}★</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Questions */}
      {questions?.length > 0 && (
        <div className="bg-white rounded-xl border p-3 mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Questions ({questions.length})</p>
          <ol className="space-y-1 list-decimal list-inside text-sm text-gray-600">
            {questions.map((q: any, i: number) => (
              <li key={i}>{q.text} <span className="text-xs text-gray-400">({q.type})</span></li>
            ))}
          </ol>
        </div>
      )}

      {/* Recent Responses */}
      {responses.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Recent Responses</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {responses.slice(0, 10).map((r: any) => (
              <div key={r.id} className="bg-white rounded-lg border px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {r.score !== null && (
                    <span className={`text-sm font-bold ${r.score >= 4 ? 'text-emerald-600' : r.score >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.score}/5
                    </span>
                  )}
                  {r.feedback && <span className="text-xs text-gray-500 truncate max-w-[300px]">{r.feedback}</span>}
                </div>
                <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {responses.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-4">No responses yet</p>
      )}
    </div>
  );
}
