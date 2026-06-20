"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  statement_balance: number;
  current_balance: number;
  is_trust_account: boolean;
};

export default function CashBookPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const entityFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: ent } = await supabase.from("entities").select("id, entity_code, entity_name").order("entity_name");
      if (ent && ent.length > 0) {
        setEntities(ent);
        setSelectedEntity(ent[0].id);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadAccounts() {
      if (!selectedEntity) return;
      setLoading(true);
      console.log('Loading accounts for entity:', selectedEntity);
console.log('Query:', `bank_accounts where entity_id = ${selectedEntity} and is_active = true`);
     const { data, error } = await supabase
  .from("bank_accounts")
  .select("*")
  .eq("entity_id", selectedEntity)
  .eq("is_active", true)
  .order("is_trust_account", { ascending: false });

console.log('Data:', data);
console.log('Error:', error);

      if (data) {
        // Get unreconciled counts per account
        const enriched = await Promise.all(data.map(async (acc: BankAccount) => {
          const { count } = await supabase
  .from("bank_transactions")
  .select("id", { count: "exact", head: true })
  .eq("bank_account_id", acc.id)
  .neq("allocation_status", "posted");
          return { ...acc, unreconciled: count || 0 };
        }));
        setAccounts(enriched as any[]);
      }
      setLoading(false);
    }
    loadAccounts();
  }, [selectedEntity]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (entityFilterRef.current && !entityFilterRef.current.contains(e.target as Node)) {
        setShowEntityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const balancedCount = accounts.filter(a => a.statement_balance === a.current_balance).length;
  const needsReviewCount = accounts.filter(a => a.statement_balance !== a.current_balance).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Cash Book" subtitle="Reconcile transactions across your bank accounts." />

      {/* Entity Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Entity:</span>
        <div className="relative" ref={entityFilterRef}>
          <button type="button" onClick={() => setShowEntityDropdown(!showEntityDropdown)}
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] flex items-center gap-2">
            {entities.find(e => e.id === selectedEntity)?.entity_name || "Select Entity"}
            <span className="text-[var(--text-muted)] text-xs">▼</span>
          </button>
          {showEntityDropdown && (
            <div className="absolute left-0 z-40 mt-1 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden min-w-[200px]">
              {entities.map((e) => (
                <button key={e.id} type="button" onClick={() => { setSelectedEntity(e.id); setShowEntityDropdown(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedEntity === e.id ? "bg-white text-black font-medium" : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}>
                  {e.entity_name} <span className="text-xs text-[var(--text-muted)] ml-1">({e.entity_code})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-auto">{accounts.length} Accounts · {balancedCount} Balanced · {needsReviewCount} Needs Review</span>
      </div>

      {/* Bank Account Cards */}
      {loading ? (
        <div className="text-center py-20"><p className="text-[var(--text-muted)]">Loading accounts...</p></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No bank accounts found for this entity.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => {
            const difference = acc.statement_balance - acc.current_balance;
            const isBalanced = Math.abs(difference) < 0.01;
            const unreconciled = (acc as any).unreconciled || 0;

            return (
              <button
                key={acc.id}
                onClick={() => router.push(`/financials/cash-book/${acc.id}`)}
                className="text-left rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 hover:border-[var(--border-hover)] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{acc.bank_name} — {acc.account_name}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-1">{acc.account_number}</p>
                    {acc.is_trust_account && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 mt-2 inline-block">Trust Account</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${isBalanced ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                    {isBalanced ? "Balanced" : "Needs Review"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Statement</span>
                    <span className="text-[var(--text-primary)] tabular-nums font-medium">R{acc.statement_balance?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Book</span>
                    <span className="text-[var(--text-primary)] tabular-nums font-medium">R{acc.current_balance?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-default)]">
                    <span className="text-[var(--text-muted)]">Difference</span>
                    <span className={`tabular-nums font-medium ${isBalanced ? "text-emerald-400" : "text-amber-400"}`}>
                      {isBalanced ? "R0" : `R${Math.abs(difference).toLocaleString()}`}
                    </span>
                  </div>
                  {unreconciled > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Unreconciled</span>
                      <span className="text-amber-400 tabular-nums">{unreconciled}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-xs text-[var(--accent)] group-hover:text-[var(--accent-hover)] transition-colors">
                  Open Account →
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}