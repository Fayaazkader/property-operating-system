'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cashbookPostingService } from "@/lib/cashbook/posting-service";
import { logAudit } from "@/lib/audit/audit-log";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { exportToCSV } from "@/lib/utils";
import { permissionService } from '@/lib/rbac/permission-service';

type Transaction = {
  id: string; transaction_date: string; transaction_description: string;
  transaction_amount: number; transaction_reference: string;
  allocation_status: string; queue: string;
  matched_tenant_id: string; matched_invoice_id: string; matched_tenant_name?: string; matched_tenant_code?: string; matched_property_name?: string; matched_entity_name?: string; matched_gl_code?: string;
  matched_journal_id?: string; confidence: number; is_reconciled: boolean;
};

type SortField = 'date' | 'description' | 'amount' | 'status' | 'confidence' | 'reference';
type SortDir = 'asc' | 'desc';

export default function AccountWorkspacePage() {
  const params = useParams(); const router = useRouter();
  const accountId = params?.accountId as string;
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeQueue, setActiveQueue] = useState<"ready" | "review" | "exceptions" | "posted">("ready");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [postingResult, setPostingResult] = useState<{ posted: number; failed: number } | null>(null);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => { if (!accountId) return; loadData(); }, [accountId]);
  
  async function loadData() {
    const { data: acc } = await supabase.from("bank_accounts").select("*").eq("id", accountId).single();
    if (acc) setAccount(acc);
    const { data: txs } = await supabase.from("bank_transactions").select("*").eq("bank_account_id", accountId).order("transaction_date", { ascending: false }).limit(300);
    if (txs) setTransactions(txs as Transaction[]);
    setLoading(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  async function handlePostTransaction(tx: Transaction) {
  setLoading(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id || !account?.entity_id) {
      alert('Unable to verify your access.');
      return;
    }

    const permission = await permissionService.can(
      session.user.id,
      account.entity_id,
      'financial.post'
    );

    if (!permission.allowed) {
      alert('You do not have permission to post financial transactions.');
      return;
    }

    const result = await cashbookPostingService.postTransaction(tx.id);

    if (result.success) {
      await logAudit({
        action: 'update',
        resource_type: 'transaction',
        resource_id: tx.id,
        resource_label: `Posted ${tx.transaction_description}`,
        old_values: { status: tx.allocation_status },
        new_values: {
          status: 'posted',
          journalId: result.journalId,
        },
      });
    }

    await loadData();
  } finally {
    setLoading(false);
  }
}

  async function handlePostAllReady() {
  setLoading(true);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id || !account?.entity_id) {
      alert('Unable to verify your access.');
      return;
    }

    const permission = await permissionService.can(
      session.user.id,
      account.entity_id,
      'financial.post'
    );

    if (!permission.allowed) {
      alert('You do not have permission to post financial transactions.');
      return;
    }

    const result = await cashbookPostingService.postReadyTransactions(
      account.entity_id,
      accountId
    );

    setPostingResult(result);
    await loadData();
  } finally {
    setLoading(false);
  }
}

  function manualAllocateUrl(tx: Transaction) {
    return `/financials/cash-book/${accountId}/allocate/${tx.id}`;
  }

  let filtered = transactions.filter(tx => {
    if (searchTerm) { const q = searchTerm.toLowerCase(); if (!tx.transaction_description?.toLowerCase().includes(q) && !tx.transaction_reference?.toLowerCase().includes(q)) return false; }
    if (activeQueue === "ready") return tx.allocation_status === "fully_allocated";
    if (activeQueue === "review") return tx.allocation_status === "unallocated";
    if (activeQueue === "exceptions") return tx.allocation_status === "posting_failed" || tx.queue === "exceptions";
    if (activeQueue === "posted") return tx.allocation_status === "posted" || tx.queue === "posted";
    return true;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') cmp = a.transaction_date?.localeCompare(b.transaction_date || '') || 0;
    else if (sortField === 'description') cmp = (a.transaction_description || '').localeCompare(b.transaction_description || '');
    else if (sortField === 'amount') cmp = Math.abs(a.transaction_amount) - Math.abs(b.transaction_amount);
    else if (sortField === 'status') cmp = (a.allocation_status || '').localeCompare(b.allocation_status || '');
    else if (sortField === 'confidence') cmp = (a.confidence || 0) - (b.confidence || 0);
    else if (sortField === 'reference') cmp = (a.transaction_reference || '').localeCompare(b.transaction_reference || '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const readyCount = transactions.filter(t => t.allocation_status === 'fully_allocated').length;
  const reviewCount = transactions.filter(t => t.queue === 'review' || t.allocation_status === 'allocated' || t.allocation_status === 'unallocated').length;
  const exceptionCount = transactions.filter(t => t.allocation_status === 'posting_failed' || t.queue === 'exceptions').length;
  const postedCount = transactions.filter(t => t.allocation_status === 'posted' || t.queue === 'posted').length;
  const statementBalance = account?.statement_balance || 0;
  const bookBalance = account?.current_balance || 0;
  const difference = Math.abs(statementBalance - bookBalance);
  const allPosted = transactions.length > 0 && transactions.every(t => t.allocation_status === 'posted');

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/financials/cash-book')} className="text-xs text-zinc-500 hover:text-white mb-2">← All Accounts</button>
          <PageHeader title={account?.account_name || 'Cash Book'} subtitle={`${account?.bank_name || ''} · ${account?.account_number || ''}`} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(transactions, `cashbook-${account?.account_name || 'export'}`)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Export</button>
          <button onClick={handlePostAllReady} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Post Allocated Transactions</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Statement Balance</p><p className="text-lg font-light text-white mt-1">R{statementBalance.toLocaleString()}</p></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Book Balance</p><p className="text-lg font-light text-white mt-1">R{bookBalance.toLocaleString()}</p></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Difference</p><p className={`text-lg font-light mt-1 ${difference < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>R{difference.toLocaleString()}</p></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Ready to Close</p><p className={`text-lg font-light mt-1 ${allPosted ? 'text-emerald-400' : 'text-amber-400'}`}>{allPosted ? 'Yes' : `${transactions.filter(t => t.allocation_status !== 'posted').length} pending`}</p></div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ label: 'Ready', count: readyCount, color: 'text-emerald-400' }, { label: 'Review', count: reviewCount, color: 'text-blue-400' }, { label: 'Exceptions', count: exceptionCount, color: 'text-amber-400' }, { label: 'Posted', count: postedCount, color: 'text-zinc-400' }].map(q => (
          <div key={q.label} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 text-center"><p className={`text-lg font-light ${q.color}`}>{q.count}</p><p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{q.label}</p></div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search transactions..." className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-white outline-none" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>}
        </div>
        <div className="flex gap-1">
          {(["ready", "review", "exceptions", "posted"] as const).map(q => (
            <button key={q} onClick={() => setActiveQueue(q)} className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${activeQueue === q ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{q}</button>
          ))}
        </div>
      </div>

      {postingResult && (
        <div className={`rounded-xl border p-4 ${postingResult.failed === 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}><p className="text-sm text-white">Posted: {postingResult.posted} · Failed: {postingResult.failed}</p><button onClick={() => setPostingResult(null)} className="text-xs text-zinc-500 mt-1">Dismiss</button></div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th onClick={() => handleSort('date')} className="text-left py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Date {sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th onClick={() => handleSort('description')} className="text-left py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Description {sortField === 'description' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th onClick={() => handleSort('reference')} className="text-left py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Ref {sortField === 'reference' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th onClick={() => handleSort('amount')} className="text-right py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Amount {sortField === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th onClick={() => handleSort('confidence')} className="text-center py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Conf {sortField === 'confidence' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th onClick={() => handleSort('status')} className="text-center py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th className="text-right py-3 px-2 text-[11px] font-medium text-zinc-500 uppercase">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors cursor-pointer" onClick={async () => { if (tx.matched_tenant_id) { const { data: t } = await supabase.from('tenants').select('code, entity_id').eq('id', tx.matched_tenant_id).single(); const { data: l } = await supabase.from('leases').select('property_id').eq('tenant_id', tx.matched_tenant_id).eq('lease_status', 'Active').single(); const { data: p } = l ? await supabase.from('properties').select('property_name').eq('id', l.property_id).single() : { data: null }; const { data: e } = t ? await supabase.from('entities').select('entity_name').eq('id', t.entity_id).single() : { data: null }; setSelectedTx({ ...tx, matched_tenant_code: t?.code, matched_property_name: p?.property_name, matched_entity_name: e?.entity_name }); } else { setSelectedTx(tx); } }}>
                <td className="px-2 py-2 text-white text-xs">{tx.transaction_date}</td>
                <td className="px-2 py-2 text-white text-xs">{tx.transaction_description}</td>
                <td className="px-2 py-2 text-zinc-500 text-xs font-mono">{tx.transaction_reference || "—"}</td>
                <td className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${tx.transaction_amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{tx.transaction_amount >= 0 ? '+' : '−'}R{Math.abs(tx.transaction_amount).toLocaleString()}</td>
                <td className="px-2 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${tx.confidence >= 90 ? "bg-emerald-500/10 text-emerald-300" : tx.confidence >= 60 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"}`}>{tx.confidence || 0}%</span></td>
                <td className="px-2 py-2 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${tx.allocation_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : tx.allocation_status === 'posting_failed' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>{tx.allocation_status || tx.queue}</span></td>
                <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {tx.allocation_status === 'posted' ? (
                      <>
                        <button onClick={() => router.push(`/financials?journal=${tx.matched_journal_id || ''}`)} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[10px] text-white hover:border-white/20">View</button>
                        <button onClick={() => router.push(`/financials/cash-book/${accountId}/allocate/${tx.id}`)} className="rounded-lg border border-amber-500/20 text-amber-400 px-2 py-1 text-[10px] hover:border-amber-500/40">Reverse</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => router.push(manualAllocateUrl(tx))} className="rounded-lg border border-white/[0.08] px-2 py-1 text-[10px] text-white hover:border-white/20">Allocate</button>
                    {tx.allocation_status === 'fully_allocated' && (
                      <button onClick={async () => { await handlePostTransaction(tx); await loadData(); }} className="rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-black hover:bg-gray-100">Post</button>
                    )}
                        {(tx.allocation_status === 'ready_to_post' || tx.allocation_status === 'posting_failed') && (
                          <button onClick={() => handlePostTransaction(tx)} className="rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-black hover:bg-gray-100">Post</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
                        {selectedTx && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium text-white">Transaction Detail</p>
                <button onClick={() => setSelectedTx(null)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-2">Bank Transaction</p>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-2">
                    <div className="flex justify-between"><span className="text-xs text-zinc-500">Date</span><span className="text-sm text-white">{selectedTx.transaction_date}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-zinc-500">Description</span><span className="text-sm text-white text-right max-w-[65%]">{selectedTx.transaction_description}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-zinc-500">Reference</span><span className="text-sm text-white font-mono">{selectedTx.transaction_reference || '—'}</span></div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-2"><span className="text-xs text-zinc-500">Amount</span><span className={`text-lg font-light ${selectedTx.transaction_amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selectedTx.transaction_amount >= 0 ? '+' : '−'}R{Math.abs(selectedTx.transaction_amount).toLocaleString()}</span></div>
                  </div>
                </div>

                {selectedTx.matched_tenant_name && (
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase mb-2">Allocated To</p>
                    <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4 space-y-2">
                      <div className="flex justify-between"><span className="text-xs text-zinc-500">Tenant</span><span className="text-sm text-white">{selectedTx.matched_tenant_name}{selectedTx.matched_tenant_code ? ` (${selectedTx.matched_tenant_code})` : ''}</span></div>
                      {selectedTx.matched_property_name && <div className="flex justify-between"><span className="text-xs text-zinc-500">Property</span><span className="text-sm text-white">{selectedTx.matched_property_name}</span></div>}
                      {selectedTx.matched_entity_name && <div className="flex justify-between"><span className="text-xs text-zinc-500">Entity</span><span className="text-sm text-white">{selectedTx.matched_entity_name}</span></div>}
                      {selectedTx.matched_invoice_id && <div className="flex justify-between"><span className="text-xs text-zinc-500">Invoice</span><span className="text-sm text-white font-mono">{selectedTx.matched_invoice_id}</span></div>}
                      <div className="flex justify-between border-t border-emerald-500/10 pt-2"><span className="text-xs text-zinc-500">Method</span><span className="text-sm text-emerald-400">{selectedTx.confidence >= 90 ? 'Auto-matched' : 'Manual'}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-zinc-500">Confidence</span><span className="text-sm text-white">{selectedTx.confidence || 0}%</span></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 uppercase">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedTx.allocation_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' :
                    selectedTx.allocation_status === 'fully_allocated' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>{selectedTx.allocation_status?.replace(/_/g, ' ') || 'unallocated'}</span>
                </div>

                <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
                  {selectedTx.allocation_status === 'fully_allocated' && (
                    <button onClick={async () => { await handlePostTransaction(selectedTx); setSelectedTx(null); await loadData(); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-gray-100">Post</button>
                  )}
                  {selectedTx.allocation_status === 'posted' && (
                    <button onClick={() => { setSelectedTx(null); router.push(`/financials/cash-book/${accountId}/allocate/${selectedTx.id}`); }} className="rounded-lg border border-amber-500/20 text-amber-400 px-3 py-1.5 text-xs hover:border-amber-500/40">Reverse</button>
                  )}
                  {selectedTx.allocation_status !== 'posted' && (
                    <button onClick={() => { setSelectedTx(null); router.push(`/financials/cash-book/${accountId}/allocate/${selectedTx.id}`); }} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white hover:border-white/20">Manual Allocate</button>
                  )}
                  <button onClick={() => setSelectedTx(null)} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white hover:border-white/20">Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
