"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TransactionReviewPage() {
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, invoice_number, tenant_id, total_amount, payment_status, created_at, leases!inner(tenant_name)")
        .neq("payment_status", "paid")
        .order("total_amount");

      if (invs) {
        const scored = invs.map((inv: any) => {
          let confidence = 0;
          const reasons: string[] = [];
          
          // Amount match (max 50 points)
          const amountDiff = Math.abs((inv.total_amount || 0) - Math.abs(txAmount));
          if (amountDiff < 1) { confidence += 50; reasons.push('Exact amount match'); }
          else if (amountDiff < 100) { confidence += 40; reasons.push('Amount closely matches'); }
          else if (amountDiff < 500) { confidence += 25; reasons.push('Amount within range'); }
          else if (amountDiff < 5000) { confidence += 10; reasons.push('Approximate amount'); }
          
          // Tenant name in description (max 20 points)
          const tenantName = inv.leases?.tenant_name || '';
          const descLower = txDesc.toLowerCase();
          if (tenantName && descLower.includes(tenantName.toLowerCase())) {
            confidence += 20;
            reasons.push(`Tenant "${tenantName}" found in description`);
          } else if (tenantName && descLower.includes(tenantName.toLowerCase().split(' ')[0])) {
            confidence += 10;
            reasons.push('Partial tenant match');
          }
          
          // Reference match (max 20 points)
          if (txRef && inv.invoice_number && txRef.includes(inv.invoice_number)) {
            confidence += 20;
            reasons.push(`Reference matches invoice ${inv.invoice_number}`);
          }
          
          // Invoice age (max 10 points)
          const invoiceAge = new Date().getTime() - new Date(inv.created_at || 0).getTime();
          const daysOld = invoiceAge / (1000 * 60 * 60 * 24);
          if (daysOld < 30) { confidence += 10; reasons.push('Recent invoice'); }
          else if (daysOld < 90) { confidence += 5; reasons.push('Invoice within 3 months'); }
          
          return {
            ...inv,
            tenant_name: inv.leases?.tenant_name || 'Unknown',
            confidence: Math.min(confidence, 100),
            reasons,
          };
        });
        scored.sort((a: any, b: any) => b.confidence - a.confidence);
        setMatches(scored);
      }
    }
    load();
  }, [txAmount, txDesc, txRef]);

  async function handleConfirm() {
    if (!selectedMatch) return;
    setLoading(true);

    await supabase
      .from("bank_transactions")
      .update({
        matched_invoice_id: selectedMatch.id,
        matched_tenant_id: selectedMatch.tenant_id,
        allocation_status: "ready_to_post",
        queue: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", txId);

    setReady(true);
    setLoading(false);
  }

  if (ready) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-6 pt-20 pb-12 text-center">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2">Allocation Ready</h1>
          <p className="text-[var(--text-secondary)] mb-2">Transaction is ready to post.</p>
          <button onClick={() => router.back()} className="rounded-2xl bg-[var(--text-primary)] text-black px-6 py-3 text-sm font-semibold hover:opacity-90">
            Back to Cash Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 pt-8 pb-12">
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
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">R{Math.abs(txAmount).toLocaleString('en-ZA')}</p>
            </div>
          </div>
        </div>

        {/* Right: Recommended Matches */}
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Recommended Matches</p>
          
          {matches.length === 0 ? (
            <div className="space-y-4">
              <p className="text-[var(--text-muted)] text-sm">No matches found.</p>
              <button
                onClick={() => router.push(`/financials/cash-book/${accountId}/allocate/${txId}`)}
                className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Transaction Allocation
                <span className="text-xs text-[var(--text-muted)] ml-2">(advanced)</span>
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matches.slice(0, 8).map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      selectedMatch?.id === match.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border-default)] hover:border-[var(--border-hover)]"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{match.invoice_number}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{match.tenant_name}</p>
                        {match.reasons && match.reasons.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {match.reasons.slice(0, 2).map((reason: string, idx: number) => (
                              <p key={idx} className="text-[10px] text-emerald-400/70">{reason}</p>
                            ))}
                            {match.reasons.length > 2 && (
                              <p className="text-[10px] text-[var(--text-muted)]">+{match.reasons.length - 2} more matches</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[var(--text-primary)] tabular-nums">R{match.total_amount?.toLocaleString('en-ZA')}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          match.confidence >= 90 ? "bg-emerald-500/10 text-emerald-300" :
                          match.confidence >= 70 ? "bg-blue-500/10 text-blue-300" :
                          match.confidence >= 40 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"
                        }`}>{match.confidence}% match</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">Don't see the right match?</p>
                <button
                  onClick={() => router.push(`/financials/cash-book/${accountId}/allocate/${txId}`)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Transaction Allocation
                  <span className="text-xs text-[var(--text-muted)] ml-2">(advanced)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => router.back()} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)]">
          Hold
        </button>
        <button 
          onClick={handleConfirm} 
          disabled={!selectedMatch || loading}
          className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {loading ? "Processing..." : "Confirm → Ready To Post"}
        </button>
      </div>
    </div>
  );
}