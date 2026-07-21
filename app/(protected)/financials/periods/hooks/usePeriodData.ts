'use client';

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { startBillingRun, closeStatementPeriod, closeFinancialPeriod } from "@/lib/periods/period-actions";
import { billingStatusService } from "@/lib/revenue/billing-status-service";
import { reconciliationStatusService } from "@/lib/cashbook/reconciliation-status-service";
import { tbStatusService } from "@/lib/financial/tb-status-service";
import type { PeriodActionResult } from "@/lib/periods/period-actions";

type StatementPhase = 'open' | 'receipting' | 'allocation' | 'billing_requested' | 'billing_running' | 'billing_complete' | 'exception_review' | 'ready_to_close' | 'closed';
type FinancialPhase = 'open' | 'closing' | 'closed';

async function safelyGetPeriod(eid: string, type: string) {
  const { data } = await supabase.from('financial_periods').select('period_name, status, workflow_phase').eq('entity_id', eid).eq('period_type', type).order('period_start').limit(1);
  return data?.[0] || null;
}

export function usePeriodData() {
  const [loading, setLoading] = useState(true);
  const [entityId, setEntityId] = useState("");
  const [statementPeriod, setStatementPeriod] = useState("");
  const [statementPhase, setStatementPhase] = useState<StatementPhase>("open");
  const [financialPeriod, setFinancialPeriod] = useState("");
  const [financialPhase, setFinancialPhase] = useState<FinancialPhase>("open");
  const [activeLeases, setActiveLeases] = useState(0);
  const [invoicesGenerated, setInvoicesGenerated] = useState(0);
  const [unreconciled, setUnreconciled] = useState(0);
  const [cashbookBalanced, setCashbookBalanced] = useState(false);
  const [tbBalanced, setTbBalanced] = useState(false);

  // loadData — reads authoritative state from domain. No inference. No transitions.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || "";
      if (!eid) { setLoading(false); return; }
      setEntityId(eid);

      const [stmtPeriod, finPeriod, billing, recon, tb] = await Promise.all([
        safelyGetPeriod(eid, 'statement'),
        safelyGetPeriod(eid, 'financial'),
        billingStatusService.getStatus(eid),
        reconciliationStatusService.getStatus(eid),
        tbStatusService.getStatus(eid),
      ]);

      // Phase comes DIRECTLY from the database — domain is the source of truth
      setStatementPeriod(stmtPeriod?.period_name || "");
      setStatementPhase((stmtPeriod?.workflow_phase || stmtPeriod?.status || 'open') as StatementPhase);
      setFinancialPeriod(finPeriod?.period_name || "");
      setFinancialPhase((finPeriod?.workflow_phase || finPeriod?.status || 'open') as FinancialPhase);
      setActiveLeases(billing.activeLeases);
      setInvoicesGenerated(billing.invoicesGenerated);
      setUnreconciled(recon.unreconciled);
      setCashbookBalanced(recon.balanced);
      setTbBalanced(tb.balanced);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  // Actions — invoke domain, then reload authoritative state. UI never sets phase.
  const startBilling = useCallback(async (): Promise<PeriodActionResult> => {
    const result = await startBillingRun(entityId, statementPeriod);
    await loadData(); // Reload from domain — domain owns the phase
    return result;
  }, [entityId, statementPeriod, loadData]);

  const closeStatement = useCallback(async (): Promise<PeriodActionResult> => {
    const result = await closeStatementPeriod(entityId, statementPeriod);
    await loadData();
    return result;
  }, [entityId, statementPeriod, loadData]);

  const closeFinancial = useCallback(async (): Promise<PeriodActionResult> => {
    const result = await closeFinancialPeriod(entityId, financialPeriod);
    await loadData();
    return result;
  }, [entityId, financialPeriod, loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  return { loading, entityId, statementPeriod, statementPhase, financialPeriod, financialPhase, activeLeases, invoicesGenerated, unreconciled, cashbookBalanced, tbBalanced, startBillingRun: startBilling, closeStatement, closeFinancial };
}
