// lib/revenue/services/rates-proof-generator.ts
// Generates tenant-facing proof package for rates recovery

import { supabase } from '@/lib/supabase';

export interface TenantProofData {
  tenant_name: string;
  shop_number: string;
  property_name: string;
  effective_date: string;
  municipality_name?: string;
  previous_monthly_rates: number;
  new_monthly_rates: number;
  monthly_increase: number;
  total_gla: number;
  tenant_gla: number;
  gla_percentage: number;
  previous_monthly_charge: number;
  new_monthly_charge: number;
  back_charge_amount: number;
  back_charge_description: string;
  documents: Array<{
    document_type: string;
    file_name: string;
    file_url: string;
    snippet_url?: string;
  }>;
}

export const ratesProofGenerator = {
  async generateProof(allocationId: string): Promise<TenantProofData | null> {
    const { data: allocation } = await supabase
      .from('rates_recovery_allocations')
      .select('*, tenants!inner(tenant_name)')
      .eq('id', allocationId)
      .single();

    if (!allocation) return null;

    const { data: run } = await supabase
      .from('rates_recovery_runs')
      .select('*, properties!inner(property_name)')
      .eq('id', allocation.run_id)
      .single();

    if (!run) return null;

    const { data: allAllocations } = await supabase
      .from('rates_recovery_allocations')
      .select('gla_sqm')
      .eq('run_id', allocation.run_id);

    const totalGLA = (allAllocations || []).reduce((sum, a) => sum + (a.gla_sqm || 0), 0);

    const { data: runDocs } = await supabase
      .from('rates_recovery_documents')
      .select('*')
      .eq('run_id', allocation.run_id);

    const documents = (runDocs || []).filter(d => d.tenant_visible || d.include_in_proof).map(doc => ({
      document_type: doc.document_type,
      file_name: doc.file_name,
      file_url: doc.file_url,
      snippet_url: doc.snippet_url || undefined,
    }));

    return {
      tenant_name: (allocation as any).tenants?.tenant_name || 'Unknown',
      shop_number: allocation.shop_number || 'N/A',
      property_name: (run as any).properties?.property_name || 'Unknown',
      effective_date: run.effective_date,
      municipality_name: run.municipality_name || undefined,
      previous_monthly_rates: run.previous_monthly_rates,
      new_monthly_rates: run.new_monthly_rates,
      monthly_increase: run.monthly_increase,
      total_gla: totalGLA,
      tenant_gla: allocation.gla_sqm,
      gla_percentage: allocation.gla_percentage,
      previous_monthly_charge: allocation.previous_monthly_charge,
      new_monthly_charge: allocation.new_monthly_charge,
      back_charge_amount: allocation.back_charge_amount,
      back_charge_description: `Rates Increase Back Charge — ${new Date(run.effective_date).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      documents,
    };
  },

  async generateRunProof(runId: string): Promise<TenantProofData[]> {
    const { data: allocations } = await supabase
      .from('rates_recovery_allocations')
      .select('id')
      .eq('run_id', runId);

    if (!allocations?.length) return [];

    const proofs: TenantProofData[] = [];
    for (const alloc of allocations) {
      const proof = await this.generateProof(alloc.id);
      if (proof) proofs.push(proof);
    }

    return proofs;
  }
};
