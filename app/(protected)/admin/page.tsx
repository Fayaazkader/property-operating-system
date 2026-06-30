'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { Plus, Search, Mail, Shield, CheckCircle } from "lucide-react";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newEntity, setNewEntity] = useState("");
  const [newRole, setNewRole] = useState("entity_admin");
  const [created, setCreated] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userList } = await supabase.from("profiles").select("*, user_entity_access(entity_id, org_role, entities(entity_name))").order("created_at", { ascending: false });
      const { data: entityList } = await supabase.from("entities").select("id, entity_name").order("entity_name");
      setUsers(userList || []);
      setEntities(entityList || []);
      setLoading(false);
    }
    load();
  }, [created]);

  const handleCreateUser = async () => {
    if (!newEmail || !newName || !newEntity) return;

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: newEmail,
      email_confirm: true,
      user_metadata: { display_name: newName },
    });

    if (authError || !authUser?.user) {
      alert("Failed to create user: " + (authError?.message || "Unknown error"));
      return;
    }

    // Create profile
    await supabase.from("profiles").upsert({
      id: authUser.user.id,
      email: newEmail,
      display_name: newName,
      platform_role: "user",
      first_login: true,
    });

    // Assign to entity
    await supabase.from("user_entity_access").insert({
      user_id: authUser.user.id,
      entity_id: newEntity,
      org_role: newRole,
    });

    setNewEmail("");
    setNewName("");
    setNewEntity("");
    setCreated(!created);
    setShowCreate(false);
  };

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return u.email?.toLowerCase().includes(term) || u.display_name?.toLowerCase().includes(term);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Administration</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{users.length} users</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Create Beta User</p>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Full Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Smith" className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@company.com" className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Entity</label>
                <select value={newEntity} onChange={(e) => setNewEntity(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]">
                  <option value="">Select entity...</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.entity_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]">
                  <option value="entity_admin">Entity Admin</option>
                  <option value="finance">Finance</option>
                  <option value="property_manager">Property Manager</option>
                  <option value="read_only">Read Only</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="rounded-2xl border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Cancel</button>
              <button onClick={handleCreateUser} className="rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">Create User</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]" />
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => (<div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"><div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3"></div></div>))}</div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">User</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Entity</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Role</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u: any) => (
                <tr key={u.id} className="border-b border-[var(--border-default)] last:border-0">
                  <td className="py-2.5 px-4">
                    <p className="text-[var(--text-primary)] font-medium">{u.display_name || u.email}</p>
                    <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)] text-xs">
                    {u.user_entity_access?.map((a: any, i: number) => (
                      <span key={i} className="block">{a.entities?.entity_name || "—"}</span>
                    )) || "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                      {u.platform_role === 'platform_admin' ? 'Admin' : u.user_entity_access?.[0]?.org_role || "User"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    {u.user_entity_access?.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
