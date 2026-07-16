// lib/financial/types.ts
// AssetFlow Financial Operating Platform Types

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type PeriodType = 'statement' | 'financial' | 'year';
export type PeriodStatus = 'open' | 'ready_to_close' | 'pending_review' | 'closed';
export type VatCategory = 'standard' | 'zero_rated' | 'exempt' | 'non_vatable';
export type JournalType = 'sales_invoice' | 'sales_credit_note' | 'cash_receipt' | 'purchase_invoice' | 'purchase_credit_note' | 'cash_payment' | 'bank_transfer' | 'bank_charge' | 'bank_interest' | 'general_journal' | 'opening_balance' | 'closing_entry' | 'accrual' | 'reversal';
export type DepositStatus = 'requested' | 'held' | 'partially_applied' | 'refunded' | 'closed';
export type IntegrityLevel = 'info' | 'warning' | 'critical';

export interface ChartAccount {
  id: string; entity_id: string; gl_code: string; account_name: string;
  account_type: AccountType; category: string; is_vatable: boolean;
  vat_rate: number; vat_category: VatCategory; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface FinancialPeriod {
  id: string; entity_id: string; period_type: PeriodType;
  period_name: string; start_date: string; end_date: string;
  status: PeriodStatus; closed_at?: string; closed_by?: string;
}

export interface PostingTemplate {
  id: string; entity_id: string; business_event: string;
  description?: string; is_active: boolean; priority: number;
  version: number; lines?: PostingTemplateLine[];
}

export interface PostingTemplateLine {
  id: string; template_id: string; sequence: number;
  direction: 'debit' | 'credit'; account_resolver: string;
  amount_formula: string; vat_treatment: VatCategory;
  vat_account_resolver?: string; condition_formula?: string;
  dimension_mapping: Record<string, string>;
}

export interface Journal {
  id: string; entity_id: string; journal_number: string;
  journal_type: JournalType; description?: string; period_id: string;
  source_event: string; source_id?: string; reference?: string;
  template_id?: string; template_version?: number;
  is_posted: boolean; posted_at?: string;
  explanation?: PostingExplanation; created_by?: string; created_at: string;
  lines?: JournalLine[];
}

export interface PostingExplanation {
  business_event: string; template_id: string; template_version: number;
  resolved_accounts: Array<{ account_name: string; gl_code: string; direction: string; amount: number }>;
  vat_decision: { treatment: string; rate: number; reason: string };
  period: { id: string; name?: string };
  dimensions: Record<string, string | null>;
  overrides_applied: string[]; settings_used: Record<string, any>;
  natural_language: string;
}

export interface JournalLine {
  id: string; journal_id: string; account_id: string; description?: string;
  debit_amount: number; credit_amount: number; vat_amount: number;
  vat_rate?: number;
  entity_id?: string; property_id?: string | null;
  lease_id?: string | null; tenant_id?: string | null;
  supplier_id?: string | null; broker_id?: string | null;
  cost_centre?: string | null; created_at: string;
}

export interface GeneralLedgerEntry {
  id: string; entity_id: string; account_id: string; period_id: string;
  journal_line_id: string; debit_amount: number; credit_amount: number; posted_at: string;
}

export interface FinancialEvent {
  id?: string; source_engine: string; business_event: string;
  entity_id: string; amount: number; vat_amount?: number;
  vat_treatment?: VatCategory; currency?: string;
  occurred_at?: string; effective_date?: string;
  correlation_id?: string; causation_id?: string;
  reference?: string; description?: string; period_id?: string;
  dimensions: FinancialEventDimensions; metadata?: Record<string, any>;
}

export interface FinancialEventDimensions {
  property_id?: string; lease_id?: string; tenant_id?: string;
  supplier_id?: string; broker_id?: string; cost_centre?: string;
}

export interface PostingResult {
  journal: Journal; balanced: boolean; explanation: PostingExplanation;
}

export interface Deposit {
  id: string; entity_id: string; tenant_id: string; lease_id: string;
  property_id: string; original_amount: number; interest_accrued: number;
  amount_applied: number; amount_refunded: number; current_balance: number;
  status: DepositStatus; held_since: string; last_activity_at: string;
}

export interface IntegrityLogEntry {
  id: string; entity_id: string; period_id?: string;
  check_type: string; level: IntegrityLevel; message: string; acknowledged: boolean;
}

export interface CloseChecklistItem {
  id: string; entity_id: string; period_id: string;
  checklist_item: string; category: string; status: string;
  acknowledged_by?: string; acknowledged_at?: string; acknowledgement_reason?: string;
}

export interface TrialBalanceLine {
  account_id: string; account_name: string; gl_code: string;
  account_type: string; total_debits: number; total_credits: number; net_balance: number;
}

export interface FinancialIntegrityScore {
  score: number; max_score: number; percentage: number;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}

export interface BankAccount {
  id: string; entity_id: string; property_id?: string;
  bank_name: string; account_name: string; account_number: string;
  branch_code?: string; account_type: string; currency: string;
  gl_account_id?: string; is_active: boolean;
  opening_balance: number; current_balance: number;
}

export interface BankStatement {
  id: string; bank_account_id: string; entity_id: string;
  statement_date: string; opening_balance: number; closing_balance: number;
  status: string; imported_at: string;
}

export interface BankTransaction {
  id: string; bank_account_id: string; statement_id?: string;
  entity_id: string; transaction_date: string; description?: string;
  reference?: string; amount: number; type: string;
  is_reconciled: boolean; statement_running_balance?: number;
  matched_invoice_id?: string; matched_payment_id?: string; matched_journal_id?: string;
}

export interface SubLedgerEntry {
  id: string; entity_id: string; ledger_type: string;
  journal_line_id?: string; account_id?: string;
  reference_type?: string; reference_id?: string;
  description?: string; debit_amount: number; credit_amount: number;
  running_balance: number; tenant_id?: string | null;
  supplier_id?: string | null; broker_id?: string | null;
  bank_account_id?: string | null; property_id?: string | null;
  lease_id?: string | null; posted_at: string;
}

export interface Recovery {
  id: string; entity_id: string; property_id: string; lease_id?: string;
  recovery_category: string; budgeted_amount: number;
  actual_expense: number; recovered_amount: number;
  recovery_rate?: number; period_id?: string;
  status: string; true_up_status: string;
}

export interface FinancialTimelineEntry {
  id: string; entity_id: string; reference_type: string;
  reference_id: string; event_type: string; description?: string;
  actor_id?: string; correlation_id?: string; event_id?: string;
  source_engine?: string; metadata: Record<string, any>; created_at: string;
}

export interface LedgerQuery {
  entity_id: string; ledger_type: string;
  tenant_id?: string; supplier_id?: string; broker_id?: string;
  bank_account_id?: string; property_id?: string;
  from_date?: string; to_date?: string;
}

export interface RecoveryCalculation {
  property_id: string; category: string; period_id: string;
  actual_expense: number; tenant_share_pct: number;
  calculated_recovery: number; status: string;
}

export interface BankReconciliationResult {
  transaction: BankTransaction;
  matched: boolean; matched_type?: string;
  matched_id?: string; confidence: number; suggestion?: string;
}

export interface ReversalResult {
  original_journal_id: string;
  reversal_journal: Journal;
  explanation: PostingExplanation;
}
