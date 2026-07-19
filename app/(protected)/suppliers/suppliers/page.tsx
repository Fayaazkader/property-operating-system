'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SuppliersListPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const { data } = await supabase.from('suppliers').select('*').eq('entity_id', entities[0]).order('supplier_name');
      setSuppliers(data || []);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Suppliers</h1>
        <Link href="/suppliers/suppliers/new" className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Supplier</Link>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Contact</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>{suppliers.map((s: any) => (<tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer" onClick={() => window.location.href = `/suppliers/suppliers/${s.id}`}><td className="py-2.5 px-4 text-white font-light">{s.supplier_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.email || s.phone || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.vat_number || '—'}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
