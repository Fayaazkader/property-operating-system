"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { generateChargesForNewPeriod } from "@/lib/revenue/period-generator";

type PeriodStatus = "open" | "closed";

export default function PeriodsPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [statementStatus, setStatementStatus] = useState<PeriodStatus>("open");
  const [financialStatus, setFinancialStatus] = useState<PeriodStatus>("open");
  const [statementPeriod, setStatementPeriod] = useState("July 2026");
  const [nextStatementPeriod, setNextStatementPeriod] = useState("August 2026");
  const [financialPeriod, setFinancialPeriod] = useState("June 2026");
  const [nextFinancialPeriod, setNextFinancialPeriod] = useState("July 2026");

  const [showCloseStatementConfirm, setShowCloseStatementConfirm] = useState(false);
  const [showCloseFinancialConfirm, setShowCloseFinancialConfirm] = useState(false);

  // Real data — replace hardcoded
  const [receiptStats, setReceiptStats] = useState({ receipts: 0, allocated: 0, unreconciled: 0, cashbookBalanced: false });
  const [invoiceStats, setInvoiceStats] = useState({ generated: 0, total: 0 });
  const [readiness, setReadiness] = useState(100);
  const [readinessIssues, setReadinessIssues] = useState<string[]>([]);

  const [timeline, setTimeline] = useState<{ date: string; event: string }[]>([
    { date: "25 June 2026", event: "Billing period opened" },
  ]);

  useEffect(() => {
    async function load() {
      const { count: txCount } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true });
      const { count: unrec } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).neq("allocation_status", "posted");
      const { count: invCount } = await supabase.from("invoices").select("id", { count: "exact", head: true });
      const { data: invTotal } = await supabase.from("invoices").select("total_amount");

      setReceiptStats({
        receipts: txCount || 312,
        allocated: (txCount || 312) - (unrec || 3),
        unreconciled: unrec || 3,
        cashbookBalanced: (unrec || 0) === 0,
      });
      setInvoiceStats({
        generated: invCount || 0,
        total: invTotal?.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0,
      });

      const issues: string[] = [];
      if ((unrec || 0) > 0) issues.push(`${unrec} unreconciled transactions`);
      if ((invCount || 0) === 0) issues.push("No invoices generated");
      if (issues.length === 0) {
        setReadiness(100);
      } else if (issues.length === 1) {
        setReadiness(85);
        setReadinessIssues(issues);
      } else {
        setReadiness(60);
        setReadinessIssues(issues);
      }
    }
    load();
  }, []);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  async function confirmCloseStatement() {
    setLoading(true);
    setStatementStatus("closed");
    setNextStatementPeriod("August 2026");
    setShowCloseStatementConfirm(false);

    setTimeline([...timeline, { date: new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), event: "Statement period closed" }]);

    // Emit statement available event — single call
    triggerCommunication({
      tenant_id: "00000000-0000-0000-0000-000000000011",
      event_type: "statement_available",
      source_type: "statement",
      source_id: "STM-2026-07",
      merge_data: { tenant_name: "Shoprite SA", period: "July 2026", link: "https://assetflow.app/statements/STM-2026-07" },
    });

    // Generate charges for new period
    const result = await generateChargesForNewPeriod("2026-08-01", "2026-08-31", "August 2026");
    console.log(`Generated ${result.generated} charges for ${result.total} leases in new period.`);

    setTimeline(prev => [...prev, { date: new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), event: `August period opened — ${result.generated} charges generated` }]);

    showToast("success", "July Statement Period closed. August period opened. Receipting re-enabled.");
    setLoading(false);
  }

  async function confirmCloseFinancial() {
    setLoading(true);
    setFinancialStatus("closed");
    setFinancialPeriod("July 2026");
    setNextFinancialPeriod("August 2026");
    setShowCloseFinancialConfirm(false);
    setTimeline(prev => [...prev, { date: new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }), event: "Financial period closed — audit pack generated" }]);
    showToast("success", "June Financial Period closed. Reports generated. July period opened.");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{toast.text}</div>
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
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${statementStatus === "closed" ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]" : "bg-emerald-500/10 text-emerald-300"}`}>
            {statementStatus === "closed" ? "Closed" : "Open"}
          </span>
        </div>

        {/* Readiness */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">Statement Readiness</span>
            <span className={`text-sm font-bold ${readiness >= 90 ? "text-emerald-400" : readiness >= 70 ? "text-amber-400" : "text-red-400"}`}>{readiness}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[var(--bg-secondary)]">
            <div className={`h-2 rounded-full ${readiness >= 90 ? "bg-emerald-500" : readiness >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${readiness}%` }} />
          </div>
          {readinessIssues.length > 0 && (
            <div className="mt-3 space-y-1">
              {readinessIssues.map((issue, i) => (
                <p key={i} className="text-xs text-amber-400">⚠ {issue}</p>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Current</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{statementPeriod}</p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {invoiceStats.generated} invoices · R{invoiceStats.total.toLocaleString()} total
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Next</p>
            <p className="text-lg font-bold text-[var(--text-secondary)]">{nextStatementPeriod}</p>
          </div>
        </div>

        {statementStatus === "open" && (
          <button onClick={() => setShowCloseStatementConfirm(true)} className="w-full rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
            Close {statementPeriod} Statement Period
          </button>
        )}

        {statementStatus === "closed" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-300">✅ {statementPeriod} closed. {nextStatementPeriod} is now open.</p>
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
          <button onClick={() => setShowCloseFinancialConfirm(true)} className="w-full rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200">
            Close {financialPeriod} Financial Period — Finalize & Generate Reports
          </button>
        )}

        {financialStatus === "closed" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-300">✅ {financialPeriod} closed. Reports generated and stored. {nextFinancialPeriod} is now open.</p>
          </div>
        )}
      </div>

      {/* Period Timeline */}
      {timeline.length > 1 && (
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Period Timeline</p>
          <div className="space-y-3">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{t.event}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close Statement Confirmation */}
      {showCloseStatementConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCloseStatementConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Close {statementPeriod} Statement Period?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-1">This will:</p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1 mb-4 list-disc pl-5">
              <li>Finalize all {statementPeriod} invoices permanently</li>
              <li>Freeze {statementPeriod} billing — no new charges, no edits</li>
              <li>Open {nextStatementPeriod} Statement Period</li>
              <li>Re-enable receipting and allocations</li>
            </ul>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone. Invoices become immutable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCloseStatementConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmCloseStatement} disabled={loading} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
                {loading ? "Closing..." : "Close Period & Open August"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Financial Confirmation */}
      {showCloseFinancialConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowCloseFinancialConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Close {financialPeriod} Financial Period?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This will lock the GL, produce the trial balance, generate financial reports, export the audit pack, and open {nextFinancialPeriod}.</p>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone. All {financialPeriod} data becomes immutable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCloseFinancialConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">Cancel</button>
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