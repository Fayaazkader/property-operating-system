'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function BillingPoliciesPage() {
  const [entityId, setEntityId] = useState('');
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    policy_name: '',
    policy_type: 'commercial',
    lease_fee_amount: 1500,
    lease_fee_description: 'Standard Commercial Lease Fee',
    late_payment_type: 'percentage',
    late_payment_value: 10,
    late_payment_description: 'Late Payment Fee',
    deposit_months: 1,
    billing_day: 25,
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);
      await loadPolicies(entities[0]);
      setLoading(false);
    }
    init();
  }, []);

  async function loadPolicies(eid: string) {
    const { data } = await supabase.from('billing_policies').select('*').eq('entity_id', eid).order('policy_type');
    setPolicies(data || []);
  }

  function handleEdit(policy: any) {
    setForm({
      policy_name: policy.policy_name,
      policy_type: policy.policy_type,
      lease_fee_amount: policy.lease_fee_amount,
      lease_fee_description: policy.lease_fee_description || '',
      late_payment_type: policy.late_payment_type,
      late_payment_value: policy.late_payment_value,
      late_payment_description: policy.late_payment_description || '',
      deposit_months: policy.deposit_months,
      billing_day: policy.billing_day,
    });
    setEditingId(policy.id);
    setShowForm(true);
  }

  async function handleSave() {
    const data = { ...form, entity_id: entityId };
    if (editingId) {
      await supabase.from('billing_policies').update(data).eq('id', editingId);
    } else {
      await supabase.from('billing_policies').insert(data);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadPolicies(entityId);
  }

  async function handleDelete(id: string) {
    await supabase.from('billing_policies').delete().eq('id', id);
    await loadPolicies(entityId);
  }

  if (loading) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-sm text-zinc-500 hover:text-white">← Settings</Link>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Billing Policies</h1>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all">
          + New Policy
        </button>
      </div>

      {/* Policy List */}
      <div className="space-y-3">
        {policies.map(policy => (
          <div key={policy.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{policy.policy_name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 capitalize">{policy.policy_type}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-zinc-500">Lease Fee</p>
                    <p className="text-white font-light">R{policy.lease_fee_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Late Payment</p>
                    <p className="text-white font-light">{policy.late_payment_type === 'percentage' ? `${policy.late_payment_value}%` : `R${policy.late_payment_value?.toLocaleString()}`}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Deposit</p>
                    <p className="text-white font-light">{policy.deposit_months} month(s)</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Billing Day</p>
                    <p className="text-white font-light">{policy.billing_day}th</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(policy)} className="text-xs text-zinc-500 hover:text-white">Edit</button>
                <button onClick={() => handleDelete(policy.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-medium text-white mb-6">{editingId ? 'Edit Policy' : 'New Policy'}</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Policy Name</label>
                    <input type="text" value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Type</label>
                    <select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20">
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="retail">Retail</option>
                      <option value="residential">Residential</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Lease Fee</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Amount (R)</label>
                      <input type="number" value={form.lease_fee_amount} onChange={(e) => setForm({ ...form, lease_fee_amount: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Description</label>
                      <input type="text" value={form.lease_fee_description} onChange={(e) => setForm({ ...form, lease_fee_description: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Late Payment Fee</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Type</label>
                      <select value={form.late_payment_type} onChange={(e) => setForm({ ...form, late_payment_type: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20">
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">{form.late_payment_type === 'percentage' ? '%' : 'Amount (R)'}</label>
                      <input type="number" value={form.late_payment_value} onChange={(e) => setForm({ ...form, late_payment_value: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Description</label>
                      <input type="text" value={form.late_payment_description} onChange={(e) => setForm({ ...form, late_payment_description: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Deposit</p>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Months</label>
                    <input type="number" value={form.deposit_months} onChange={(e) => setForm({ ...form, deposit_months: parseInt(e.target.value) || 1 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Billing Calendar</p>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Billing Day (1-28)</label>
                    <input type="number" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: parseInt(e.target.value) || 25 })} min={1} max={28} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100 transition-all">Save Policy</button>
                <button onClick={() => setShowForm(false)} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 hover:text-white transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
