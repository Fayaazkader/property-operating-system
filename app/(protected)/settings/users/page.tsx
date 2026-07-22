'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const STATUS_OPTIONS = ['Active', 'Pending Invitation', 'Suspended', 'Locked', 'Disabled'];

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [entityId, setEntityId] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('7');
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      const eid = entities[0]; setEntityId(eid);

      const { data: userData } = await supabase.from('user_entities').select('id, user_id, joined_at').eq('entity_id', eid);
      const { data: accessData } = await supabase.from('user_entity_access').select('user_id, role, assigned_at').eq('entity_id', eid);
      const accessMap = new Map((accessData || []).map((a: any) => [a.user_id, { role: a.role, assigned_at: a.assigned_at }]));
      const userIds = (userData || []).map(u => u.user_id);
      const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, email, full_name, last_active_at, created_at').in('id', userIds) : { data: [] };
      
      setUsers((profiles || []).map(p => ({
        ...p, role: accessMap.get(p.id)?.role || 'No role',
        assigned_at: accessMap.get(p.id)?.assigned_at,
        status: 'Active',
      })));

      const { data: roleData } = await supabase.from('roles').select('id, name').eq('entity_id', eid);
      setRoles(roleData || []);

      const { data: invites } = await supabase.from('invitations').select('*').eq('entity_id', eid).order('created_at', { ascending: false });
      setInvitations(invites || []);
    }
    load();
  }, []);

  async function assignRole(userId: string) {
    if (!selectedRole || !entityId) return;
    await supabase.from('user_entity_access').upsert({ user_id: userId, entity_id: entityId, role: selectedRole, assigned_at: new Date().toISOString() }, { onConflict: 'user_id,entity_id' });
    setUsers(users.map(u => u.id === userId ? { ...u, role: selectedRole } : u));
    setEditingUser(null);
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteRole || !entityId) return;
    const days = parseInt(inviteExpiry) || 7;
    await supabase.from('invitations').insert({
      entity_id: entityId, email: inviteEmail, role: inviteRole,
      token: crypto.randomUUID(), status: 'pending',
      expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    });
    setShowInvite(false); setInviteEmail(''); setInviteRole('');
    const { data: invites } = await supabase.from('invitations').select('*').eq('entity_id', entityId).order('created_at', { ascending: false });
    setInvitations(invites || []);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Users & Roles</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage user access, roles, and invitations.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">+ Invite User</button>
      </div>

      {/* Active Users */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">User</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Email</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Role</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Last Activity</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Action</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-4 text-white font-light">{u.full_name || '—'}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{u.email}</td>
                <td className="py-2.5 px-4">
                  {editingUser === u.id ? (
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-xs text-white outline-none">
                      <option value="">Select...</option>{roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                    </select>
                  ) : (<span className="text-xs text-zinc-400">{u.role}</span>)}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'Pending Invitation' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{u.status}</span>
                </td>
                <td className="py-2.5 px-4 text-xs text-zinc-500">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}</td>
                <td className="py-2.5 px-4 text-right">
                  {editingUser === u.id ? (
                    <button onClick={() => assignRole(u.id)} className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
                  ) : (
                    <button onClick={() => { setEditingUser(u.id); setSelectedRole(u.role !== 'No role' ? u.role : ''); }} className="text-xs text-zinc-500 hover:text-white">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Pending Invitations</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Email</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Role</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Expires</th></tr></thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} className="border-b border-white/[0.03]">
                    <td className="py-2.5 px-4 text-white font-light text-xs">{inv.email}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.role}</td>
                    <td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : inv.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{inv.status}</span></td>
                    <td className="py-2.5 px-4 text-xs text-zinc-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Invite User</p><button onClick={() => setShowInvite(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="space-y-4">
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select role...</option>{roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}</select>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Expires In</label>
                  <select value={inviteExpiry} onChange={(e) => setInviteExpiry(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
                    <option value="1">1 Day</option><option value="3">3 Days</option><option value="7">7 Days</option><option value="14">14 Days</option><option value="30">30 Days</option>
                  </select>
                </div>
                <button onClick={handleInvite} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Send Invitation</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
