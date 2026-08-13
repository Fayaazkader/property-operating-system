// lib/revenue/portfolio-history.ts
// Aggregates billing history across multiple entities

import { supabase } from '@/lib/supabase';

export interface PortfolioHistoryEntry {
  entity_id: string;
  period: string;
  property_name: string;
  tenant_count: number;
  invoices_generated: number;
  emails_delivered: number;
  whatsapp_delivered: number;
  failed: number;
  generated_at: string;
}

export async function getPortfolioHistory(entityIds: string[]): Promise<PortfolioHistoryEntry[]> {
  const { data } = await supabase
    .from('billing_snapshots')
    .select('*')
    .in('entity_id', entityIds)
    .order('generated_at', { ascending: false });

  return (data || []) as PortfolioHistoryEntry[];
}
