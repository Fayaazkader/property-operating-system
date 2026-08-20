// lib/financial/accounting-resolver.ts
// Resolves entity-configured accounts for business roles
// Tax treatment is explicit — never inferred from account or rate

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedAccount {
  accountId: string;
  glCode: string;
  accountName: string;
  accountType: string;
  taxCode: string;
  taxRate: number;
}

export interface ResolveParams {
  entityId: string;
  businessRole: string;
  taxCode?: string;
}

export async function resolveConfiguredAccount(
  params: ResolveParams,
  db: SupabaseClient = supabase
): Promise<ResolvedAccount | null> {
  const { data: config } = await db
    .from('accounting_config')
    .select('account_id')
    .eq('entity_id', params.entityId)
    .eq('business_role', params.businessRole)
    .eq('is_active', true)
    .maybeSingle();

  if (!config) return null;

  const { data: account } = await db
    .from('chart_of_accounts')
    .select('id, gl_code, account_name, account_type')
    .eq('id', config.account_id)
    .single();

  if (!account) return null;

  // If tax code provided, resolve it. Otherwise NO_VAT.
  const taxCode = params.taxCode || 'NO_VAT';

  const { data: tax } = await db
    .from('tax_config')
    .select('tax_code, tax_rate')
    .eq('entity_id', params.entityId)
    .eq('tax_code', taxCode)
    .eq('is_active', true)
    .single();

  return {
    accountId: account.id,
    glCode: account.gl_code,
    accountName: account.account_name,
    accountType: account.account_type,
    taxCode: tax?.tax_code || 'NO_VAT',
    taxRate: Number(tax?.tax_rate || 0),
  };
}

export async function getBusinessRoles(): Promise<string[]> {
  // AssetFlow-controlled vocabulary
  return [
    'bank_control',
    'ar_control',
    'ap_control',
    'rental_income_commercial',
    'rental_income_residential',
    'recovery_utilities',
    'recovery_operating',
    'penalty_income',
    'fee_income',
    'interest_income',
    'deposit_liability',
    'vat_output',
    'vat_input',
    'repairs_maintenance',
  ];
}
