"use client";

import { useState, useEffect, useRef } from "react";
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
const [entities, setEntities] = useState<{ id: string; entity_code: string; entity_name: string }[]>([]);
const [selectedEntity, setSelectedEntity] = useState("");
const [showEntityDropdown, setShowEntityDropdown] = useState(false);
const entityFilterRef = useRef<HTMLDivElement>(null);
const [sortBy, setSortBy] = useState<"date" | "amount" | "system_id" | "description" | "type">("date");
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
const [searchTerm, setSearchTerm] = useState("");

  // Load cash book entries
const loadEntries = async () => {
    setLoading(true);
    
    let query = supabase
      .from("bank_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .limit(200);
    
    if (selectedEntity) {
      const { data: entityProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("entity_id", selectedEntity);
      
      if (entityProperties && entityProperties.length > 0) {
        const propertyIds = entityProperties.map((p: any) => p.id);
        query = query.in("property_id", propertyIds);
      } else {
        setEntries([]);
        setLoading(false);
        return;
      }
    }

    const { data } = await query;

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
  useEffect(() => {
  async function loadEntities() {
    const { data } = await supabase
      .from("entities")
      .select("id, entity_code, entity_name")
      .order("entity_name");
    if (data && data.length > 0) {
      setEntities(data);
      setSelectedEntity(data[0].id);
    }
  }
  loadEntities();
}, []);
useEffect(() => {
  if (selectedEntity) {
    loadEntries();
  }
}, [selectedEntity]);

useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (entityFilterRef.current && !entityFilterRef.current.contains(target)) {
      setShowEntityDropdown(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
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
  // Sort filtered entries
const sortedEntries = [...filteredEntries].sort((a, b) => {
  const direction = sortOrder === "desc" ? -1 : 1;
  switch (sortBy) {
    case "date":
      return direction * a.transaction_date.localeCompare(b.transaction_date);
    case "amount":
      return direction * (a.transaction_amount - b.transaction_amount);
    case "system_id":
      return direction * (a.system_id || "").localeCompare(b.system_id || "");
    case "description":
      return direction * (a.transaction_description || "").localeCompare(b.transaction_description || "");
    case "type":
      return direction * (a.transaction_type || "").localeCompare(b.transaction_type || "");
    default:
      return 0;
  }
});

// Search filter
const searchedEntries = sortedEntries.filter((entry) => {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    (entry.transaction_description || "").toLowerCase().includes(term) ||
    (entry.system_id || "").toLowerCase().includes(term) ||
    (entry.matched_invoice_id || "").toLowerCase().includes(term)
  );
});

  const unreconciledCount = entries.filter(
    (e) => e.allocation_status !== "posted" && e.queue !== "posted"
  ).length;
  const reconciledCount = entries.filter(
    (e) => e.allocation_status === "posted" || e.queue === "posted"
  ).length;

  // Calculate running balance for display
  let runningBalance = 0;
  const entriesWithBalance = searchedEntries.map((entry) => {
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
     <div className="flex items-center gap-4 mt-4">
  <div className="flex items-center gap-2">
    <span className="text-xs text-zinc-500">Entity:</span>
    <div className="relative" ref={entityFilterRef}>
      <button
        type="button"
        onClick={() => setShowEntityDropdown(!showEntityDropdown)}
        className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 flex items-center gap-2"
      >
        {entities.find(e => e.id === selectedEntity)?.entity_name || "Select Entity"}
        <span className="text-zinc-500 text-xs">▼</span>
      </button>
      {showEntityDropdown && (
        <div className="absolute left-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden min-w-[200px]">
          {entities.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setSelectedEntity(e.id);
                setShowEntityDropdown(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selectedEntity === e.id
                  ? "bg-white text-black font-medium"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {e.entity_name}
              <span className="text-xs text-zinc-500 ml-2">({e.entity_code})</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
      <span className="ml-1.5 text-xs opacity-50">
        {tab === "unreconciled" ? unreconciledCount : tab === "reconciled" ? reconciledCount : entries.length}
      </span>
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
      ) : searchedEntries.length === 0 ? (
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
    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 w-10">#</th>
    <th
      onClick={() => { setSortBy("date"); setSortOrder(sortBy === "date" && sortOrder === "asc" ? "desc" : "asc"); }}
      className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 cursor-pointer hover:text-white select-none"
    >
      Date {sortBy === "date" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
    </th>
    <th
      onClick={() => { setSortBy("system_id"); setSortOrder(sortBy === "system_id" && sortOrder === "asc" ? "desc" : "asc"); }}
      className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 cursor-pointer hover:text-white select-none"
    >
      System ID {sortBy === "system_id" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
    </th>
    <th
      onClick={() => { setSortBy("description"); setSortOrder(sortBy === "description" && sortOrder === "asc" ? "desc" : "asc"); }}
      className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 cursor-pointer hover:text-white select-none"
    >
      Description {sortBy === "description" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
    </th>
    <th
      onClick={() => { setSortBy("type"); setSortOrder(sortBy === "type" && sortOrder === "asc" ? "desc" : "asc"); }}
      className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 cursor-pointer hover:text-white select-none"
    >
      Type {sortBy === "type" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
    </th>
    <th
      onClick={() => { setSortBy("amount"); setSortOrder(sortBy === "amount" && sortOrder === "desc" ? "asc" : "desc"); }}
      className="px-4 py-3 text-right text-xs uppercase tracking-[0.2em] text-zinc-500 cursor-pointer hover:text-white select-none"
    >
      Amount {sortBy === "amount" ? (sortOrder === "desc" ? "▼" : "▲") : ""}
    </th>
    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Status</th>
    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Posted To</th>
    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">Actions</th>
  </tr>
</thead>
            <tbody>
              {searchedEntries.map((entry, idx) => (
  <tr key={entry.id} className="...">
    <td className="px-4 py-4 text-xs text-zinc-600 font-mono w-10">{idx + 1}</td>
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
                    {entry.allocation_status === "posted" || entry.queue === "posted" ? (
  <button
    onClick={() => {
      setReviewTransaction(entry);
      setReviewModalOpen(true);
    }}
    className="rounded-xl border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
  >
    View
  </button>
) : (
  <button
    onClick={() => {
      setReviewTransaction(entry);
      setReviewModalOpen(true);
    }}
    className="rounded-xl border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
  >
    Reconcile
  </button>
)}
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