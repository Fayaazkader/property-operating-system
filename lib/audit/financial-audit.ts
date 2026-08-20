// lib/audit/financial-audit.ts
// Financial audit trail — every financial action is logged

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FinancialAuditEntry {
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_label?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
}

export async function logFinancialAction(
  entry: FinancialAuditEntry,
  db: SupabaseClient = supabase
): Promise<void> {
  try {
    await db.from('audit_log').insert({
      user_id: entry.user_id || null,
      user_email: entry.user_email || null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      resource_label: entry.resource_label || null,
      old_values: entry.old_values || null,
      new_values: entry.new_values || null,
      ip_address: null,
      user_agent: null,
    });
  } catch (err) {
    console.error('Failed to write financial audit:', err);
  }
}
