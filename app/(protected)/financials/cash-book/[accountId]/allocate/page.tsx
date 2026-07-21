'use client';

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cashbookService } from "@/lib/cashbook/cashbook-service";

export default function AllocationWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const accountId = params?.accountId as string;
  const txId = searchParams.get("txId") || "";
  const txAmount = parseFloat(searchParams.get("amount") || "0");
  const txDesc = searchParams.get("desc") || "";
  const txRef = searchParams.get("ref") || "";
  const txDate = searchParams.get("date") || "";

  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [allocated, setAllocated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'tenant' | 'supplier'>('all');

  useEffect(() => {
    async function load() {
      // Load tenant invoices
      const { data: tenantInvs } = await supabase
        .from("invoices")
        .select("id, invoice_number, tenant_id, total_amount, payment_status, created_at, leases!inner(tenant_name)")
        .neq("payment_status", "paid")
        .order("total_amount");

      // Load supplier invoices  
      const { data: supplierInvs } = await supabase
        .from("supplier_invoices_new")
        .select("id, invoice_number, supplier_id, total_amount, status, supplier:supplier_id(supplier_name)")
        .eq("lifecycle_status", "posted")
        .order("total_amount");

      const allMatches: any[] = [];

      (tenantInvs || []).forEach((inv: any) => {
        let confidence = 0;
        const reasons: string[] = [];
        const amountDiff = Math.abs((inv.total_amount || 0) - Math.abs(txAmount));
        if (amountDiff < 1) { confidence += 50; reasons.push('Exact amount match'); }
        else if (amountDiff < 100) { confidence += 40; reasons.push('Amount closely matches'); }
        else if (amountDiff < 500) { confidence += 25; reasons.push('Amount within range'); }
        
        const tenantName = inv.leases?.tenant_name || '';
        if (tenantName && txDesc.toLowerCase().includes(tenantName.toLowerCase())) {
          confidence += 20; reasons.push(`Tenant "${tenantName}" in description`);
        }
        
        allMatches.push({
          ...inv, tenant_name: tenantName, match_type: 'tenant',
          confidence, reasons: reasons.slice(0, 3),
        });
      });

      (supplierInvs || []).forEach((inv: any) => {
        let confidence = 0;
        const amountDiff = Math.abs((inv.total_amount || 0) - Math.abs(txAmount));
        if (amountDiff < 1) confidence += 50;
        else if (amountDiff < 100) confidence += 40;
        
        const supplierName = inv.supplier?.supplier_name || '';
        if (supplierName && txDesc.toLowerCase().includes(supplierName.toLowerCase())) {
          confidence += 20;
        }
        
        allMatches.push({
          ...inv, tenant_name: supplierName, match_type: 'supplier',
          confidence, reasons: [`Amount match: ${Math.round(confidence)}%`],
        });
      });

      allMatches.sort((a, b) => b.confidence - a.confidence);
      setMatches(allMatches);
    }
    load();
  }, [txId]);

  async function handleConfirmAllocation() {
    if (!selectedMatch) return;
    setLoading(true);
    const tenantId = selectedMatch.match_type === 'tenant' ? selectedMatch.tenant_id : undefined;
    const supplierId = selectedMatch.match_type === 'supplier' ? selectedMatch.supplier_id : undefined;
    await cashbookService.confirmAllocation(txId, selectedMatch.id, tenantId, supplierId);
    setAllocated(true);
    setLoading(false);
  }

  const filteredMatches = matches.filter(m => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.invoice_number?.toLowerCase().includes(q) && !m.tenant_name?.toLowerCase().includes(q)) return false;
    }
    if (filterType === 'tenant') return m.match_type === 'tenant';
    if (filterType === 'supplier') return m.match_type === 'supplier';
    return true;
  });

  if (allocated) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-6 pt-20 pb-12 text-center">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-3xl font-black text-white mb-2">Allocation Confirmed</h1>
          <p className="text-zinc-400 mb-6">The transaction has been allocated and will be posted to the General Ledger.</p>
          <button onClick={() => router.push(`/financials/cash-book/${accountId}`)} className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-100">Back to Cash Book</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <button onClick={() => router.back()} className="text-xs text-zinc-500 hover:text-white">← Back to Cash Book</button>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Transaction Panel */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Bank Transaction</p>
          <div className="space-y-3">
            <div><p className="text-[10px] text-zinc-600">Date</p><p className="text-sm text-white">{txDate}</p></div>
            <div><p className="text-[10px] text-zinc-600">Description</p><p className="text-sm text-white">{txDesc}</p></div>
            <div><p className="text-[10px] text-zinc-600">Reference</p><p className="text-sm text-white font-mono">{txRef || "—"}</p></div>
            <div><p className="text-[10px] text-zinc-600">Amount</p><p className={`text-2xl font-light ${txAmount >= 0 ? 'text-emerald-400' : 'text-red-400'} tabular-nums`}>R{Math.abs(txAmount).toLocaleString()}</p></div>
          </div>
        </div>

        {/* Matches Panel */}
        <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Match to Invoice</p>
            <div className="flex gap-2">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-1.5 text-xs text-white outline-none w-40" />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                <option value="all">All</option><option value="tenant">Tenant</option><option value="supplier">Supplier</option>
              </select>
            </div>
          </div>

          {filteredMatches.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No matches found. Try adjusting your search.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredMatches.slice(0, 20).map((match) => (
                <button
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    selectedMatch?.id === match.id ? 'border-white/30 bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/10'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{match.invoice_number}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${match.match_type === 'tenant' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{match.match_type}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{match.tenant_name}</p>
                      {match.reasons?.map((r: string, i: number) => (
                        <p key={i} className="text-[10px] text-emerald-400/60">{r}</p>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white tabular-nums">R{match.total_amount?.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        match.confidence >= 90 ? 'bg-emerald-500/10 text-emerald-300' : match.confidence >= 60 ? 'bg-amber-500/10 text-amber-300' : 'bg-zinc-800 text-zinc-500'
                      }`}>{match.confidence}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <a href={`/financials/cash-book/${accountId}/allocate/${txId}`} className="block w-full rounded-lg border border-white/[0.08] py-3 text-center text-sm text-white hover:border-white/20">
              Manual Allocation (Advanced)
            </a>
          </div>
          {selectedMatch && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <button onClick={handleConfirmAllocation} disabled={loading} className="w-full rounded-lg bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40">
                {loading ? 'Allocating...' : `Confirm Allocation — ${selectedMatch.invoice_number}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
