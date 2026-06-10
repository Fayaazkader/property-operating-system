"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TransactionReviewModal } from "@/components/financials/TransactionReviewModal";
type CashBookEntry = {
  id: string;
  transaction_date: string;
  system_id: string;
  transaction_description: string;
  transaction_amount: number;
  transaction_type: "deposit" | "payment";
  allocation_status: string;
  queue: string;
  matched_invoice_id?: string;
  matched_tenant_id?: string;
  property_id?: string;
};

export default function CashBookPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"unreconciled" | "reconciled" | "all">("unreconciled");
  const [activeFilter, setActiveFilter] = useState<"all" | "deposits" | "payments">("all");
  const [reviewTransaction, setReviewTransaction] = useState<any>(null);
const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Load cash book entries
  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bank_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .limit(200);

    if (data) {
      const mapped = data.map((tx: any) => ({
        id: tx.id,
        transaction_date: tx.transaction_date || "",
        system_id: tx.system_id || `SYS-${tx.id?.slice(0, 8) || "unknown"}`,
        transaction_description: tx.transaction_description || "",
        transaction_amount: tx.transaction_amount || 0,
        transaction_type: (tx.transaction_amount || 0) >= 0 ? "deposit" : "payment",
        allocation_status: tx.allocation_status || "unallocated",
        queue: tx.queue || "ready",
        matched_invoice_id: tx.matched_invoice_id || null,
        matched_tenant_id: tx.matched_tenant_id || null,
        property_id: tx.property_id || null,
      }));
      setEntries(mapped as CashBookEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Filter logic
  const filteredEntries = entries.filter((entry) => {
    // Tab filter
    if (activeTab === "unreconciled") {
      if (entry.allocation_status === "posted" || entry.queue === "posted") return false;
    }
    if (activeTab === "reconciled") {
      if (entry.allocation_status !== "posted" && entry.queue !== "posted") return false;
    }

    // Type filter
    if (activeFilter === "deposits" && entry.transaction_type !== "deposit") return false;
    if (activeFilter === "payments" && entry.transaction_type !== "payment") return false;

    return true;
  });

  const unreconciledCount = entries.filter(
    (e) => e.allocation_status !== "posted" && e.queue !== "posted"
  ).length;
  const reconciledCount = entries.filter(
    (e) => e.allocation_status === "posted" || e.queue === "posted"
  ).length;

  // Calculate running balance for display
  let runningBalance = 0;
  const entriesWithBalance = filteredEntries.map((entry) => {
    runningBalance += entry.transaction_amount;
    return { ...entry, balance: runningBalance };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
            Financial Operations
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Cash Book
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
            Reconcile transactions, issue receipts, and balance to your bank statement monthly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Unreconciled</p>
          <p className="mt-2 text-3xl font-black text-amber-400">{unreconciledCount}</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Reconciled</p>
          <p className="mt-2 text-3xl font-black text-emerald-400">{reconciledCount}</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Total Transactions</p>
          <p className="mt-2 text-3xl font-black text-white">{entries.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3">
        {(["unreconciled", "reconciled", "all"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${
              activeTab === tab
                ? "bg-white text-black"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {tab}
            {tab === "unreconciled" && ` (${unreconciledCount})`}
            {tab === "reconciled" && ` (${reconciledCount})`}
            {tab === "all" && ` (${entries.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {(["all", "deposits", "payments"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize transition ${
              activeFilter === filter
                ? "bg-zinc-800 text-white"
                : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20">
          <p className="text-zinc-500">Loading cash book...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-zinc-800 bg-zinc-900">
          <p className="text-lg font-semibold text-white">No transactions found</p>
          <p className="mt-3 text-sm text-zinc-500">
            {activeTab === "unreconciled"
              ? "All transactions have been reconciled."
              : "No transactions match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <table className="w-full">
            <thead className="border-b border-zinc-800 bg-black/30">
              <tr>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Date</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">System ID</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Description</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Type</th>
                <th className="px-4 py-4 text-right text-xs uppercase tracking-[0.2em] text-zinc-500">Amount</th>
                <th className="px-4 py-4 text-right text-xs uppercase tracking-[0.2em] text-zinc-500">Balance</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Posted To</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entriesWithBalance.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-800 transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-4 text-sm text-zinc-300">{entry.transaction_date}</td>
                  <td className="px-4 py-4 text-sm text-zinc-400 font-mono text-xs">{entry.system_id}</td>
                  <td className="px-4 py-4 text-sm text-white">{entry.transaction_description}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.transaction_type === "deposit"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-blue-500/10 text-blue-300"
                    }`}>
                      {entry.transaction_type === "deposit" ? "Deposit" : "Payment"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-white text-right tabular-nums">
                    R{Math.abs(entry.transaction_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400 text-right tabular-nums">
                    R{entry.balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.allocation_status === "posted" || entry.queue === "posted"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}>
                      {entry.allocation_status === "posted" || entry.queue === "posted"
                        ? "Reconciled"
                        : "Unreconciled"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {entry.matched_invoice_id ? (
                      <button
                        onClick={() => router.push(`/financials/ledger/${entry.matched_invoice_id}`)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                      >
                        {entry.matched_invoice_id}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => {
  setReviewTransaction(entry);
  setReviewModalOpen(true);
}}
                      className="rounded-xl border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      {entry.allocation_status === "posted" || entry.queue === "posted"
                        ? "View"
                        : "Reconcile"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <TransactionReviewModal
  open={reviewModalOpen}
  transaction={reviewTransaction}
  onClose={() => setReviewModalOpen(false)}
  onPosted={() => loadEntries()}
/>
    </div>
  );
}