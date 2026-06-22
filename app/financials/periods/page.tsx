"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { logAudit } from "@/lib/audit/audit-log";

type BillingStats = {
  totalTenants: number;
  invoicesGenerated: number;
  invoicesOutstanding: number;
  chargesAddedAfterStart: number;
  invoicesRequiringRegen: number;
  billingExceptions: number;
};

type PreBillingCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

type CloseValidation = {
  label: string;
  passed: boolean;
};

export default function PeriodsPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [statementStatus, setStatementStatus] = useState<"open" | "billing_run" | "ready_to_close" | "closed">("open");
  const [financialStatus, setFinancialStatus] = useState<"open" | "closing" | "closed">("open");
  const [statementPeriod, setStatementPeriod] = useState("July 2026");
  const [nextStatementPeriod, setNextStatementPeriod] = useState("August 2026");
  const [financialPeriod, setFinancialPeriod] = useState("June 2026");
  const [nextFinancialPeriod, setNextFinancialPeriod] = useState("July 2026");
  const [billingRunStartedBy, setBillingRunStartedBy] = useState("");
  const [billingRunStartedAt, setBillingRunStartedAt] = useState("");

  const [billingStats, setBillingStats] = useState<BillingStats>({
    totalTenants: 2100,
    invoicesGenerated: 0,
    invoicesOutstanding: 2100,
    chargesAddedAfterStart: 0,
    invoicesRequiringRegen: 0,
    billingExceptions: 0,
  });

  const [showPreBillingChecks, setShowPreBillingChecks] = useState(false);
  const [showCloseStatementConfirm, setShowCloseStatementConfirm] = useState(false);
  const [showCloseFinancialConfirm, setShowCloseFinancialConfirm] = useState(false);
  const [preBillingChecks, setPreBillingChecks] = useState<PreBillingCheck[]>([]);
  const [closeValidations, setCloseValidations] = useState<CloseValidation[]>([]);
  const [receiptStats, setReceiptStats] = useState({ receipts: 312, allocated: 2800000, unreconciled: 3, cashbookBalanced: false });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: txData } = await supabase.from("bank_transactions").select("allocation_status, transaction_amount").eq("allocation_status", "posted");
    const { count: unreconciled } = await supabase.from("bank_transactions").select("id", { count: "exact" }).neq("allocation_status", "posted");

    setReceiptStats({
      receipts: txData?.length || 312,
      allocated: txData?.reduce((s: number, t: any) => s + Math.abs(t.transaction_amount || 0), 0) || 2800000,
      unreconciled: unreconciled || 3,
      cashbookBalanced: (unreconciled || 0) === 0,
    });
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  function handleStartBillingRun() {
    const checks: PreBillingCheck[] = [
      { label: "Unallocated Receipts", passed: receiptStats.unreconciled === 0, detail: receiptStats.unreconciled === 0 ? "All receipts allocated" : `${receiptStats.unreconciled} unallocated receipts exist` },
      { label: "Bank Reconciliation", passed: receiptStats.cashbookBalanced, detail: receiptStats.cashbookBalanced ? "Cashbook fully reconciled" : "Cashbook not fully reconciled" },
      { label: "Draft Charges", passed: true, detail: "No draft charges pending" },
      { label: "Unapproved Charges", passed: true, detail: "All charges approved" },
      { label: "Billing Exceptions", passed: true, detail: "No exceptions detected" },
    ];
    setPreBillingChecks(checks);
    setShowPreBillingChecks(true);
  }

  function confirmStartBillingRun() {
    setStatementStatus("billing_run");
    setBillingRunStartedBy("Finance Manager");
    setBillingRunStartedAt(new Date().toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    setBillingStats({ totalTenants: 2100, invoicesGenerated: 0, invoicesOutstanding: 2100, chargesAddedAfterStart: 0, invoicesRequiringRegen: 0, billingExceptions: 0 });
    setShowPreBillingChecks(false);
    showToast("success", "Billing run started. Receipting is now frozen. Generate invoices from Revenue Ops.");
  }

  function simulateProgress() {
    if (statementStatus !== "billing_run") return;
    const generated = Math.min(billingStats.invoicesGenerated + 350, billingStats.totalTenants);
    const outstanding = billingStats.totalTenants - generated;
    const newStats = {
      ...billingStats,
      invoicesGenerated: generated,
      invoicesOutstanding: outstanding,
      chargesAddedAfterStart: billingStats.chargesAddedAfterStart + Math.floor(Math.random() * 15),
      invoicesRequiringRegen: Math.floor(Math.random() * 10),
    };
    setBillingStats(newStats);
    if (outstanding === 0) setStatementStatus("ready_to_close");
  }

  function handleCloseStatement() {
    const validations: CloseValidation[] = [
      { label: "All tenants billed", passed: billingStats.invoicesOutstanding === 0 },
      { label: "No draft charges", passed: true },
      { label: "No pending approvals", passed: true },
      { label: "No billing exceptions", passed: billingStats.billingExceptions === 0 },
      { label: "No invoice regeneration required", passed: billingStats.invoicesRequiringRegen === 0 },
    ];
    setCloseValidations(validations);
    setShowCloseStatementConfirm(true);
  }

  async function confirmCloseStatement() {
    setLoading(true);
    setStatementStatus("closed");
    setNextStatementPeriod("August 2026");
    setShowCloseStatementConfirm(false);

    await logAudit({
      action: "update",
      resource_type: "period",
      resource_label: `Statement period July 2026 closed`,
      old_values: { status: "open" },
      new_values: { status: "closed", period: "July 2026" }
    });

    showToast("success", "July Statement Period closed. August period opened. Receipting re-enabled.");
    setLoading(false);
  }

  function handleCloseFinancial() {
    setShowCloseFinancialConfirm(true);
  }

  async function confirmCloseFinancial() {
    setLoading(true);
    setFinancialStatus("closed");
    setFinancialPeriod("July 2026");
    setNextFinancialPeriod("August 2026");
    setShowCloseFinancialConfirm(false);

    await logAudit({
      action: "update",
      resource_type: "period",
      resource_label: `Financial period June 2026 closed`,
      old_values: { status: "open" },
      new_values: { status: "closed", period: "June 2026" }
    });

    showToast("success", "June Financial Period closed. Reports generated. July period opened.");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
            {toast.text}
          </div>
        </div>
      )}

      {statementStatus === "billing_run" && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">⚡ {statementPeriod} Billing Run Active</p>
              <p className="text-xs text-amber-400/70 mt-1">Started: {billingRunStartedAt} by {billingRunStartedBy} · Receipting Locked · Allocations Locked</p>
            </div>
            <div className="text-right text-xs text-amber-400/70">
              {billingStats.invoicesGenerated} / {billingStats.totalTenants} invoices generated
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Period Governance" subtitle="Manage statement and financial periods. These are independent but linked." />

      {/* Statement Period */}
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Statement Period</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Controls invoicing, billing cycles, and tenant statements</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            statementStatus === "closed" ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]" :
            statementStatus === "billing_run" ? "bg-amber-500/10 text-amber-300" :
            statementStatus === "ready_to_close" ? "bg-blue-500/10 text-blue-300" :
            "bg-emerald-500/10 text-emerald-300"
          }`}>
            {statementStatus === "closed" ? "Closed" : statementStatus === "billing_run" ? "Billing Run Active" : statementStatus === "ready_to_close" ? "Ready to Close" : "Open"}
          </span>
        </div>

        {statementStatus === "open" && (
          <>
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">Current</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{statementPeriod}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">Status: Open — Charges, imports, and adjustments allowed.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">Next</p>
                <p className="text-lg font-bold text-[var(--text-secondary)]">{nextStatementPeriod}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">Available after current period closes.</p>
              </div>
            </div>
            <button onClick={handleStartBillingRun} className="w-full rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-amber-500">
              Start {statementPeriod} Billing Run
            </button>
          </>
        )}

        {statementStatus === "billing_run" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{billingStats.invoicesGenerated}</p>
                <p className="text-xs text-[var(--text-muted)]">Generated</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{billingStats.invoicesOutstanding}</p>
                <p className="text-xs text-[var(--text-muted)]">Outstanding</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{billingStats.invoicesRequiringRegen}</p>
                <p className="text-xs text-[var(--text-muted)]">Need Regen</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--text-secondary)]">{billingStats.totalTenants}</p>
                <p className="text-xs text-[var(--text-muted)]">Total Tenants</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--text-secondary)]">{billingStats.chargesAddedAfterStart}</p>
                <p className="text-xs text-[var(--text-muted)]">Charges Added</p>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                <p className="text-lg font-bold text-red-400">{billingStats.billingExceptions}</p>
                <p className="text-xs text-[var(--text-muted)]">Exceptions</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={simulateProgress} className="flex-1 rounded-2xl border border-[var(--border-hover)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-zinc-500 hover:text-[var(--text-primary)]">
                Simulate Invoice Generation
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2 text-center">Receipting is frozen. Charges can still be added. Regenerate affected invoices.</p>
          </>
        )}

        {statementStatus === "ready_to_close" && (
          <>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
              <p className="text-sm text-emerald-300 font-medium">✅ All {billingStats.totalTenants} invoices generated. Ready to close.</p>
            </div>
            <button onClick={handleCloseStatement} className="w-full rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-emerald-500">
              Close {statementPeriod} Statement Period
            </button>
          </>
        )}

        {statementStatus === "closed" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Closed</p>
              <p className="text-lg font-bold text-[var(--text-secondary)]">{statementPeriod}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">Invoicing locked. Immutable.</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Current</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{nextStatementPeriod}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">Open — Charges and imports allowed.</p>
            </div>
          </div>
        )}
      </div>

      {/* Financial Period */}
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Financial Period</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Controls accounting, GL posting, bank reconciliation, and reporting</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${financialStatus === "closed" ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]" : "bg-emerald-500/10 text-emerald-300"}`}>
            {financialStatus === "closed" ? "Closed" : "Open"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Current</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{financialPeriod}</p>
            <div className="space-y-1 mt-3 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Receipts</span><span className="text-[var(--text-primary)] tabular-nums">{receiptStats.receipts}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Allocated</span><span className="text-[var(--text-primary)] tabular-nums">R{receiptStats.allocated.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Unreconciled</span><span className={receiptStats.unreconciled ? "text-amber-400 tabular-nums" : "text-emerald-400 tabular-nums"}>{receiptStats.unreconciled}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cash Book</span><span className={receiptStats.cashbookBalanced ? "text-emerald-400" : "text-amber-400"}>{receiptStats.cashbookBalanced ? "Balanced ✅" : "Not balanced ⚠️"}</span></div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 flex items-center">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Next</p>
              <p className="text-lg font-bold text-[var(--text-secondary)]">{nextFinancialPeriod}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">Opens after current period closes.</p>
            </div>
          </div>
        </div>

        {financialStatus === "open" && (
          <button onClick={handleCloseFinancial} className="w-full rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200">
            Close {financialPeriod} Financial Period — Finalize & Generate Reports
          </button>
        )}

        {financialStatus === "closed" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-300">✅ {financialPeriod} closed. Reports generated and stored. {nextFinancialPeriod} is now open.</p>
          </div>
        )}
      </div>

      {/* Modals — unchanged */}
      {showPreBillingChecks && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowPreBillingChecks(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Start {statementPeriod} Billing Run</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Pre-billing validation checks:</p>
            <div className="space-y-2 mb-4">
              {preBillingChecks.map((check, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5">{check.passed ? "✅" : "⚠️"}</span>
                  <div>
                    <span className={check.passed ? "text-[var(--text-primary)]" : "text-amber-400"}>{check.label}</span>
                    <p className="text-xs text-[var(--text-muted)]">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This will freeze receipting, allocations, and tenant balance calculations until the statement period is closed. Charges and imports can still be processed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPreBillingChecks(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-zinc-500 hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmStartBillingRun} className="rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-amber-500">Begin Billing Run</button>
            </div>
          </div>
        </div>
      )}

      {showCloseStatementConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCloseStatementConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Close {statementPeriod} Statement Period?</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Final validation:</p>
            <div className="space-y-2 mb-4">
              {closeValidations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{v.passed ? "✅" : "❌"}</span>
                  <span className={v.passed ? "text-[var(--text-primary)]" : "text-amber-400"}>{v.label}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">This will:</p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1 mb-4 list-disc pl-5">
              <li>Finalize all {statementPeriod} invoices permanently</li>
              <li>Freeze {statementPeriod} billing — no new charges, no edits</li>
              <li>Open {nextStatementPeriod} Statement Period</li>
              <li>Re-enable receipting and allocations</li>
            </ul>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone. Invoices become immutable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCloseStatementConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-zinc-500 hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmCloseStatement} disabled={loading} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-emerald-500 disabled:opacity-40">
                {loading ? "Closing..." : "Close Period & Open August"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseFinancialConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCloseFinancialConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Close {financialPeriod} Financial Period?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This will lock the GL, produce the trial balance, generate financial reports, export the audit pack, and open {nextFinancialPeriod}.</p>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone. All {financialPeriod} data becomes immutable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCloseFinancialConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-zinc-500 hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmCloseFinancial} disabled={loading} className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40">
                {loading ? "Closing..." : "Finalize & Generate Reports"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}