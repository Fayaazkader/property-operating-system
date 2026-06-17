"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AllocationWorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  
  const accountId = params?.accountId as string;
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
      // Get open invoices
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, invoice_number, tenant_id, total_amount, payment_status, created_at, leases!inner(tenant_name)")
        .neq("payment_status", "paid")
        .order("total_amount");

      if (invs) {
        const scored = invs.map((inv: any) => {
          let confidence = 0;
          const reasons: string[] = [];
          
          // 1. Amount match (max 40 points)
          const amountDiff = Math.abs((inv.total_amount || 0) - Math.abs(txAmount));
          if (amountDiff < 1) { confidence += 40; reasons.push('✓ Exact amount match'); }
          else if (amountDiff < 100) { confidence += 30; reasons.push('✓ Amount closely matches'); }
          else if (amountDiff < 500) { confidence += 20; reasons.push('✓ Amount within range'); }
          else if (amountDiff < 5000) { confidence += 10; reasons.push('✓ Approximate amount'); }
          
          // 2. Tenant name in description (max 25 points)
          const tenantName = inv.leases?.tenant_name || '';
          const descLower = txDesc.toLowerCase();
          if (tenantName && descLower.includes(tenantName.toLowerCase())) {
            confidence += 25;
            reasons.push(`✓ Tenant "${tenantName}" found in description`);
          } else if (tenantName && descLower.includes(tenantName.toLowerCase().split(' ')[0])) {
            confidence += 15;
            reasons.push(`✓ Partial tenant match`);
          }
          
          // 3. Reference match (max 20 points)
          if (txRef && inv.invoice_number && txRef.includes(inv.invoice_number)) {
            confidence += 20;
            reasons.push(`✓ Reference matches invoice ${inv.invoice_number}`);
          }
          
          // 4. Invoice age (max 15 points)
          const invoiceAge = new Date().getTime() - new Date(inv.created_at || 0).getTime();
          const daysOld = invoiceAge / (1000 * 60 * 60 * 24);
          if (daysOld < 30) { confidence += 15; reasons.push('✓ Recent invoice'); }
          else if (daysOld < 90) { confidence += 10; reasons.push('✓ Invoice within 3 months'); }
          else if (daysOld < 180) { confidence += 5; reasons.push('✓ Invoice within 6 months'); }
          
          return {
            ...inv,
            tenant_name: inv.leases?.tenant_name || 'Unknown',
            confidence: Math.min(confidence, 100),
            reasons,
          };
        });
        scored.sort((a: any, b: any) => b.confidence - a.confidence);
        setInvoices(scored);
      }

      const { data: tens } = await supabase.from("tenants").select("id, tenant_name").order("tenant_name");
      if (tens) setTenants(tens);
    }
    load();
  }, [txAmount, txDesc, txRef]);

  async function handleAllocate() {
    if (!selectedInvoice && !selectedTenant) return;
    setLoading(true);

    await supabase
      .from("bank_transactions")
      .update({
        matched_invoice_id: selectedInvoice || null,
        matched_tenant_id: selectedTenant || null,
        allocation_status: "ready_to_post",
        queue: "ready",
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
          <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2">Allocation Ready</h1>
          <p className="text-[var(--text-secondary)] mb-2">Transaction has been allocated and is ready to post.</p>
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

        {/* Right: Recommended Allocations */}
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Recommended Allocations</p>
          
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
                      {inv.reasons && inv.reasons.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {inv.reasons.slice(0, 2).map((reason: string, idx: number) => (
                            <p key={idx} className="text-[10px] text-emerald-400/70">{reason}</p>
                          ))}
                          {inv.reasons.length > 2 && (
                            <p className="text-[10px] text-[var(--text-muted)]">+{inv.reasons.length - 2} more matches</p>
                          )}
                        </div>
                      )}
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

          {/* Manual Allocation Button */}
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-muted)] mb-2">Don't see the right match?</p>
            <button
              onClick={() => router.push(`/financials/cash-book/${accountId}/allocate/${txId}`)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center justify-center gap-2"
            >
              ✏️ Manual Allocation
              <span className="text-xs text-[var(--text-muted)]">(advanced)</span>
            </button>
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
          {loading ? "Allocating..." : "Allocate → Ready To Post"}
        </button>
      </div>
    </div>
  );
}