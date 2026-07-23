// lib/reporting/providers/vat-report.ts
// Consumes the official vat_returns table. Never recalculates.

import { supabase } from '@/lib/supabase';

export async function getVatReportData(entityId: string, periodId: string) {
  const { data: vatReturn } = await supabase
    .from('vat_returns')
    .select('*')
    .eq('entity_id', entityId)
    .eq('period_id', periodId)
    .single();

  if (!vatReturn) {
    return { headers: ['Description', 'Amount'], rows: [['VAT not yet calculated for this period', '']], totals: [] };
  }

  const rows: string[][] = [
    ['OUTPUT VAT (Box 1)', vatReturn.output_vat.toLocaleString()],
    ['INPUT VAT (Box 2)', vatReturn.input_vat.toLocaleString()],
    ['', ''],
    ['NET VAT ' + (vatReturn.net_vat >= 0 ? 'PAYABLE (Box 3)' : 'REFUNDABLE'), Math.abs(vatReturn.net_vat).toLocaleString()],
    ['', ''],
    ['Status', vatReturn.status],
    ['Filed', vatReturn.filed_at ? new Date(vatReturn.filed_at).toLocaleDateString() : 'Not yet filed'],
  ];

  return { headers: ['Description', 'Amount'], rows, totals: [] };
}
