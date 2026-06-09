"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { AllocationBuilder } from "./allocation-builder";
import { supabase } from "@/lib/supabase";
import type { SplitAllocation } from "@/app/types/allocation";

type LookupData = {
  properties: { id: string; property_name: string; property_code?: string }[];
  leases: { id: string; lease_id: string; property_id: string; tenant_id: string; tenant_name?: string }[];
  tenants: { id: string; tenant_name: string; tenant_code?: string }[];
};

type BankTransaction = {
  id: string;
  transaction_date?: string;
  transactionDate?: string;
  transaction_description?: string;
  description?: string;
  transaction_amount?: number;
  amount?: number;
  transaction_reference?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  split_allocations?: SplitAllocation[];
};

interface Props {
  transaction: BankTransaction;
  lookupData: LookupData;
  currency?: string;
}

export function ReconciliationWorkspace({ transaction, lookupData, currency = "ZAR" }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [allocations, setAllocations] = useState<SplitAllocation[]>(
    transaction.split_allocations || []
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const transactionAmount = (transaction as any).transaction_amount || (transaction as any).amount || 0;
  const transactionDescription = transaction.transaction_description || transaction.description || "";
  const transactionDate = transaction.transaction_date || transaction.transactionDate || "";
  const transactionRef = transaction.transaction_reference || "";

  const allocatedTotal = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const remaining = transactionAmount - allocatedTotal;
  const isBalanced = Math.abs(remaining) < 0.01;

  // Open first line automatically if empty
 useEffect(() => {
  const timer = setTimeout(() => {
    setMounted(true);
    
    let currentAllocations = allocations;
    
    // If no allocations exist, create the first one
    if (currentAllocations.length === 0) {
      const newLine: SplitAllocation = {
        id: `draft-${Date.now()}`,
        category: "",
         amount: 0,
        vatTreatment: "vat-inclusive",
        vatAmount: 0,
        notes: "",
      };
      currentAllocations = [newLine];
      setAllocations(currentAllocations);
    }
    
    // Always open the first line in edit mode
    setEditingLineId(currentAllocations[0].id);
  }, 50);
  return () => clearTimeout(timer);
}, []);

  const handleAddLine = useCallback(() => {
    const newLine: SplitAllocation = {
      id: `draft-${Date.now()}`,
      category: "",
      amount: remaining > 0 ? remaining : 0,
      vatTreatment: "vat-inclusive",
      vatAmount: 0,
      notes: "",
    };
    setAllocations((prev) => [...prev, newLine]);
    setEditingLineId(newLine.id);
  }, [remaining]);

  const handleUpdateLine = useCallback((updatedLine: SplitAllocation) => {
    setAllocations((prev) =>
      prev.map((line) => (line.id === updatedLine.id ? updatedLine : line))
    );
  }, []);

  const handleRemoveLine = useCallback((lineId: string) => {
    setAllocations((prev) => prev.filter((line) => line.id !== lineId));
    setEditingLineId(null);
  }, []);

  const handleSave = useCallback(async () => {
  setIsSaving(true);
  const { error } = await supabase
    .from("bank_transactions")
    .update({
      split_allocations: allocations,
       allocation_status: "posted",
       queue: "posted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transaction.id);
  
  // Small delay before navigation
  setTimeout(() => {
    window.location.href = '/financials/cash-book'
  }, 100);
  
  setIsSaving(false);
}, [allocations, transaction.id, isBalanced, router]);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(value);
  };
console.log("DEBUG:", { transactionAmount, allocatedTotal, remaining, isBalanced });
  return (
    <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-black shadow-2xl"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-8 py-5 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
                Reconciliation Workspace
              </p>
              <h2 className="mt-2 text-2xl font-black text-white truncate">
                {transactionDescription}
              </h2>
              <div className="flex items-center gap-5 mt-3 text-sm">
                <span className="text-zinc-100 font-semibold tabular-nums">
                  {formatCurrency(transactionAmount)}
                </span>
                {transactionDate && (
                  <span className="text-zinc-500">{transactionDate}</span>
                )}
                {transactionRef && (
                  <span className="text-zinc-500 truncate">Ref: {transactionRef}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/financials/cash-book'}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Balance bar */}
        <div className="flex-shrink-0 px-8 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-[0.2em]">
              {allocations.length} {allocations.length === 1 ? "Line" : "Lines"}
            </span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-zinc-400">Allocated:</span>
              <span className="text-white font-medium tabular-nums">
                {formatCurrency(allocatedTotal)}
              </span>
              {!isBalanced && allocations.length > 0 && (
                <span className="text-amber-400 tabular-nums">
                  · {formatCurrency(remaining)} remaining
                </span>
              )}
              {isBalanced && allocations.length > 0 && (
                <span className="text-emerald-400">· Balanced</span>
              )}
            </div>
          </div>
        </div>

        {/* VAT column headers */}
        <div className="flex-shrink-0 px-8 py-2 border-b border-zinc-800/50 bg-zinc-950/50">
          <div className="flex items-center text-xs text-zinc-500 uppercase tracking-[0.15em]">
            <span className="w-6" />
            <span className="flex-1">Allocation</span>
            <span className="w-28 text-right">Excl. VAT</span>
            <span className="w-24 text-right">VAT</span>
            <span className="w-32 text-right">Incl. VAT</span>
            <span className="w-10" />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 pb-28">
          <AllocationBuilder
            allocations={allocations}
            editingLineId={editingLineId}
            lookupData={lookupData}
            transactionTotal={transactionAmount}
            allocatedTotal={allocatedTotal}
            isBalanced={isBalanced}
            onEditLine={setEditingLineId}
            onUpdateLine={handleUpdateLine}
            onRemoveLine={handleRemoveLine}
            onAddLine={handleAddLine}
            currency={currency}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-800 bg-black px-8 py-5">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => window.location.href = '/financials/cash-book'}
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={allocations.length === 0 || isSaving}
              className="rounded-2xl bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Hold for Review
            </button>
            <button
              onClick={handleSave}
              disabled={!isBalanced || allocations.length === 0 || isSaving}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Post Allocation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}