import { supabase } from '@/lib/supabase';

export interface DuplicateResult {
  found: boolean;
  isBlocking: boolean;
  matches: Array<{ id: string; tenant_name: string; vat_number: string; matchType: string }>;
}

export class DuplicateDetectionService {
  async check(tenantName: string, vatNumber: string): Promise<DuplicateResult> {
    const { data } = await supabase.from('tenants')
      .select('id, tenant_name, vat_number')
      .or(`tenant_name.ilike.%${tenantName}%,vat_number.eq.${vatNumber}`)
      .limit(5);

    if (!data?.length) return { found: false, isBlocking: false, matches: [] };

    const matches = data.map(t => ({
      id: t.id,
      tenant_name: t.tenant_name,
      vat_number: t.vat_number,
      matchType: t.vat_number === vatNumber ? 'VAT match — blocking' : 'Name match',
    }));

    const isBlocking = data.some(t => t.vat_number === vatNumber);

    return { found: true, isBlocking, matches };
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
