import { supabase } from '@/lib/supabase';

export interface LeaseRepository {
  create(data: LeaseInput): Promise<{ id: string }>;
}

export interface LeaseInput {
  client_id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  owner_entity_id: string;
  lease_id: string;
  lease_status: string;
  monthly_rental: number;
  lease_start_date: string;
  lease_end_date: string;
  escalation_percent: number;
  deposit_amount: number;
  parking_bays: number;
  parking_rate: number;
  lease_type: string;
}

export class SupabaseLeaseRepository implements LeaseRepository {
  async create(data: LeaseInput): Promise<{ id: string }> {
    const { data: lease, error } = await supabase.from('leases').insert(data).select('id').single();
    if (error) throw error;
    return lease;
  }
}
