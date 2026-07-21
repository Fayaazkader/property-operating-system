'use client';

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getNextPeriod } from "@/lib/periods/period-utils";
import { closeStatementPeriod, closeFinancialPeriod } from "@/lib/periods/period-actions";
import { getPreBillingChecks, getCloseValidations, type BillingStats, type ReceiptStats } from "@/lib/periods/period-validation";
import { getCurrentStatementPeriod, getCurrentFinancialPeriod } from "@/lib/revenue/period-utils";

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
}

const emptyReceiptStats: ReceiptStats = {
  receipts: 0,
  allocated: 0,
  unreconciled: 0,
  cashbookBalanced: false,
};

const emptyBillingStats: BillingStats = {
  totalTenants: 0,
  invoicesGenerated: 0,
  invoicesOutstanding: 0,
  chargesAddedAfterStart: 0,
  invoicesRequiringRegen: 0,
  billingExceptions: 0,
};

const initialState: PeriodState = {
  loading: true,
  statementPeriod: "",
  statementStatus: "open",
  financialPeriod: "",
  financialStatus: "open",
  nextStatementPeriod: "",
  nextFinancialPeriod: "",
  receiptStats: emptyReceiptStats,
  billingStats: emptyBillingStats,
};

export function usePeriodData() {
  const [state, setState] = useState<PeriodState>(initialState);

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // Use existing revenue period-utils
      const stmtPeriod = await getCurrentStatementPeriod();
      if (stmtPeriod) {
        setState(prev => ({
          ...prev,
          statementPeriod: stmtPeriod.name,
          statementStatus: stmtPeriod.status as StatementStatus,
          nextStatementPeriod: getNextPeriod(stmtPeriod.name),
        }));
      }

      const finPeriod = await getCurrentFinancialPeriod();
      if (finPeriod) {
        setState(prev => ({
          ...prev,
          financialPeriod: finPeriod.name,
          financialStatus: finPeriod.status as FinancialStatus,
          nextFinancialPeriod: getNextPeriod(finPeriod.name),
        }));
      }

      // Load receipt stats from bank_transactions
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
      billingStats: {
        totalTenants: 2100,
        invoicesGenerated: 0,
        invoicesOutstanding: 2100,
        chargesAddedAfterStart: 0,
        invoicesRequiringRegen: 0,
        billingExceptions: 0,
      },
    }));

    return { success: true, validations: checks };
  }, [state.receiptStats]);

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
    closeStatement,
    closeFinancial,
  };
}
