'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const STATUS_OPTIONS = ['Active', 'Pending Invitation', 'Suspended', 'Locked', 'Disabled'];

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [entityId, setEntityId] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
const [loadingPermissions, setLoadingPermissions] = useState(false);
const [savingPermissions, setSavingPermissions] = useState(false);
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

      const { data: userData, error: userDataError } = await supabase
  .from('user_entities')
  .select('id, user_id, entity_id, role')
  .eq('entity_id', eid);

if (userDataError) {
  console.error('Failed to load users:', userDataError);
  return;
}
      const { data: accessData } = await supabase
  .from('user_entity_access')
  .select('user_id, org_role, created_at')
  .eq('entity_id', eid);
      const accessMap = new Map(
  (accessData || []).map((a: any) => [
    a.user_id,
    {
      role: a.org_role,
      assigned_at: a.created_at,
    },
  ])
);
      const userIds = (userData || []).map(u => u.user_id);
      const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, email, display_name, platform_role, created_at').in('id', userIds) : { data: [] };
      
      setUsers((userData || []).map(u => {
  const profile = (profiles || []).find(p => p.id === u.user_id);
  const access = accessMap.get(u.user_id);

  return {
    id: u.user_id,
    email: profile?.email || '—',
    display_name: profile?.display_name || 'Unknown User',
    platform_role: profile?.platform_role || null,
    role: access?.role || u.role || 'No role',
    assigned_at: access?.assigned_at,
    status: 'Active',
  };
}));

      const { data: roleData } = await supabase.from('roles').select('id, name').eq('entity_id', eid);
      setRoles(roleData || []);

      const { data: invites } = await supabase.from('invitations').select('*').eq('entity_id', eid).order('created_at', { ascending: false });
      setInvitations(invites || []);
    }
    load();
  }, []);
