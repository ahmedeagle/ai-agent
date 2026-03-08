'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import { Plus, Play, Pause, StopCircle, Upload, Download, X, Clock, Users, Bot } from 'lucide-react';

export default function CampaignsPage() {
  const [showModal, setShowModal] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch agents for campaign assignment
  const { data: agents } = useQuery({
    queryKey: ['agents', user.companyId],
    queryFn: async () => {
      const response = await api.get('/admin/agents', { params: { companyId: user.companyId } });
      return response.data.data;
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => api.post('/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowModal(false);
      setContactInput('');
    }
  });

  const controlCampaignMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/campaigns/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', user.companyId],
    queryFn: async () => {
      const response = await api.get('/campaigns', {
        params: { companyId: user.companyId }
      });
      return response.data.data;
    }
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800'
    };
    return badges[status as keyof typeof badges] || badges.scheduled;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'completed':
        return <StopCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Outbound Campaigns</h1>
            <p className="text-gray-600 mt-1">Manage your automated calling campaigns</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Create Campaign
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Campaigns</p>
            <p className="text-3xl font-bold text-gray-900">{campaigns?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Active</p>
            <p className="text-3xl font-bold text-green-600">
              {campaigns?.filter((c: any) => c.status === 'active').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Paused</p>
            <p className="text-3xl font-bold text-yellow-600">
              {campaigns?.filter((c: any) => c.status === 'paused').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-3xl font-bold text-gray-600">
              {campaigns?.filter((c: any) => c.status === 'completed').length || 0}
            </p>
          </div>
        </div>

        {/* Campaigns List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : campaigns?.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">No campaigns created yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Your First Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns?.map((campaign: any) => (
              <div key={campaign.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{campaign.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}
                        >
                          {getStatusIcon(campaign.status)}
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{campaign.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === 'active' && (
                        <button
                          onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: 'pause' })}
                          className="p-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        >
                          <Pause className="h-5 w-5" />
                        </button>
                      )}
                      {(campaign.status === 'paused' || campaign.status === 'draft') && (
                        <button
                          onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: 'start' })}
                          className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          <Play className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => controlCampaignMutation.mutate({ id: campaign.id, action: 'stop' })}
                        className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        <StopCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Campaign Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Agent</p>
                      <p className="text-sm font-medium">{campaign.agent?.name || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contacts</p>
                      <p className="text-sm font-medium">{campaign.totalContacts || 0} numbers</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Called</p>
                      <p className="text-sm font-medium">{campaign.calledContacts || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                      <p className="text-sm font-medium text-green-600">
                        {campaign.successRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>
                        {campaign.calledContacts || 0} / {campaign.totalContacts || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((campaign.calledContacts || 0) / (campaign.totalContacts || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Schedule Info */}
                  {campaign.schedule && (
                    <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                      <p className="text-gray-600">
                        <span className="font-medium">Schedule:</span> {campaign.schedule.startTime} -{' '}
                        {campaign.schedule.endTime} • {campaign.schedule.daysOfWeek?.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Campaign Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Create Campaign</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const contacts = contactInput
                  .split(/[\n,]+/)
                  .map(c => c.trim())
                  .filter(c => c.length > 0);
                
                createCampaignMutation.mutate({
                  companyId: user.companyId,
                  name: formData.get('name'),
                  agentId: formData.get('agentId'),
                  contactList: contacts,
                  startTime: formData.get('startTime') || null,
                  endTime: formData.get('endTime') || null,
                  maxCallsPerDay: parseInt(formData.get('maxCallsPerDay') as string) || 100,
                  maxRetries: parseInt(formData.get('maxRetries') as string) || 3,
                  retryDelay: parseInt(formData.get('retryDelay') as string) || 60,
                  script: formData.get('script') || null
                });
              }} className="space-y-5">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g., Q1 Customer Follow-up"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Agent Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Bot className="h-4 w-4 inline mr-1" /> AI Agent *
                  </label>
                  <select
                    name="agentId"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an agent...</option>
                    {(agents || []).map((agent: any) => (
                      <option key={agent.id} value={agent.id}>{agent.name} ({agent.language})</option>
                    ))}
                  </select>
                </div>

                {/* Contact List */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Users className="h-4 w-4 inline mr-1" /> Contact Numbers *
                  </label>
                  <textarea
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    rows={4}
                    placeholder="Enter phone numbers (one per line or comma-separated)&#10;+1234567890&#10;+0987654321"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {contactInput.split(/[\n,]+/).filter(c => c.trim().length > 0).length} contacts entered
                  </p>
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="h-4 w-4 inline mr-1" /> Start Time
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      defaultValue="09:00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      name="endTime"
                      defaultValue="17:00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Call Settings */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Calls/Day</label>
                    <input
                      type="number"
                      name="maxCallsPerDay"
                      defaultValue={100}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                    <input
                      type="number"
                      name="maxRetries"
                      defaultValue={3}
                      min={0}
                      max={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Retry Delay (min)</label>
                    <input
                      type="number"
                      name="retryDelay"
                      defaultValue={60}
                      min={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Script / Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Script (Optional)</label>
                  <textarea
                    name="script"
                    rows={3}
                    placeholder="Instructions / script for the AI agent to follow during campaign calls..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCampaignMutation.isPending}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
