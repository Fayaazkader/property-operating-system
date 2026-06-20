'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { exportToCSV } from "@/lib/utils";

type Transaction = {
  id: string;
  transaction_date: string;
  transaction_description: string;
  transaction_amount: number;
  transaction_reference: string;
  allocation_status: string;
  queue: string;
  matched_tenant_id: string;
  matched_invoice_id: string;
  confidence: number;
};

export default function AccountWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params?.accountId as string;

  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeQueue, setActiveQueue] = useState<"ready" | "review" | "exceptions" | "posted">("ready");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
  async function load() {
    if (!accountId) return;
    const { data: acc } = await supabase.from("bank_accounts").select("*").eq("id", accountId).single();
    if (acc) setAccount(acc);

    const { data: txs } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("bank_account_id", accountId)
      .order("transaction_date", { ascending: false })
      .limit(200);

    if (txs) {
      setTransactions(txs);
    }
    setLoading(false);
  }
  load();
}, [accountId]);

  const difference = account ? account.statement_balance - account.current_balance : 0;
  const isBalanced = Math.abs(difference) < 0.01;

  const queueCounts = {
    ready: transactions.filter(t => t.allocation_status !== "posted" && t.allocation_status !== "fully_allocated" && t.queue !== "posted" && (t.confidence >= 90 || t.matched_tenant_id)).length,
    review: transactions.filter(t => t.allocation_status !== "posted" && t.confidence >= 70 && t.confidence < 90 && !t.matched_tenant_id).length,
    exceptions: transactions.filter(t => t.allocation_status !== "posted" && t.confidence < 70 && !t.matched_tenant_id).length,
    posted: transactions.filter(t => t.allocation_status === "posted" || t.queue === "posted").length,
  };

  const searched = transactions.filter(tx => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      tx.transaction_description?.toLowerCase().includes(s) ||
      tx.transaction_reference?.toLowerCase().includes(s) ||
      tx.transaction_amount?.toString().includes(s)
    );
  });

  const filteredTxs = searched.filter(tx => {
    if (activeQueue === "ready") return tx.allocation_status !== "posted" && tx.allocation_status !== "fully_allocated" && tx.queue !== "posted" && (tx.confidence >= 90 || tx.matched_tenant_id);
    if (activeQueue === "review") return tx.allocation_status !== "posted" && tx.confidence >= 70 && tx.confidence < 90 && !tx.matched_tenant_id;
    if (activeQueue === "exceptions") return tx.allocation_status !== "posted" && tx.confidence < 70 && !tx.matched_tenant_id;
    if (activeQueue === "posted") return tx.allocation_status === "posted" || tx.queue === "posted";
    return true;
  });

  async function handlePostAllReady() {
    const readyTxs = transactions.filter(tx => 
      tx.allocation_status !== "posted" && 
      tx.allocation_status !== "fully_allocated" && 
      tx.queue !== "posted" && 
      (tx.confidence >= 90 || tx.matched_tenant_id)
    );

    if (readyTxs.length === 0) return;

    setLoading(true);
    const readyIds = readyTxs.map(tx => tx.id);

    await supabase
      .from("bank_transactions")
      .update({
        allocation_status: "fully_allocated",
        queue: "posted",
        updated_at: new Date().toISOString(),
      })
      .in("id", readyIds);

    const { data: freshData } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("bank_account_id", accountId)
      .order("transaction_date", { ascending: false })
      .limit(200);

    if (freshData) {
      const enriched = freshData.map((tx: any) => {
        let confidence = 0;
        const desc = tx.transaction_description?.toLowerCase() || '';
        const ref = tx.transaction_reference?.toLowerCase() || '';

        if (tx.matched_invoice_id) {
          confidence = 97;
        } else if (tx.matched_tenant_id) {
          confidence = 85;
        } else if (ref && desc.includes(ref)) {
          confidence = 95;
        } else if (desc.match(/rent|invoice|payment|tenant|lease|shop|office|suite/i)) {
          confidence = 75;
        } else {
          confidence = 20;
        }

        return {
          ...tx,
          confidence,
        };
      });
      setTransactions(enriched);
    }
    setLoading(false);
  }

  if (loading) return <div className="mx-auto max-w-7xl px-6 pt-8 pb-12"><p className="text-[var(--text-muted)]">Loading...</p></div>;
  if (!account) return <div className="mx-auto max-w-7xl px-6 pt-8 pb-12"><p className="text-[var(--text-muted)]">Account not found.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title={`${account.bank_name} — ${account.account_name}`} subtitle={account.account_number} />

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-2xl font-bold text-emerald-400">{queueCounts.ready}</p>
          <p className="text-xs text-gray-400">Ready to Post</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-2xl font-bold text-amber-400">{queueCounts.review}</p>
          <p className="text-xs text-gray-400">Need Review</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-2xl font-bold text-red-400">{queueCounts.exceptions}</p>
          <p className="text-xs text-gray-400">Exceptions</p>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-2xl font-bold text-blue-400">{queueCounts.posted}</p>
          <p className="text-xs text-gray-400">Posted</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Statement:</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">R{account.statement_balance?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Book:</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">R{account.current_balance?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">Difference:</span>
            <span className={`font-medium tabular-nums ${isBalanced ? "text-emerald-400" : "text-amber-400"}`}>
              {isBalanced ? "R0" : `R${Math.abs(difference).toLocaleString()}`}
            </span>
          </div>
          <div className="ml-auto">
            <span className={`text-xs px-2 py-1 rounded-full ${isBalanced ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
              {isBalanced ? "Ready to Close" : "Needs Review"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search description, reference, or amount..."
          className="flex-1 min-w-[200px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] placeholder:text-[var(--text-muted)]"
        />
        <div className="flex gap-2">
          {(["ready", "review", "exceptions", "posted"] as const).map(queue => (
            <button key={queue} onClick={() => setActiveQueue(queue)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${
                activeQueue === queue
                  ? "bg-white text-black"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}>
              {queue === "ready" ? "Ready to Post" : queue === "review" ? "Needs Review" : queue === "exceptions" ? "Exceptions" : "Posted"}
              <span className="ml-1.5 text-xs opacity-50">({queueCounts[queue]})</span>
            </button>
          ))}
          {activeQueue === "ready" && queueCounts.ready > 0 && (
            <button onClick={handlePostAllReady} disabled={loading}
              className="ml-auto rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
              {loading ? "Posting..." : `Post All Ready (${queueCounts.ready})`}
            </button>
          )}
          <button onClick={() => exportToCSV(filteredTxs, `cashbook-${accountId}`)} className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)] ml-auto">
            📥 Export
          </button>
        </div>
      </div>

      {filteredTxs.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No transactions in this queue.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Date</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Description</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Reference</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Amount</th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Confidence</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{tx.transaction_date}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{tx.transaction_description}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono text-xs">{tx.transaction_reference || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] text-right tabular-nums">R{Math.abs(tx.transaction_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.confidence >= 90 ? "bg-emerald-500/10 text-emerald-300" :
                      tx.confidence >= 70 ? "bg-blue-500/10 text-blue-300" :
                      tx.confidence >= 40 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"
                    }`}>
                      {tx.confidence}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                   {activeQueue === "ready" && (
  <div className="flex gap-2">
    <button 
      onClick={() => router.push(`/financials/cash-book/${accountId}/allocate/${tx.id}`)}
      className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
    >
      Edit
    </button>
    <button 
      onClick={async () => {
        await supabase
          .from("bank_transactions")
          .update({
            allocation_status: "posted",
            queue: "posted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tx.id);
        // Refresh the page
        window.location.reload();
      }}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
    >
      Post
    </button>
  </div>
)}
{activeQueue === "review" && (
  <button 
    onClick={() => router.push(`/financials/cash-book/${accountId}/allocate?txId=${tx.id}&amount=${tx.transaction_amount}&desc=${encodeURIComponent(tx.transaction_description)}&ref=${encodeURIComponent(tx.transaction_reference || "")}&date=${tx.transaction_date}`)}
    className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
  >
    Review
  </button>
)}
{activeQueue === "exceptions" && (
  <button 
    onClick={() => router.push(`/financials/cash-book/${accountId}/allocate?txId=${tx.id}&amount=${tx.transaction_amount}&desc=${encodeURIComponent(tx.transaction_description)}&ref=${encodeURIComponent(tx.transaction_reference || "")}&date=${tx.transaction_date}`)}
    className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
  >
    Allocate
  </button>
)}
{activeQueue === "posted" && (
  <span className="text-xs text-[var(--text-muted)]">✓ Posted</span>
)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}