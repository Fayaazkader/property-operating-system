'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function ReconciliationPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [reconSupplier, setReconSupplier] = useState('');
  const [reconLines, setReconLines] = useState('');
  const [reconResult, setReconResult] = useState<any>(null);
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

  async function handleReconcile() {
    if (!reconSupplier || !reconLines) return;
    const lines = reconLines.split('\n').filter((l: string) => l.trim()).map((l: string) => { const parts = l.split(',').map((p: string) => p.trim()); return { date: parts[0] || '', description: parts[1] || '', debit: parseFloat(parts[2]) || 0, credit: parseFloat(parts[3]) || 0 }; });
    const result = await apApi.getSupplierLedger(reconSupplier);
    setReconResult({ ledger: result, statementLines: lines });
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Reconciliation</h1>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <select value={reconSupplier} onChange={(e) => setReconSupplier(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none">
          <option value="">Select supplier...</option>
          {suppliers.map((s: any) => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}
        </select>
        <textarea value={reconLines} onChange={(e) => setReconLines(e.target.value)} placeholder="Paste statement lines: date, description, debit, credit" rows={6} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
        <button onClick={handleReconcile} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Compare</button>
      </div>
      {reconResult && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
          <p className="text-xs text-zinc-400">Ledger has {reconResult.ledger?.invoices?.length || 0} invoices · Statement has {reconResult.statementLines?.length || 0} lines</p>
        </div>
      )}
    </div>
  );
}
