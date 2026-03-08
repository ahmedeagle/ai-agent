'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  Users, UserPlus, Shield, Crown, Eye, Headphones,
  MoreVertical, Pencil, Trash2, X, Check
} from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-100 text-red-700', icon: Crown, desc: 'Full system access, can manage companies' },
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700', icon: Shield, desc: 'Manage users, billing, agents, settings' },
  supervisor: { label: 'Supervisor', color: 'bg-blue-100 text-blue-700', icon: Eye, desc: 'Monitor calls, manage agents & campaigns' },
  agent: { label: 'Agent', color: 'bg-green-100 text-green-700', icon: Headphones, desc: 'Handle calls, SMS, voicemail' },
  user: { label: 'Agent', color: 'bg-green-100 text-green-700', icon: Headphones, desc: 'Handle calls, SMS, voicemail (legacy)' },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-600', icon: Eye, desc: 'Read-only access to analytics & reports' },
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<{ id: string; role: string } | null>(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'agent', password: '' });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const companyId = user?.companyId;

  const { data: members } = useQuery({
    queryKey: ['team-members', companyId],
    queryFn: async () => (await api.get(`/admin/user/company/${companyId}`)).data.data,
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/admin/user/create', { ...data, companyId })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team-members'] }); setShowModal(false); resetForm(); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      (await api.put(`/admin/user/${id}/role`, { role })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team-members'] }); setEditingRole(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/user/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const resetForm = () => setForm({ email: '', firstName: '', lastName: '', role: 'agent', password: '' });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Role counts
  const roleCounts: Record<string, number> = {};
  (members || []).forEach((m: any) => {
    const r = m.role || 'agent';
    roleCounts[r] = (roleCounts[r] || 0) + 1;
  });

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" /> Team Management
              </h1>
              <p className="text-gray-500 mt-1">Manage team members and role-based access control</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm"
              >
                <UserPlus className="h-4 w-4" /> Invite Member
              </button>
            )}
          </div>

          {/* Role Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {['super_admin', 'admin', 'supervisor', 'agent', 'viewer'].map(role => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const count = roleCounts[role] || (role === 'agent' ? (roleCounts['agent'] || 0) + (roleCounts['user'] || 0) : 0);
              return (
                <div key={role} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{cfg.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Permission Matrix */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" /> Permission Matrix
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-5 py-2.5 font-medium text-gray-600">Permission</th>
                    {['Viewer', 'Agent', 'Supervisor', 'Admin', 'Super Admin'].map(r => (
                      <th key={r} className="text-center px-3 py-2.5 font-medium text-gray-600">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    ['View Analytics', true, true, true, true, true],
                    ['View Billing', true, true, true, true, true],
                    ['Handle Calls/SMS', false, true, true, true, true],
                    ['Manage Voicemail', false, true, true, true, true],
                    ['Monitor Live Calls', false, false, true, true, true],
                    ['Manage Agents', false, false, true, true, true],
                    ['Manage IVR/Campaigns', false, false, true, true, true],
                    ['Manage Users & Roles', false, false, false, true, true],
                    ['Manage Billing/Packages', false, false, false, true, true],
                    ['View Audit Logs', false, false, false, true, true],
                    ['Delete Company', false, false, false, false, true],
                  ].map(([perm, ...roles]) => (
                    <tr key={perm as string} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 text-gray-700 font-medium">{perm as string}</td>
                      {(roles as boolean[]).map((allowed, i) => (
                        <td key={i} className="text-center px-3 py-2.5">
                          {allowed ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-gray-200 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Team Members ({members?.length || 0})
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(members || []).map((member: any) => {
                const cfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.agent;
                const Icon = cfg.icon;
                const isCurrentUser = member.id === user?.id;

                return (
                  <div key={member.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm text-white font-bold">
                        {(member.firstName?.[0] || '').toUpperCase()}{(member.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                          {isCurrentUser && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {editingRole?.id === member.id && editingRole ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingRole.role}
                            onChange={e => setEditingRole({ ...editingRole, role: e.target.value })}
                            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg"
                          >
                            {['viewer', 'agent', 'supervisor', 'admin'].map(r => (
                              <option key={r} value={r}>{ROLE_CONFIG[r]?.label || r}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => updateRoleMutation.mutate({ id: member.id, role: editingRole!.role })}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingRole(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>

                          {isAdmin && !isCurrentUser && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingRole({ id: member.id, role: member.role })}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Change role"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${member.firstName} ${member.lastName} from the team?`))
                                    deleteMutation.mutate(member.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Remove member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      <span className="text-[10px] text-gray-400">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" /> Invite Team Member
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="changeme123"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {['viewer', 'agent', 'supervisor', 'admin'].map(r => (
                    <option key={r} value={r}>{ROLE_CONFIG[r]?.label || r} — {ROLE_CONFIG[r]?.desc}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.email || !form.firstName}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {createMutation.isPending ? 'Creating...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
