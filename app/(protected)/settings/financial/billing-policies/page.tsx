'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function BillingPoliciesPage() {
  const [entityId, setEntityId] = useState('');
  const [policies, setPolicies] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    lease_fee_amount: 1500,
    lease_fee_description: 'Standard Commercial Lease Fee',
    late_payment_fee_pct: 10,
    late_payment_fee_description: 'Late Payment Fee',
    deposit_months: 1,
    billing_day: 25,
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);

      const { data } = await supabase.from('billing_policies').select('*').eq('entity_id', entities[0]).eq('scope', 'entity').single();
      if (data) {
        setPolicies(data);
        setForm({
          lease_fee_amount: data.lease_fee_amount || 1500,
          lease_fee_description: data.lease_fee_description || 'Standard Commercial Lease Fee',
          late_payment_fee_pct: data.late_payment_fee_pct || 10,
          late_payment_fee_description: data.late_payment_fee_description || 'Late Payment Fee',
          deposit_months: data.deposit_months || 1,
          billing_day: data.billing_day || 25,
        });
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleSave() {
    setSaving(true);
    await supabase.from('billing_policies').upsert({
      entity_id: entityId,
      scope: 'entity',
      ...form,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id,scope' });
    setSaving(false);
  }

  if (loading) return null;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-sm text-zinc-500 hover:text-white">← Settings</Link>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Billing Policies</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Lease Fee</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Amount (R)</label>
              <input type="number" value={form.lease_fee_amount} onChange={(e) => setForm({ ...form, lease_fee_amount: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Description</label>
              <input type="text" value={form.lease_fee_description} onChange={(e) => setForm({ ...form, lease_fee_description: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Late Payment Fee</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Percentage (%)</label>
              <input type="number" value={form.late_payment_fee_pct} onChange={(e) => setForm({ ...form, late_payment_fee_pct: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Description</label>
              <input type="text" value={form.late_payment_fee_description} onChange={(e) => setForm({ ...form, late_payment_fee_description: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Deposit & Billing</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Deposit (months)</label>
              <input type="number" value={form.deposit_months} onChange={(e) => setForm({ ...form, deposit_months: parseInt(e.target.value) || 1 })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Billing Day</label>
              <input type="number" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: parseInt(e.target.value) || 25 })} min={1} max={28} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
          {saving ? 'Saving...' : 'Save Policies'}
        </button>
      </div>
    </div>
  );
}
