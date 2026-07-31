import { supabase } from '@/lib/supabase';

export class LeaseNumberService {
  async generate(propertyCode: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_lease_number', { property_code: propertyCode });
    if (error) throw error;
    return data;
  }
}

export const leaseNumberService = new LeaseNumberService();
