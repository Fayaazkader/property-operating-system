import { supabase } from '@/lib/supabase';

export interface TenantRepository {
  create(data: TenantInput): Promise<{ id: string }>;
  findDuplicate(name: string, vatNumber: string): Promise<any[]>;
}

export interface TenantInput {
  tenant_name: string;
  company_registration?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  entity_id: string;
  tenant_type: string;
  status: string;
  kyc_status: string;
  code: string;
}

export class SupabaseTenantRepository implements TenantRepository {
  async create(data: TenantInput): Promise<{ id: string }> {
    const { data: tenant, error } = await supabase.from('tenants').insert(data).select('id').single();
    if (error) throw error;
    return tenant;
  }

  async findDuplicate(name: string, vatNumber: string): Promise<any[]> {
    const { data } = await supabase.from('tenants').select('id, tenant_name, vat_number').or(`tenant_name.ilike.%${name}%,vat_number.eq.${vatNumber}`).limit(5);
    return data || [];
  }
}
