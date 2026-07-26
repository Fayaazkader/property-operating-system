// lib/revenue/services/rates-recovery-engine.ts
// Rates & Taxes Recovery Engine — Monthly increase allocation by GLA

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export const ratesRecoveryEngine = {
  async createRun(params: {
    entityId: string;
    propertyId: string;
    effectiveDate: string;
    previousMonthlyRates: number;
    newMonthlyRates: number;
    generatedBy?: string;
  }) {
    const monthlyIncrease = params.newMonthlyRates - params.previousMonthlyRates;

    const { data: run, error } = await supabase
      .from('rates_recovery_runs')
      .insert({
        entity_id: params.entityId,
        property_id: params.propertyId,
        effective_date: params.effectiveDate,
        previous_monthly_rates: params.previousMonthlyRates,
        new_monthly_rates: params.newMonthlyRates,
        monthly_increase: monthlyIncrease,
        recovery_basis: 'gla',
        reason: params.reason || null,
        status: 'draft',
        generated_by: params.generatedBy,
      })
      .select('*')
      .single();

    if (error) throw error;

    await publish('rates.run.created', {
      correlationId: crypto.randomUUID(),
      source: 'rates-recovery-engine',
      version: '1.0',
      payload: { runId: run.id, propertyId: params.propertyId },
    });

    return run;
  },

  async previewAllocations(runId: string) {
    const { data: run } = await supabase
      .from('rates_recovery_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (!run) throw new Error('Run not found');

    const { data: leases } = await supabase
      .from('leases')
      .select('id, tenant_id, tenant_name, unit_number, gla_sqm')
      .eq('property_id', run.property_id)
      .eq('lease_status', 'Active');

    if (!leases?.length) throw new Error('No active leases found');

    const totalGLA = leases.reduce((sum, l) => sum + (l.gla_sqm || 0), 0);

    const { data: property } = await supabase
      .from('properties')
      .select('property_name')
      .eq('id', run.property_id)
      .single();

    const { data: existingRules } = await supabase
      .from('billing_rules')
      .select('lease_id, base_amount')
      .eq('charge_code', 'RATES_RECOVERY')
      .eq('status', 'active');

    const existingMap = new Map<string, number>();
    for (const r of (existingRules || [])) {
      existingMap.set(r.lease_id, r.base_amount || 0);
    }

    const allocations = leases.map(lease => {
      const glaPct = totalGLA > 0 ? (lease.gla_sqm || 0) / totalGLA : 0;
      const previousCharge = existingMap.get(lease.id) || 0;
      const increase = Math.round(run.monthly_increase * glaPct * 100) / 100;
      const newCharge = Math.round((previousCharge + increase) * 100) / 100;
      const effectiveMonth = new Date(run.effective_date).toLocaleString('default', { month: 'long', year: 'numeric' });

      return {
        run_id: runId,
        tenant_id: lease.tenant_id,
        lease_id: lease.id,
        shop_number: lease.unit_number || undefined,
        gla_sqm: lease.gla_sqm || 0,
        gla_percentage: Math.round(glaPct * 10000) / 10000,
        previous_monthly_charge: previousCharge,
        monthly_increase: increase,
        new_monthly_charge: newCharge,
        back_charge_amount: increase,
        back_charge_description: `Rates Increase Back Charge — ${effectiveMonth}`,
        tenant_name: lease.tenant_name,
      };
    });

    return {
      run,
      property_name: property?.property_name || 'Unknown',
      total_gla: totalGLA,
      allocations,
    };
  },

  async saveAllocations(runId: string, allocations: any[]) {
    await supabase.from('rates_recovery_allocations').delete().eq('run_id', runId);

    const rows = allocations.map(a => ({
      id: crypto.randomUUID(),
      run_id: runId,
      tenant_id: a.tenant_id,
      lease_id: a.lease_id,
      shop_number: a.shop_number,
      gla_sqm: a.gla_sqm,
      gla_percentage: a.gla_percentage,
      previous_monthly_charge: a.previous_monthly_charge,
      monthly_increase: a.monthly_increase,
      new_monthly_charge: a.new_monthly_charge,
      back_charge_amount: a.back_charge_amount,
    }));

    if (rows.length > 0) {
      await supabase.from('rates_recovery_allocations').insert(rows);
    }

    await supabase.from('rates_recovery_runs').update({ status: 'preview' }).eq('id', runId);
  },

  async approve(runId: string, approvedBy: string) {
    await supabase.from('rates_recovery_runs').update({ status: 'processing' }).eq('id', runId);

    const { data: run } = await supabase
      .from('rates_recovery_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (!run) throw new Error('Run not found');

    const { data: allocations } = await supabase
      .from('rates_recovery_allocations')
      .select('*')
      .eq('run_id', runId);

    if (!allocations?.length) throw new Error('No allocations to approve');

    const entityId = run.entity_id;
    const effectiveDate = run.effective_date;
    const billingRuleUpserts: any[] = [];
    const manualCharges: any[] = [];
    const allocationUpdates: string[] = [];

    for (const alloc of allocations) {
      billingRuleUpserts.push({
        lease_id: alloc.lease_id,
        rule_type: 'rates',
        charge_code: 'RATES_RECOVERY',
        description: 'Rates & Taxes Recovery',
        base_amount: alloc.new_monthly_charge,
        vat_rate: 0,
        gl_code: '4200',
        is_recoverable: true,
        frequency: 'monthly',
        status: 'active',
        effective_from: effectiveDate,
      });

      if (alloc.back_charge_amount > 0) {
        manualCharges.push({
          id: crypto.randomUUID(),
          entity_id: entityId,
          tenant_id: alloc.tenant_id,
          description: `Rates Increase Back Charge — ${new Date(effectiveDate).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          amount_excl: alloc.back_charge_amount,
          vat_rate: 0,
          vat_amount: 0,
          amount_incl: alloc.back_charge_amount,
          gl_code: '4200',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      allocationUpdates.push(alloc.id);
    }

    try {
      for (const rule of billingRuleUpserts) {
        await supabase.from('billing_rules').upsert(rule, { onConflict: 'lease_id,charge_code' });
      }

      if (manualCharges.length > 0) {
        await supabase.from('manual_charges').insert(manualCharges);
      }

      await supabase.from('rates_recovery_allocations')
        .update({ billing_rule_updated: true, invoice_generated: true })
        .in('id', allocationUpdates);
    } catch (error) {
      await supabase.from('rates_recovery_runs').update({ status: 'preview' }).eq('id', runId);
      throw new Error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    await supabase.from('rates_recovery_runs').update({
      status: 'applied',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    }).eq('id', runId);

    await publish('rates.run.approved', {
      correlationId: crypto.randomUUID(),
      source: 'rates-recovery-engine',
      version: '1.0',
      payload: { runId, tenantCount: allocationUpdates.length },
    });
  },

  async getRunHistory(entityId: string) {
    const { data } = await supabase
      .from('rates_recovery_runs')
      .select('*, properties!inner(property_name)')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    return data || [];
  },

  async getRunDetail(runId: string) {
    const { data: run } = await supabase
      .from('rates_recovery_runs')
      .select('*, properties!inner(property_name)')
      .eq('id', runId)
      .single();

    const { data: allocations } = await supabase
      .from('rates_recovery_allocations')
      .select('*, tenants!inner(tenant_name)')
      .eq('run_id', runId);

    return { run, allocations: allocations || [] };
  }
};

// Document evidence methods
export const ratesRecoveryDocuments = {
  async uploadEvidence(params: {
    runId: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    fileSizeBytes?: number;
    uploadedBy?: string;
    tenantVisible?: boolean;
  }) {
    const { data, error } = await supabase
      .from('rates_recovery_documents')
      .insert({
        run_id: params.runId,
        document_type: params.documentType,
        file_name: params.fileName,
        file_url: params.fileUrl,
        file_size_bytes: params.fileSizeBytes,
        uploaded_by: params.uploadedBy,
        tenant_visible: params.tenantVisible || false,
        include_in_proof: params.tenantVisible || false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async saveSnippet(documentId: string, snippetUrl: string, bounds: any) {
    await supabase
      .from('rates_recovery_documents')
      .update({ snippet_url: snippetUrl, snippet_bounds: bounds })
      .eq('id', documentId);
  },

  async getDocuments(runId: string) {
    const { data } = await supabase
      .from('rates_recovery_documents')
      .select('*')
      .eq('run_id', runId)
      .order('uploaded_at', { ascending: false });

    return data || [];
  },

  async deleteDocument(documentId: string) {
    await supabase.from('rates_recovery_documents').delete().eq('id', documentId);
  },

  async linkDocument(allocationId: string, documentId: string) {
    await supabase
      .from('rates_recovery_document_links')
      .upsert({ allocation_id: allocationId, document_id: documentId }, { onConflict: 'allocation_id,document_id' });
  }
};
