"use client";

import { useState, useEffect, useRef } from "react";
import ImportDropzone from "@/components/widgets/ImportDropzone";
import { importBankTransactions } from "@/lib/services/banking";
import { supabase } from "@/lib/supabase";
import { BankImportPresets } from "@/components/financials/BankImportPresets";
import { validateBankImport } from "@/lib/banking/import-validation";


export default function BankingImportsPage() {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Load presets
  useEffect(() => {
    async function loadPresets() {
      const { data } = await supabase
        .from("bank_import_presets")
        .select("*")
        .order("is_default", { ascending: false })
        .order("preset_name");
      if (data && data.length > 0) {
        setPresets(data);
        setActivePreset(data[0]);
      }
    }
    loadPresets();
  }, []);

  // Load import history
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from("bank_transactions")
        .select("imported_batch_reference, imported_at, bank_account_name")
        .not("imported_batch_reference", "is", null)
        .order("imported_at", { ascending: false })
        .limit(10);
      
      if (data) {
        const batches = new Map();
        data.forEach((tx: any) => {
          if (!batches.has(tx.imported_batch_reference)) {
            batches.set(tx.imported_batch_reference, {
              batch_ref: tx.imported_batch_reference,
              imported_at: tx.imported_at,
              bank: tx.bank_account_name || "Unknown",
            });
          }
        });
        setImportHistory(Array.from(batches.values()));
      }
    }
    loadHistory();
  }, [loading]);

  // Click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(target)) {
        setShowPresetDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleImport(file: File) {
  setLoading(true);
  setFileName(file.name);

  // Read file once
  const text = await file.text();
  const batchRef = await hashContent(text);

  // Run validation
  const validation = await validateBankImport(file);

    if (!validation.valid) {
    setMessage({ type: "error", text: validation.errors.join(" · ") });
    setLoading(false);
    return;
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("bank_transactions")
    .select("id")
    .eq("imported_batch_reference", batchRef)
    .limit(1);

    if (existing && existing.length > 0) {
    setMessage({ type: "error", text: "This bank statement has already been imported. Duplicate detected." });
    setLoading(false);
    return;
  }

  // Proceed with import
  const result = await importBankTransactions(file);

  if (result.success && result.data) {
    for (const tx of result.data) {
      await supabase.from("bank_transactions").upsert({
        id: tx.id,
        transaction_date: tx.transactionDate || null,
        transaction_description: tx.description || null,
        transaction_amount: tx.amount || 0,
        transaction_reference: tx.reference || null,
        bank_account_name: activePreset?.bank_name || null,
        bank_account_number: null,
        allocation_status: "unallocated",
        split_allocations: tx.splitAllocations || [],
        queue: "ready",
        imported_batch_reference: batchRef,
        imported_at: new Date().toISOString(),
      });
    } setMessage({ type: "success", text: `${result.data.length} transactions imported and posted to Cash Book.` });
    setLoading(false);
    return;
  }

  setMessage({ type: "error", text: "Import failed. Please check the file format and try again." });
  setLoading(false);
}

// Helper: hash file content
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {/* Header */}
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
          Financial Operations
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
          Banking Imports
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
          Upload bank statements to populate the Cash Book. All transactions are automatically posted and ready for reconciliation.
        </p>
      </div>
      {message && (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-medium ${
          message.type === "success"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/20 bg-red-500/10 text-red-300"
        }`}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-3 text-xs opacity-50 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bank Presets */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Bank Import Presets</p>
        <div className="flex items-center gap-3">
          <div className="relative flex-1" ref={presetDropdownRef}>
            <button
              type="button"
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 flex items-center justify-between"
            >
              <span className={activePreset ? "text-white" : "text-zinc-500"}>
                {activePreset ? `${activePreset.preset_name} ${activePreset.bank_name ? `(${activePreset.bank_name})` : ""}` : "Select a preset..."}
              </span>
              <span className="text-zinc-500 text-xs">▼</span>
            </button>
            {showPresetDropdown && (
              <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setActivePreset(null); setShowPresetDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-800"
                >
                  None
                </button>
                {presets.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setActivePreset(p); setShowPresetDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      activePreset?.id === p.id
                        ? "bg-white text-black font-medium"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {p.preset_name}
                    {p.bank_name && <span className="text-xs text-zinc-500 ml-1">({p.bank_name})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setPresetsOpen(true)}
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white whitespace-nowrap"
          >
            Edit Presets
          </button>
        </div>
      </div>

      {/* Upload */}
      <ImportDropzone
        title="Bank Statement Import"
        description="Upload your bank CSV file. Transactions will be validated and automatically posted to the Cash Book for reconciliation."
        loading={loading}
        fileName={fileName}
        onFileSelect={handleImport}
      />

      {/* Import History */}
      {importHistory.length > 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Recent Imports</p>
          <div className="space-y-2">
            {importHistory.map((batch: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-zinc-300">{batch.bank}</span>
                  <span className="text-zinc-600 ml-2 text-xs font-mono">{batch.batch_ref?.slice(0, 12)}...</span>
                </div>
                <span className="text-zinc-500 text-xs">
                  {new Date(batch.imported_at).toLocaleDateString("en-ZA", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {importHistory.length === 0 && !loading && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-zinc-500">No imports yet. Select a bank preset and upload your first statement.</p>
        </div>
      )}

      {/* Preset Manager Modal */}
      <BankImportPresets
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        onPresetSelected={(preset) => {
          setActivePreset(preset);
          setPresetsOpen(false);
        }}
      />
    </div>
  );
}