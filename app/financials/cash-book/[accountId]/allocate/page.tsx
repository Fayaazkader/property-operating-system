"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AllocationWorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txId = searchParams.get("txId") || "";
  const txAmount = parseFloat(searchParams.get("amount") || "0");
  const txDesc = searchParams.get("desc") || "";
  const txRef = searchParams.get("ref") || "";
  const txDate = searchParams.get("date") || "";

  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    async function load() {
      // Get open invoices sorted by amount match
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, invoice_number, tenant_id, total_amount, payment_status, leases!inner(tenant_name)")
        .neq("payment_status", "paid")
        .order("total_amount");

      if (invs) {
        const scored = invs.map((inv: any) => ({
          ...inv,
          tenant_name: inv.leases?.tenant_name || "Unknown",
          confidence: Math.abs((inv.total_amount || 0) - Math.abs(txAmount)) < 1 ? 97 :
                     Math.abs((inv.total_amount || 0) - Math.abs(txAmount)) < 1000 ? 85 :
                     Math.abs((inv.total_amount || 0) - Math.abs(txAmount)) < 5000 ? 65 : 40,
        }));
        scored.sort((a: any, b: any) => b.confidence - a.confidence);
        setInvoices(scored);
      }

      const { data: tens } = await supabase.from("tenants").select("id, tenant_name").order("tenant_name");
      if (tens) setTenants(tens);
    }
    load();
  }, [txAmount]);

  async function handleAllocate() {
    if (!selectedInvoice && !selectedTenant) return;
    setLoading(true);

    await supabase
      .from("bank_transactions")
      .update({
        matched_invoice_id: selectedInvoice || null,
        matched_tenant_id: selectedTenant || null,
        allocation_status: "fully_allocated",
        queue: "posted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", txId);

    setPosted(true);
    setLoading(false);
  }

  if (posted) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-6 pt-20 pb-12 text-center">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2">Allocation Posted</h1>
          <p className="text-[var(--text-secondary)] mb-2">Transaction has been allocated and posted.</p>
          <button onClick={() => router.back()} className="rounded-2xl bg-[var(--text-primary)] text-black px-6 py-3 text-sm font-semibold hover:opacity-90">
            Back to Cash Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 pt-8 pb-12">
      {/* Back */}
      <button onClick={() => router.back()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        ← Back to Account
      </button>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: Bank Transaction */}
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Bank Transaction</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Date</p>
              <p className="text-sm text-[var(--text-primary)]">{txDate}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Description</p>
              <p className="text-sm text-[var(--text-primary)]">{txDesc}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Reference</p>
              <p className="text-sm text-[var(--text-primary)] font-mono">{txRef || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Amount</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">R{Math.abs(txAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Right: Suggested Matches */}
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Suggested Matches</p>
          
          {invoices.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No open invoices found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invoices.slice(0, 8).map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => { setSelectedInvoice(inv.id); setSelectedTenant(inv.tenant_id); }}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    selectedInvoice === inv.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border-default)] hover:border-[var(--border-hover)]"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{inv.invoice_number}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{inv.tenant_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--text-primary)] tabular-nums">R{inv.total_amount?.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        inv.confidence >= 90 ? "bg-emerald-500/10 text-emerald-300" :
                        inv.confidence >= 70 ? "bg-blue-500/10 text-blue-300" :
                        inv.confidence >= 40 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"
                      }`}>{inv.confidence}% match</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Manual tenant selection */}
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-muted)] mb-2">Or select tenant manually</p>
            <select value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setSelectedInvoice(""); }}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]">
              <option value="">Select tenant...</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.tenant_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => router.back()} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)]">
          Hold
        </button>
        <button onClick={handleAllocate} disabled={(!selectedInvoice && !selectedTenant) || loading}
          className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
          {loading ? "Allocating..." : "Allocate & Post"}
        </button>
      </div>
    </div>
  );
}