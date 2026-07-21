'use client';

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getNextPeriod } from "@/lib/periods/period-utils";
import { closeStatementPeriod, closeFinancialPeriod } from "@/lib/periods/period-actions";
import { getPreBillingChecks, getCloseValidations, type BillingStats, type ReceiptStats } from "@/lib/periods/period-validation";

type StatementStatus = 'open' | 'billing_run' | 'ready_to_close' | 'closed';
type FinancialStatus = 'open' | 'closing' | 'closed';

interface PeriodState {
  loading: boolean;
  statementPeriod: string;
  statementStatus: StatementStatus;
  financialPeriod: string;
  financialStatus: FinancialStatus;
  nextStatementPeriod: string;
  nextFinancialPeriod: string;
  receiptStats: ReceiptStats;
  billingStats: BillingStats;
  billingRunStartedBy: string;
  billingRunStartedAt: string;
}

const initialState: PeriodState = {
  loading: false,
  statementPeriod: "July 2026",
  statementStatus: "open",
  financialPeriod: "June 2026",
  financialStatus: "open",
  nextStatementPeriod: "August 2026",
  nextFinancialPeriod: "July 2026",
  receiptStats: { receipts: 0, allocated: 0, unreconciled: 0, cashbookBalanced: false },
  billingStats: { totalTenants: 2100, invoicesGenerated: 0, invoicesOutstanding: 2100, chargesAddedAfterStart: 0, invoicesRequiringRegen: 0, billingExceptions: 0 },
  billingRunStartedBy: "",
  billingRunStartedAt: "",
};

export function usePeriodData() {
  const [state, setState] = useState<PeriodState>(initialState);

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // Load statement period
      const { data: stmtPeriod } = await supabase
        .from("statement_periods")
        .select("period_name, status")
        .eq("status", "open")
        .order("period_start", { ascending: false })
        .limit(1)
        .single();
      
      if (stmtPeriod) {
        setState(prev => ({
          ...prev,
          statementPeriod: stmtPeriod.period_name,
          statementStatus: stmtPeriod.status as StatementStatus,
          nextStatementPeriod: getNextPeriod(stmtPeriod.period_name),
        }));
      }

      // Load financial period
      const { data: finPeriod } = await supabase
        .from("financial_periods")
        .select("period_name, status")
        .eq("status", "open")
        .order("period_start", { ascending: false })
        .limit(1)
        .single();
      
      if (finPeriod) {
        setState(prev => ({
          ...prev,
          financialPeriod: finPeriod.period_name,
          financialStatus: finPeriod.status as FinancialStatus,
          nextFinancialPeriod: getNextPeriod(finPeriod.period_name),
        }));
      }

      // Load receipt stats
      const { data: txData } = await supabase
        .from("bank_transactions")
        .select("allocation_status, transaction_amount")
        .eq("allocation_status", "posted");
      
      const { count: unreconciled } = await supabase
        .from("bank_transactions")
        .select("id", { count: "exact" })
        .neq("allocation_status", "posted");

      setState(prev => ({
        ...prev,
        receiptStats: {
          receipts: txData?.length || 0,
          allocated: txData?.reduce((s: number, t: any) => s + Math.abs(t.transaction_amount || 0), 0) || 0,
          unreconciled: unreconciled || 0,
          cashbookBalanced: (unreconciled || 0) === 0,
        },
        loading: false,
      }));
    } catch (error) {
      console.error("Error loading period data:", error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const startBillingRun = useCallback(async () => {
    const checks = getPreBillingChecks(state.receiptStats);
    const allPassed = checks.every(c => c.passed);
    
    if (!allPassed) {
      return { success: false, validations: checks };
    }

    setState(prev => ({
      ...prev,
      statementStatus: "billing_run",
      billingRunStartedBy: "Finance Manager",
      billingRunStartedAt: new Date().toLocaleString("en-ZA", { 
        day: "numeric", 
        month: "short", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit" 
      }),
      billingStats: { totalTenants: 2100, invoicesGenerated: 0, invoicesOutstanding: 2100, chargesAddedAfterStart: 0, invoicesRequiringRegen: 0, billingExceptions: 0 },
    }));

    return { success: true, validations: checks };
  }, [state.receiptStats]);

  const simulateProgress = useCallback(() => {
    if (state.statementStatus !== "billing_run") return;
    
    const generated = Math.min(state.billingStats.invoicesGenerated + 350, state.billingStats.totalTenants);
    const outstanding = state.billingStats.totalTenants - generated;
    const newStats = {
      ...state.billingStats,
      invoicesGenerated: generated,
      invoicesOutstanding: outstanding,
      chargesAddedAfterStart: state.billingStats.chargesAddedAfterStart + Math.floor(Math.random() * 15),
      invoicesRequiringRegen: Math.floor(Math.random() * 10),
    };
    
    setState(prev => ({
      ...prev,
      billingStats: newStats,
      statementStatus: outstanding === 0 ? "ready_to_close" : prev.statementStatus,
    }));
  }, [state.statementStatus, state.billingStats]);

  const closeStatement = useCallback(async () => {
    const validations = getCloseValidations(state.billingStats);
    const allPassed = validations.every(v => v.passed);
    
    if (!allPassed) {
      return { success: false, validations };
    }

    const result = await closeStatementPeriod(state.statementPeriod);
    
    if (result.success) {
      setState(prev => ({
        ...prev,
        statementStatus: "closed",
        nextStatementPeriod: getNextPeriod(result.nextPeriod),
      }));
    }
    
    return result;
  }, [state.statementPeriod, state.billingStats]);

  const closeFinancial = useCallback(async () => {
    const result = await closeFinancialPeriod(state.financialPeriod);
    
    if (result.success) {
      setState(prev => ({
        ...prev,
        financialStatus: "closed",
        financialPeriod: result.nextPeriod,
        nextFinancialPeriod: getNextPeriod(result.nextPeriod),
      }));
    }
    
    return result;
  }, [state.financialPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    loadData,
    startBillingRun,
    simulateProgress,
    closeStatement,
    closeFinancial,
  };
}
