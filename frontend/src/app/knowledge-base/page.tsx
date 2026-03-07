'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { 
  Plus, Upload, FileText, Trash2, Search, Brain, Globe, 
  MessageSquare, Edit, BookOpen, Download, Filter, TrendingUp,
  FileUp, Link as LinkIcon, PenTool, History
} from 'lucide-react';

type TabType = 'documents' | 'qa' | 'scrape' | 'manual' | 'history';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch documents
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['knowledge-base-docs', user.companyId],
    queryFn: async () => {
      const response = await api.get('/knowledge-base/documents', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  // Fetch Q&A pairs
  const { data: qaPairs, isLoading: qaLoading } = useQuery({
    queryKey: ['knowledge-base-qa', user.companyId],
    queryFn: async () => {
      const response = await api.get('/knowledge-base/qa', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['knowledge-base-stats', user.companyId],
    queryFn: async () => {
      const response = await api.get('/knowledge-base/stats', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  // Fetch training history
  const { data: history } = useQuery({
    queryKey: ['knowledge-base-history', user.companyId],
    queryFn: async () => {
      const response = await api.get('/knowledge-base/history', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    },
    enabled: activeTab === 'history'
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', user.companyId);
      return api.post('/knowledge-base/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-base/document/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  // Add Q&A mutation
  const addQAMutation = useMutation({
    mutationFn: async (data: { question: string; answer: string; category?: string }) => {
      return api.post('/knowledge-base/qa', {
        ...data,
        companyId: user.companyId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  // Delete Q&A mutation
  const deleteQAMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-base/qa/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  // Scrape website mutation
  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      return api.post('/knowledge-base/scrape', {
        url,
        companyId: user.companyId,
        maxPages: 10
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  // Add manual content mutation
  const addContentMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; category?: string }) => {
      return api.post('/knowledge-base/content', {
        ...data,
        companyId: user.companyId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadMutation.mutateAsync(file);
    }
  };

  const handleAddQA = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await addQAMutation.mutateAsync({
      question: formData.get('question') as string,
      answer: formData.get('answer') as string,
      category: formData.get('category') as string || undefined
    });
    e.currentTarget.reset();
  };

  const handleScrapeWebsite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await scrapeMutation.mutateAsync(formData.get('url') as string);
  };

  const handleAddContent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await addContentMutation.mutateAsync({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      category: formData.get('category') as string || undefined
    });
    e.currentTarget.reset();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Knowledge Base Training
            </h1>
            <p className="text-gray-600 mt-1">
              Train your AI agents with documents, Q&A pairs, website content, and more
            </p>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Documents</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.documents || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Q&A Pairs</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.qaPairs || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Websites</p>
                <p className="text-2xl font-bold text-green-600">{stats?.websites || 0}</p>
              </div>
              <Globe className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Chunks</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.totalChunks || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Words</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {stats?.totalWords ? (stats.totalWords / 1000).toFixed(1) + 'K' : 0}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-6 py-3 font-medium ${
                activeTab === 'documents'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-5 w-5" />
              Documents
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`flex items-center gap-2 px-6 py-3 font-medium ${
                activeTab === 'qa'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              Q&A Pairs
            </button>
            <button
              onClick={() => setActiveTab('scrape')}
              className={`flex items-center gap-2 px-6 py-3 font-medium ${
                activeTab === 'scrape'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="h-5 w-5" />
              Scrape Website
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 px-6 py-3 font-medium ${
                activeTab === 'manual'
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PenTool className="h-5 w-5" />
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 font-medium ${
                activeTab === 'history'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="h-5 w-5" />
              Training History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'documents' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Document Library</h2>
                <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                  <FileUp className="h-4 w-4" />
                  Upload Document
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.txt,.md,.csv"
                    className="hidden"
                  />
                </label>
              </div>

              {uploadMutation.isPending && (
                <div className="text-center mb-4 p-4 bg-blue-50 rounded">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-blue-600">Processing document...</p>
                </div>
              )}

              {docsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : documents?.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 mb-2">No documents uploaded yet</p>
                  <p className="text-sm text-gray-400">Upload PDFs, DOCX, TXT, CSV files</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents?.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">{doc.chunks || 0} chunks · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Delete this document?')) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'qa' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Question & Answer Pairs</h2>
              
              <form onSubmit={handleAddQA} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                    <input
                      type="text"
                      name="question"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="What is your return policy?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                    <textarea
                      name="answer"
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="We offer a 30-day return policy..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                    <input
                      type="text"
                      name="category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="e.g., Policy, Support, Billing"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addQAMutation.isPending}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {addQAMutation.isPending ? 'Adding...' : 'Add Q&A Pair'}
                  </button>
                </div>
              </form>

              {qaPairs?.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No Q&A pairs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qaPairs?.map((qa: any) => (
                    <div key={qa.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">Q: {qa.question}</p>
                          <p className="text-gray-600 text-sm">A: {qa.answer}</p>
                          {qa.category && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                              {qa.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Delete this Q&A pair?')) {
                              deleteQAMutation.mutate(qa.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scrape' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Scrape Website Content</h2>
              
              <form onSubmit={handleScrapeWebsite} className="mb-6">
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                    <input
                      type="url"
                      name="url"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-600 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={scrapeMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 justify-center"
                  >
                    {scrapeMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Scraping...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4" />
                        Scrape Website
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Crawls up to 10 pages from the domain</li>
                  <li>• Extracts text content and cleans HTML</li>
                  <li>• Automatically chunks content for training</li>
                  <li>• Respects robots.txt and rate limits</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Manual Content Entry</h2>
              
              <form onSubmit={handleAddContent}>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      name="title"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      placeholder="Content title or topic"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      name="content"
                      required
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      placeholder="Enter your training content here..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                    <input
                      type="text"
                      name="category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      placeholder="e.g., Product Info, Procedures"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addContentMutation.isPending}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    {addContentMutation.isPending ? 'Adding...' : 'Add Content'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Training History</h2>
              
              {history?.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No training history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history?.map((entry: any, index: number) => (
                    <div key={index} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                      <div className="flex-shrink-0 mt-1">
                        {entry.type === 'document' && <FileText className="h-5 w-5 text-blue-500" />}
                        {entry.type === 'qa' && <MessageSquare className="h-5 w-5 text-purple-500" />}
                        {entry.type === 'scrape' && <Globe className="h-5 w-5 text-green-500" />}
                        {entry.type === 'manual' && <PenTool className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{entry.title}</p>
                        <p className="text-sm text-gray-600">{entry.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
