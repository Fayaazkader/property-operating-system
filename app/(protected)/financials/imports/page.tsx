"use client";

import { useState, useEffect, useRef } from "react";
import ImportDropzone from "@/components/widgets/ImportDropzone";
import { importBankStatement } from "@/lib/banking/import-engine";
import { supabase } from "@/lib/supabase";
import { BankImportPresets } from "@/components/financials/BankImportPresets";
import { validateBankImport } from "@/lib/banking/import-validation";
import { runReconciliationEngine } from "@/lib/banking/reconciliation-engine";
import { validateBankImportFinancialPeriod } from "@/lib/banking/financial-period-governance";


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

  // Entity & Bank Account
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState("");

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

  // Load entities
  useEffect(() => {
    async function loadEntities() {
      const { data: entityIds } = await supabase.rpc('auth_entities');
const { data } = entityIds && entityIds.length > 0
  ? await supabase.from("entities").select("id, entity_name").in("id", entityIds).order("entity_name")
  : { data: [] };
if (data) setEntities(data);
    }
    loadEntities();
  }, []);

  // Load bank accounts when entity changes
  async function loadAccounts() {
    if (!selectedEntity) { setBankAccounts([]); return; }
    const { data } = await supabase.from("bank_accounts").select("id, account_name, bank_name, account_number").eq("entity_id", selectedEntity).order("account_name");
    if (data) {
      setBankAccounts(data);
      if (data.length === 1) {
        setSelectedBankAccount(data[0].id);
      } else if (data.length > 0 && !selectedBankAccount) {
        setSelectedBankAccount(data[0].id);
      }
    }
  }

  useEffect(() => { loadAccounts(); }, [selectedEntity]);

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMessage({ type: "error", text: "Session expired. Please refresh the page." }); setLoading(false); return; }    setLoading(true);
    setFileName(file.name);
    if (!selectedBankAccount) {
  setMessage({ type: "error", text: "Please select a bank account before importing." });
  setLoading(false);
  return;
}

    const text = await file.text();
    const batchRef = await hashContent(text);

    const validation = await validateBankImport(file, activePreset);

    if (!validation.valid) {
      setMessage({ type: "error", text: validation.errors.join(" · ") });
      setLoading(false);
      return;
    }

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

    const result = await importBankStatement(file, activePreset);

    if (result.success && result.data) {
  const periodValidation = await validateBankImportFinancialPeriod(
    selectedEntity,
    result.data.startDate,
    result.data.endDate
  );

  if (!periodValidation.valid) {
    setMessage({
      type: "error",
      text: periodValidation.reason || "Bank import is outside the open financial period.",
    });
    setLoading(false);
    return;
  }
}

    if (result.success && result.data) {
  const {
    transactions,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    statementDate,
  } = result.data;

  console.log(
    "Import: got",
    transactions.length,
    "transactions to save"
  );

  /*
   * Statement balance validation.
   *
   * If the source provides opening and closing balances,
   * verify that the transactions reconcile to the statement.
   *
   * We deliberately do not manufacture a bank closing balance
   * from AssetFlow's existing account balance.
   */
  if (openingBalance !== null && closingBalance !== null) {
    const transactionMovement = transactions.reduce(
      (sum, tx) => sum + (tx.amount || 0),
      0
    );

    const calculatedClosing =
      Math.round((openingBalance + transactionMovement) * 100) / 100;

    const difference =
      Math.round((calculatedClosing - closingBalance) * 100) / 100;

    if (Math.abs(difference) > 0.01) {
      setMessage({
        type: "error",
        text:
          `Bank statement balance validation failed. ` +
          `Opening balance R${openingBalance.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
          })} plus imported transactions does not equal the ` +
          `statement closing balance R${closingBalance.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
          })}. ` +
          `Difference: R${difference.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
          })}.`,
      });

      setLoading(false);
      return;
    }
  }

  /*
   * Create the governed bank statement first.
   */
  const { data: statement, error: statementError } = await supabase
    .from("bank_statements")
    .insert({
      bank_account_id: selectedBankAccount,
      entity_id: selectedEntity,
      statement_date: statementDate || endDate,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      status: "imported",
    })
    .select("id")
    .single();

  if (statementError || !statement) {
    console.error(
      "Import: failed to create bank statement:",
      statementError
    );

    setMessage({
      type: "error",
      text:
        statementError?.message ||
        "The bank statement could not be created.",
    });

    setLoading(false);
    return;
  }

  /*
   * Save transactions into the canonical bank transaction workflow.
   *
   * Imported transactions are NOT Ready.
   * They must pass reconciliation/allocation before becoming Ready.
   */
  for (const tx of transactions) {
    console.log(
      "Import: saving tx:",
      tx.id,
      tx.description,
      tx.amount
    );

    const { error: upsertError } = await supabase
      .from("bank_transactions")
      .upsert({
        id: tx.id,
        transaction_date: tx.transactionDate || null,
        transaction_description: tx.description || null,
        transaction_amount: tx.amount || 0,
        transaction_reference: tx.reference || null,

        bank_account_name: activePreset?.bank_name || null,
        bank_account_id: selectedBankAccount || null,
        bank_account_number: null,

        allocation_status: "unallocated",
        split_allocations: tx.splitAllocations || [],

        queue: "review",
        posting_status: "not_posted",

        imported_batch_reference: batchRef,
        imported_at: new Date().toISOString(),

        statement_id: statement.id,
      });

    if (upsertError) {
  console.error(
    "Import: upsert error:",
    upsertError.message,
    upsertError.code,
    upsertError.details
  );

  await supabase
    .from("bank_transactions")
    .delete()
    .eq("imported_batch_reference", batchRef)
    .eq("statement_id", statement.id);

  await supabase
    .from("bank_statements")
    .delete()
    .eq("id", statement.id);

  setMessage({
    type: "error",
    text: `Transaction import failed: ${upsertError.message}`,
  });

  setLoading(false);
  return;
}
  }

  /*
   * Only update the bank account balance when the source
   * actually supplied a verified closing balance.
   */
  if (closingBalance !== null) {
    const { error: balanceError } = await supabase
      .from("bank_accounts")
      .update({
        current_balance: closingBalance,
        statement_balance: closingBalance,
      })
      .eq("id", selectedBankAccount);

    if (balanceError) {
      console.error(
        "Import: failed to update account balance:",
        balanceError
      );

      setMessage({
        type: "error",
        text:
          "The statement was imported, but the bank account balance could not be updated.",
      });

      setLoading(false);
      return;
    }
  }

  /*
   * Reconciliation happens after canonical ingestion.
   * Reconciliation does not itself mean posting.
   */
  const recon = await runReconciliationEngine(selectedEntity);

  const importedCount = transactions.length;

  if (recon.total > 0) {
    setMessage({
      type: "success",
      text:
        `${importedCount} transactions imported. ` +
        `${recon.autoAllocated} matched automatically, ` +
        `${recon.partiallyAllocated} flagged for review, ` +
        `${recon.unallocated} require manual allocation.`,
    });
  } else {
    setMessage({
      type: "success",
      text:
        `${importedCount} transactions imported into Cash Book for reconciliation.`,
    });
  }

  setLoading(false);
  return;
}
  setMessage({
    type: "error",
    text: "Import failed. Please check the file format and try again.",
  });
  setLoading(false);
}

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
          Upload bank statements into the Cash Book. Imported transactions are validated, reconciled and routed through the governed allocation and posting workflow.
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
              <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-[var(--bg-secondary)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
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

      {/* Entity & Bank Account Selector */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Entity</p>
          <CustomDropdown
            value={selectedEntity}
            options={entities.map((e: any) => ({ id: e.id, label: e.entity_name }))}
            onChange={(id: string) => { setSelectedEntity(id); setSelectedBankAccount(""); }}
            placeholder="Select entity..."
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Bank Account</p>
          <CustomDropdown
            value={selectedBankAccount}
            options={bankAccounts.map((a: any) => ({ id: a.id, label: `${a.bank_name} - ${a.account_name} (${a.account_number})` }))}
            onChange={setSelectedBankAccount}
            placeholder="Select account..."
            disabled={!selectedEntity}
          />
        </div>
      </div>

      {/* Upload */}
      <ImportDropzone
        title="Bank Statement Import"
        description="Upload your bank statement. Transactions are validated, reconciled and routed through the governed allocation and posting workflow."
        loading={loading}
        fileName={fileName}
        onFileSelect={handleImport}
      />

      {/* Import History */}
      {importHistory.length > 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-[var(--bg-secondary)] p-6">
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
        <div className="rounded-3xl border border-zinc-800 bg-[var(--bg-secondary)] p-12 text-center">
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

// CustomDropdown component
function CustomDropdown({ value, options, onChange, placeholder, disabled }: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find(o => o.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-600 flex items-center justify-between ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
      >
        <span className={selected ? "text-white" : "text-zinc-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-zinc-500 text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-[var(--bg-secondary)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === opt.id ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}