async function loadUserPermissions(userId: string) {
  if (!entityId) return;

  setLoadingPermissions(true);

  const [{ data: catalogue }, { data: assigned }] = await Promise.all([
    supabase
      .from('permission_catalogue')
      .select('key, category, name, description')
      .order('category')
      .order('name'),

    supabase
      .from('user_entity_permissions')
      .select('permission_key, enabled')
      .eq('user_id', userId)
      .eq('entity_id', entityId),
  ]);

  setPermissions(catalogue || []);

  const map: Record<string, boolean> = {};

  for (const permission of catalogue || []) {
    map[permission.key] = true;
  }

  for (const permission of assigned || []) {
    map[permission.permission_key] = permission.enabled;
  }

  setUserPermissions(map);
  setLoadingPermissions(false);
}
async function saveUserPermissions() {
  if (!editingUser || !entityId) return;

  setSavingPermissions(true);

  const updates = Object.entries(userPermissions).map(
    ([permission_key, enabled]) => ({
      user_id: editingUser,
      entity_id: entityId,
      permission_key,
      enabled,
      assigned_by: null,
      updated_at: new Date().toISOString(),
    })
  );

  const { error } = await supabase
    .from('user_entity_permissions')
    .upsert(updates, {
      onConflict: 'user_id,entity_id,permission_key',
    });

  if (error) {
    console.error('Failed to save permissions:', error);
    setSavingPermissions(false);
    return;
  }

  setSavingPermissions(false);
}

  async function assignRole(userId: string) {
  if (!selectedRole || !entityId) return;

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('role_permissions')
    .eq('entity_id', entityId)
    .eq('name', selectedRole)
    .single();

  if (roleError || !role) {
    console.error('Failed to load role permissions:', roleError);
    return;
  }

  const permissions = (role.role_permissions || []) as string[];

  const permissionUpdates = permissions.map(permissionKey => ({
    user_id: userId,
    entity_id: entityId,
    permission_key: permissionKey,
    enabled: true,
    assigned_by: null,
    updated_at: new Date().toISOString(),
  }));

  if (permissionUpdates.length) {
    const { error: permissionError } = await supabase
      .from('user_entity_permissions')
      .upsert(permissionUpdates, {
        onConflict: 'user_id,entity_id,permission_key',
      });

    if (permissionError) {
      console.error('Failed to apply role permissions:', permissionError);
      return;
    }
  }

  const { error: accessError } = await supabase
    .from('user_entity_access')
    .upsert(
      {
        user_id: userId,
        entity_id: entityId,
        role: selectedRole,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,entity_id' }
    );

  if (accessError) {
    console.error('Failed to assign role:', accessError);
    return;
  }

  setUsers(users.map(u =>
    u.id === userId ? { ...u, role: selectedRole } : u
  ));

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
                <td className="py-2.5 px-4 text-white font-light">{u.display_name || '—'}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{u.email}</td>
                <td className="py-2.5 px-4">
                  {editingUser === u.id ? (
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="rounded border border-white/[0.08] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-white outline-none">
                      <option value="">Select...</option>{roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                    </select>
                  ) : (<span className="text-xs text-zinc-400">{u.role}</span>)}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : u.status === 'Pending Invitation' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{u.status}</span>
                </td>
                <td className="py-2.5 px-4 text-xs text-zinc-500">{u.created_at
  ? new Date(u.created_at).toLocaleDateString()
  : '—'}</td>
                <td className="py-2.5 px-4 text-right">
                  {editingUser === u.id ? (
                    <button onClick={() => assignRole(u.id)} className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
                  ) : (
                    <button
  onClick={() => {
    setEditingUser(u.id);
    setSelectedRole(u.role !== 'No role' ? u.role : '');
    loadUserPermissions(u.id);
  }}
  className="text-xs text-zinc-500 hover:text-white"
>
  Edit
</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
{editingUser && (
  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <div>
        <p className="text-sm font-medium text-white">User Permissions</p>
        <p className="text-xs text-zinc-500 mt-1">
          All permissions are enabled by default. Turn off anything this user should not access.
        </p>
      </div>

      <button
        onClick={() => {
          setEditingUser(null);
          setUserPermissions({});
        }}
        className="text-xs text-zinc-500 hover:text-white"
      >
        Close
      </button>
    </div>

    {loadingPermissions ? (
      <div className="p-6 text-sm text-zinc-500">
        Loading permissions...
      </div>
    ) : (
      <div className="p-5 space-y-6">
        {['financial', 'leasing', 'operations', 'admin'].map(category => {
          const categoryPermissions = permissions.filter(
            p => p.category === category
          );

          if (!categoryPermissions.length) return null;

          return (
            <div key={category}>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">
                {category === 'admin'
                  ? 'Administration'
                  : category}
              </p>

              <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06]">
                {categoryPermissions.map(permission => {
                  const enabled =
                    userPermissions[permission.key] !== false;

                  return (
                    <div
                      key={permission.key}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-white">
                          {permission.name}
                        </p>

                        {permission.description && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {permission.description}
                          </p>
                        )}
                      </div>

                      <button
  type="button"
  onClick={() =>
    setUserPermissions(prev => ({
      ...prev,
      [permission.key]: !enabled,
    }))
  }
  className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
    enabled ? 'bg-emerald-500' : 'bg-zinc-700'
  }`}
  aria-label={`${permission.name}: ${
    enabled ? 'enabled' : 'disabled'
  }`}
>
  <span
    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
      enabled ? 'translate-x-5' : 'translate-x-0'
    }`}
  />
</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => {
              setEditingUser(null);
              setUserPermissions({});
            }}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={saveUserPermissions}
            disabled={savingPermissions}
            className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-50"
          >
            {savingPermissions ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    )}
  </div>
)}
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
            <div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Invite User</p><button onClick={() => setShowInvite(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="space-y-4">
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"><option value="">Select role...</option>{roles.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}</select>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Expires In</label>
                  <select value={inviteExpiry} onChange={(e) => setInviteExpiry(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none">
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
