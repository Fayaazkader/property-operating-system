'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ALL_PERMISSIONS = [
  { key: 'admin.users', label: 'Manage Users', category: 'admin' },
  { key: 'admin.roles', label: 'Manage Roles', category: 'admin' },
  { key: 'admin.settings', label: 'Manage Settings', category: 'admin' },
  { key: 'admin.features', label: 'Manage Feature Flags', category: 'admin' },
  { key: 'payments.approve', label: 'Approve Payments', category: 'financial' },
  { key: 'payments.create', label: 'Create Payments', category: 'financial' },
  { key: 'payments.view', label: 'View Payments', category: 'financial' },
  { key: 'invoices.approve', label: 'Approve Supplier Invoices', category: 'financial' },
  { key: 'invoices.post', label: 'Post Supplier Invoices', category: 'financial' },
  { key: 'suppliers.create', label: 'Create Suppliers', category: 'procurement' },
  { key: 'suppliers.edit', label: 'Edit Suppliers', category: 'procurement' },
  { key: 'tenants.create', label: 'Create Tenants', category: 'leasing' },
  { key: 'tenants.edit', label: 'Edit Tenants', category: 'leasing' },
  { key: 'leases.create', label: 'Create Leases', category: 'leasing' },
  { key: 'leases.approve', label: 'Approve Leases', category: 'leasing' },
  { key: 'work_orders.create', label: 'Create Work Orders', category: 'operations' },
  { key: 'work_orders.assign', label: 'Assign Work Orders', category: 'operations' },
  { key: 'commissions.approve', label: 'Approve Commissions', category: 'brokerage' },
  { key: 'reports.view', label: 'View Reports', category: 'reporting' },
  { key: 'reports.export', label: 'Export Reports', category: 'reporting' },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [entityId, setEntityId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data } = await supabase.from('roles').select('*').eq('entity_id', eid);
        setRoles(data || []);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId || !form.name) return;
    await supabase.from('roles').upsert({ entity_id: entityId, name: form.name, description: form.description, role_permissions: form.permissions, is_system: false });
    setShowAdd(false); setForm({ name: '', description: '', permissions: [] });
    const { data } = await supabase.from('roles').select('*').eq('entity_id', entityId);
    setRoles(data || []);
  }

  function togglePerm(perm: string) {
    setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Roles & Permissions</h1><button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Role</button></div>
      <div className="grid gap-3">
        {roles.map(role => (
          <div key={role.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><div className="flex items-center justify-between"><p className="text-sm text-white font-medium">{role.name}</p><span className="text-[10px] text-zinc-500">{role.role_permissions?.length || 0} permissions</span></div>{role.description && <p className="text-xs text-zinc-500 mt-1">{role.description}</p>}</div>
        ))}
      </div>

      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Add Role</p><button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-4"><input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Role Name" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {['admin', 'financial', 'procurement', 'leasing', 'operations', 'brokerage', 'reporting'].map(cat => (
                <div key={cat}><p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{cat}</p>
                  {ALL_PERMISSIONS.filter(p => p.category === cat).map(p => (
                    <label key={p.key} className="flex items-center gap-2 text-xs text-zinc-400 py-0.5"><input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} className="rounded" />{p.label}</label>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={handleSave} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save Role</button></div></div></div>
        </>
      )}
    </div>
  );
}
