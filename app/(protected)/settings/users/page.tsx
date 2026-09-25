'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEntityContext } from '@/app/context/EntityContext';

type EntityUser = {
  id: string;
  email: string;
  display_name: string;
  platform_role: string | null;
  role_id: string | null;
  role_name: string;
  org_role: string;
  created_at: string | null;
  status: string;
};

type Role = {
  id: string;
  name: string;
};

type Permission = {
  key: string;
  category: string;
  name: string;
  description: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
};

export default function UsersPage() {
  const supabase = createClient();

  const {
    activeEntityId,
    availableEntities,
    loading: entityLoading,
  } = useEntityContext();

  const [users, setUsers] = useState<EntityUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [userPermissions, setUserPermissions] = useState<
    Record<string, boolean>
  >({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('7');

  const activeEntity = availableEntities.find(
    (entity) => entity.entity_id === activeEntityId,
  );

  const resetEditor = useCallback(() => {
    setEditingUser(null);
    setSelectedRoleId('');
    setUserPermissions({});
    setPermissions([]);
  }, []);

  const loadEntityData = useCallback(async () => {
    if (!activeEntityId) {
      setUsers([]);
      setRoles([]);
      setInvitations([]);
      setPageError(null);
      return;
    }

    setLoading(true);
    setPageError(null);

    try {
      const { data: accessData, error: accessError } = await supabase
        .from('user_entity_access')
        .select('user_id, role_id, org_role, created_at')
        .eq('entity_id', activeEntityId)
        .order('created_at', { ascending: true });

      if (accessError) {
        throw accessError;
      }

      const memberships = accessData || [];
      const userIds = memberships.map((membership) => membership.user_id);

      const [profilesResult, rolesResult, invitationsResult] =
        await Promise.all([
          userIds.length
            ? supabase
                .from('profiles')
                .select(
                  'id, email, display_name, platform_role, created_at',
                )
                .in('id', userIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('roles')
            .select('id, name')
            .eq('entity_id', activeEntityId)
            .order('name'),
          supabase
            .from('invitations')
            .select('id, email, role, status, expires_at')
            .eq('entity_id', activeEntityId)
            .order('created_at', { ascending: false }),
        ]);

      if (profilesResult.error) {
        throw profilesResult.error;
      }

      if (rolesResult.error) {
        throw rolesResult.error;
      }

      if (invitationsResult.error) {
        throw invitationsResult.error;
      }

      const profileMap = new Map(
        (profilesResult.data || []).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      const roleMap = new Map(
        (rolesResult.data || []).map((role) => [role.id, role.name]),
      );

      setUsers(
        memberships.map((membership) => {
          const profile = profileMap.get(membership.user_id);

          return {
            id: membership.user_id,
            email: profile?.email || '—',
            display_name: profile?.display_name || 'Unknown User',
            platform_role: profile?.platform_role || null,
            role_id: membership.role_id,
            role_name: membership.role_id
              ? roleMap.get(membership.role_id) || membership.org_role
              : membership.org_role || 'No role',
            org_role: membership.org_role,
            created_at: membership.created_at,
            status: 'Active',
          };
        }),
      );

      setRoles(rolesResult.data || []);
      setInvitations(invitationsResult.data || []);
    } catch (error) {
      console.error('Failed to load entity users:', error);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to load users for this entity.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeEntityId, supabase]);

  useEffect(() => {
    resetEditor();
    void loadEntityData();
  }, [activeEntityId, loadEntityData, resetEditor]);

  async function loadUserPermissions(userId: string) {
    if (!activeEntityId) return;

    setLoadingPermissions(true);
    setPageError(null);

    try {
      const [catalogueResult, assignedResult] = await Promise.all([
        supabase
          .from('permission_catalogue')
          .select('key, category, name, description')
          .order('category')
          .order('name'),
        supabase
          .from('user_entity_permissions')
          .select('permission_key, enabled')
          .eq('user_id', userId)
          .eq('entity_id', activeEntityId),
      ]);

      if (catalogueResult.error) {
        throw catalogueResult.error;
      }

      if (assignedResult.error) {
        throw assignedResult.error;
      }

      const catalogue = catalogueResult.data || [];
      const map: Record<string, boolean> = {};

      for (const permission of catalogue) {
        map[permission.key] = false;
      }

      for (const permission of assignedResult.data || []) {
        map[permission.permission_key] = permission.enabled;
      }

      setPermissions(catalogue);
      setUserPermissions(map);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to load user permissions.',
      );
    } finally {
      setLoadingPermissions(false);
    }
  }

  async function beginEditing(user: EntityUser) {
    if (!activeEntityId) return;

    setEditingUser(user.id);
    setSelectedRoleId(user.role_id || '');
    await loadUserPermissions(user.id);
  }

  async function saveUserPermissions() {
    if (!editingUser || !activeEntityId) return;

    setSavingPermissions(true);
    setPageError(null);

    try {
      const { error } = await supabase.rpc(
        'set_entity_user_permissions',
        {
          p_entity_id: activeEntityId,
          p_target_user_id: editingUser,
          p_permissions: userPermissions,
          p_user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      );

      if (error) {
        throw error;
      }

      await loadUserPermissions(editingUser);
    } catch (error) {
      console.error('Failed to save permissions:', error);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to save permissions.',
      );
    } finally {
      setSavingPermissions(false);
    }
  }

  async function assignRole(userId: string) {
    if (!selectedRoleId || !activeEntityId) return;

    setSavingRole(true);
    setPageError(null);

    try {
      const { error } = await supabase.rpc(
        'assign_entity_user_role',
        {
          p_entity_id: activeEntityId,
          p_target_user_id: userId,
          p_role_id: selectedRoleId,
          p_user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      );

      if (error) {
        throw error;
      }

      await loadEntityData();
      await loadUserPermissions(userId);

      setEditingUser(userId);
      setSelectedRoleId(selectedRoleId);
    } catch (error) {
      console.error('Failed to assign role:', error);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to assign role.',
      );
    } finally {
      setSavingRole(false);
    }
  }

  async function handleInvite() {
    if (
      !inviteEmail.trim() ||
      !inviteRole ||
      !activeEntityId
    ) {
      return;
    }

    setPageError(null);

    try {
      const days = parseInt(inviteExpiry, 10) || 7;

      const { error } = await supabase
        .from('invitations')
        .insert({
          entity_id: activeEntityId,
          email: inviteEmail.trim(),
          role: inviteRole,
          token: crypto.randomUUID(),
          status: 'pending',
          expires_at: new Date(
            Date.now() + days * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      if (error) {
        throw error;
      }

      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('');

      await loadEntityData();
    } catch (error) {
      console.error('Failed to create invitation:', error);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to create invitation.',
      );
    }
  }

  if (entityLoading) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-zinc-500">
          Loading entity access...
        </p>
      </div>
    );
  }

  if (!activeEntityId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            Users & Roles
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            User administration is entity-specific.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-sm text-white">
            Select an entity to manage its users.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Portfolio-wide scope cannot be used to grant roles or
            permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            Users & Roles
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage user access for{' '}
            <span className="text-zinc-300">
              {activeEntity?.entity_name || 'selected entity'}
            </span>
            .
          </p>
        </div>

        <button
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all"
        >
          + Invite User
        </button>
      </div>

      {pageError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs text-red-300">{pageError}</p>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                User
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                Email
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                Role
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                Status
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                Member Since
              </th>
              <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-4 text-center text-sm text-zinc-500"
                >
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-4 text-center text-sm text-zinc-500"
                >
                  No users are assigned to this entity.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-white/[0.03]"
                >
                  <td className="py-2.5 px-4 text-white font-light">
                    {user.display_name || '—'}
                  </td>

                  <td className="py-2.5 px-4 text-zinc-400 text-xs">
                    {user.email}
                  </td>

                  <td className="py-2.5 px-4">
                    {editingUser === user.id ? (
                      <select
                        value={selectedRoleId}
                        onChange={(event) =>
                          setSelectedRoleId(event.target.value)
                        }
                        className="rounded border border-white/[0.08] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-white outline-none"
                      >
                        <option value="">Select...</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {user.role_name}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-4">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      {user.status}
                    </span>
                  </td>

                  <td className="py-2.5 px-4 text-xs text-zinc-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : '—'}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    {editingUser === user.id ? (
                      <button
                        onClick={() => assignRole(user.id)}
                        disabled={!selectedRoleId || savingRole}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                      >
                        {savingRole ? 'Saving...' : 'Save Role'}
                      </button>
                    ) : (
                      <button
                        onClick={() => void beginEditing(user)}
                        className="text-xs text-zinc-500 hover:text-white"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white">
                User Permissions
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Permissions are denied by default. Enable only the access
                this user requires.
              </p>
            </div>

            <button
              onClick={resetEditor}
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
              {['financial', 'leasing', 'operations', 'admin'].map(
                (category) => {
                  const categoryPermissions = permissions.filter(
                    (permission) =>
                      permission.category === category,
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
                        {categoryPermissions.map((permission) => {
                          const enabled =
                            userPermissions[permission.key] === true;

                          return (
                            <div
                              key={permission.key}
                              className="flex items-center justify-between gap-6 px-4 py-3"
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
                                  setUserPermissions((previous) => ({
                                    ...previous,
                                    [permission.key]: !enabled,
                                  }))
                                }
                                className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
                                  enabled
                                    ? 'bg-emerald-500'
                                    : 'bg-zinc-700'
                                }`}
                                aria-label={`${permission.name}: ${
                                  enabled ? 'enabled' : 'disabled'
                                }`}
                              >
                                <span
                                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                    enabled
                                      ? 'translate-x-5'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetEditor}
                  className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={saveUserPermissions}
                  disabled={savingPermissions}
                  className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-50"
                >
                  {savingPermissions
                    ? 'Saving...'
                    : 'Save Permissions'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {invitations.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">
            Pending Invitations
          </p>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">
                    Expires
                  </th>
                </tr>
              </thead>

              <tbody>
                {invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="border-b border-white/[0.03]"
                  >
                    <td className="py-2.5 px-4 text-white font-light text-xs">
                      {invitation.email}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">
                      {invitation.role}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          invitation.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400'
                            : invitation.status === 'accepted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {invitation.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-zinc-500">
                      {new Date(
                        invitation.expires_at,
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvite && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInvite(false)}
          />

          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div
              className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium text-white">
                  Invite User
                </p>
                <button
                  onClick={() => setShowInvite(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <input
                  value={inviteEmail}
                  onChange={(event) =>
                    setInviteEmail(event.target.value)
                  }
                  placeholder="Email address"
                  className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"
                />

                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value)
                  }
                  className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"
                >
                  <option value="">Select role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
                    Expires In
                  </label>
                  <select
                    value={inviteExpiry}
                    onChange={(event) =>
                      setInviteExpiry(event.target.value)
                    }
                    className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>

                <button
                  onClick={handleInvite}
                  className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
