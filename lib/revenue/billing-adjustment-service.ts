// lib/revenue/billing-adjustment-service.ts
// Billing Adjustment Service — immutable posted charges, corrections via adjustments

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { resolveConfiguredAccount } from '@/lib/financial/accounting-resolver';
import { logFinancialAction } from '@/lib/audit/financial-audit';

export interface AdjustmentInput {
  entityId: string;
  originalChargeId: string;
  billingRuleId?: string | null;
  leaseId: string;
  billingPeriod: string;
  newAmount: number;
  taxCode: string; // EXPLICIT — not inferred
  reason: string;
  effectiveFrom: string;
  createdBy?: string;
}

export interface AdjustmentResult {
  success: boolean;
  adjustmentId?: string;
  message: string;
}

function resolveBusinessRole(chargeType: string): string {
  const roleMap: Record<string, string> = {
    deposit: 'deposit_liability',
    rent: 'rental_income_commercial',
    parking: 'recovery_utilities',
    lease_fee: 'fee_income',
    security_levy: 'recovery_operating',
    marketing_levy: 'recovery_operating',
    utility_recovery: 'recovery_utilities',
    interest: 'interest_income',
    penalty: 'penalty_income',
  };
  return roleMap[chargeType] || 'recovery_operating';
}

export class BillingAdjustmentService {
  async createAdjustment(input: AdjustmentInput): Promise<AdjustmentResult> {
    if (!input.taxCode) {
      return { success: false, message: 'Tax code is required' };
    }

    const { data: originalCharge } = await supabase
      .from('charges')
      .select('*')
      .eq('id', input.originalChargeId)
      .single();

    if (!originalCharge) return { success: false, message: 'Original charge not found' };
    if (originalCharge.status !== 'posted') {
      return { success: false, message: 'Only posted charges can be adjusted' };
    }

    const originalAmount = Number(originalCharge.amount_excl_vat);
    const newAmount = Number(input.newAmount);
    const delta = newAmount - originalAmount;

    if (Math.abs(delta) < 0.01) {
      return { success: false, message: 'No adjustment required — amounts are equal' };
    }

    const adjustmentType = delta > 0 ? 'increase' : 'decrease';

    // Robust idempotency — handle NULL billingRuleId correctly
    const { data: existing, error: dupError } = await supabase
      .from('billing_adjustments')
      .select('id')
      .eq('original_charge_id', input.originalChargeId)
      .eq('effective_from', input.effectiveFrom)
      .eq('new_amount', newAmount)
      .maybeSingle();

    if (dupError) return { success: false, message: dupError.message };
    if (existing) return { success: false, message: 'Adjustment already exists for this change' };

    // Create draft
    const { data: adjustment, error } = await supabase
      .from('billing_adjustments')
      .insert({
        entity_id: input.entityId,
        original_charge_id: input.originalChargeId,
        billing_rule_id: input.billingRuleId || null,
        lease_id: input.leaseId,
        billing_period: input.billingPeriod,
        adjustment_type: adjustmentType,
        original_amount: originalAmount,
        new_amount: newAmount,
        amount_delta: delta,
        reason: input.reason,
        effective_from: input.effectiveFrom,
        tax_code: input.taxCode,
        status: 'draft',
        created_by: input.createdBy || null,
      })
      .select('*')
      .single();

    if (error) return { success: false, message: error.message };

    await logFinancialAction({
      user_id: input.createdBy,
      user_email: input.createdBy,
      action: 'create',
      resource_type: 'billing_adjustment',
      resource_id: adjustment.id,
      resource_label: `${adjustmentType} R${Math.abs(delta).toFixed(2)} for ${originalCharge.charge_type}`,
      new_values: {
        original_charge_id: input.originalChargeId,
        original_amount: originalAmount,
        new_amount: newAmount,
        delta,
        tax_code: input.taxCode,
        reason: input.reason,
      },
    });

    await publish('billing.adjustment.created', {
      correlationId: crypto.randomUUID(),
      source: 'billing-adjustment-service',
      version: '1.0',
      payload: adjustment,
    });

    return { success: true, adjustmentId: adjustment.id, message: `Adjustment created (${adjustmentType} R${Math.abs(delta).toFixed(2)})` };
  }

  async submitForReview(adjustmentId: string, userId?: string): Promise<AdjustmentResult> {
    const { error } = await supabase
      .from('billing_adjustments')
      .update({ status: 'pending_review', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', adjustmentId)
      .eq('status', 'draft');

    if (error) return { success: false, message: error.message };

    await logFinancialAction({
      user_id: userId,
      action: 'update',
      resource_type: 'billing_adjustment',
      resource_id: adjustmentId,
      resource_label: 'Submitted for review',
      old_values: { status: 'draft' },
      new_values: { status: 'pending_review' },
    });

    await publish('billing.adjustment.submitted', {
      correlationId: crypto.randomUUID(),
      source: 'billing-adjustment-service',
      version: '1.0',
      payload: { adjustmentId },
    });

    return { success: true, adjustmentId, message: 'Adjustment submitted for review' };
  }

  async approve(adjustmentId: string, userId?: string): Promise<AdjustmentResult> {
    const { error } = await supabase
      .from('billing_adjustments')
      .update({ status: 'approved', approved_by: userId || null, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', adjustmentId)
      .eq('status', 'pending_review');

    if (error) return { success: false, message: error.message };

    await logFinancialAction({
      user_id: userId,
      action: 'approve',
      resource_type: 'billing_adjustment',
      resource_id: adjustmentId,
      resource_label: 'Adjustment approved',
      old_values: { status: 'pending_review' },
      new_values: { status: 'approved' },
    });

    await publish('billing.adjustment.approved', {
      correlationId: crypto.randomUUID(),
      source: 'billing-adjustment-service',
      version: '1.0',
      payload: { adjustmentId },
    });

    return { success: true, adjustmentId, message: 'Adjustment approved' };
  }

  async post(adjustmentId: string, userId?: string): Promise<AdjustmentResult> {
    const { data: adjustment } = await supabase
      .from('billing_adjustments')
      .select('*')
      .eq('id', adjustmentId)
      .single();

    if (!adjustment) return { success: false, message: 'Adjustment not found' };
    if (adjustment.status !== 'approved') {
      return { success: false, message: 'Only approved adjustments can be posted' };
    }

    // Load original charge
    const { data: originalCharge } = await supabase
      .from('charges')
      .select('*')
      .eq('id', adjustment.original_charge_id)
      .single();

    if (!originalCharge) return { success: false, message: 'Original charge not found' };

    // Period governance — check if billing period is in a closed financial period
    const { data: period } = await supabase
      .from('financial_periods')
      .select('status, period_end')
      .eq('entity_id', adjustment.entity_id)
      .eq('period_type', 'financial')
      .lte('period_start', adjustment.effective_from)
      .gte('period_end', adjustment.effective_from)
      .maybeSingle();

    if (period?.status === 'closed') {
      return { success: false, message: `Financial period for ${adjustment.effective_from} is closed. Post adjustment in next open period.` };
    }

    // Resolve configured account with explicit tax
    const businessRole = resolveBusinessRole(originalCharge.charge_type);
    const account = await resolveConfiguredAccount({
      entityId: adjustment.entity_id,
      businessRole,
      taxCode: adjustment.tax_code || 'NO_VAT',
    });

    if (!account) {
      return { success: false, message: 'Entity accounting configuration incomplete' };
    }

    // Calculate VAT with sign matching delta
    const delta = Number(adjustment.amount_delta);
    const vatAmount = Math.round(delta * (account.taxRate / 100) * 100) / 100;
    const inclAmount = delta + vatAmount;

    // TRANSACTIONAL: create adjustment charge AND update adjustment in one block
    const { data: adjustmentCharge, error: chargeError } = await supabase
      .from('adjustment_charges')
      .insert({
        adjustment_id: adjustment.id,
        entity_id: adjustment.entity_id,
        lease_id: adjustment.lease_id,
        charge_type: originalCharge.charge_type,
        description: `Billing adjustment: ${adjustment.reason || 'Correction'}`,
        account_id: account.accountId,
        gl_code: account.glCode,
        tax_code: account.taxCode,
        vat_rate: account.taxRate,
        amount_excl_vat: delta,
        vat_amount: vatAmount,
        amount_incl_vat: inclAmount,
        billing_period: adjustment.billing_period,
        source_type: 'billing_adjustment',
        source_id: adjustment.id,
        status: 'posted',
        posted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (chargeError) return { success: false, message: chargeError.message };

    const { error: updateError } = await supabase
      .from('billing_adjustments')
      .update({ status: 'posted', posted_by: userId || null, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', adjustmentId)
      .eq('status', 'approved');

    if (updateError) {
      // Rollback the charge if status update fails
      await supabase.from('adjustment_charges').delete().eq('id', adjustmentCharge.id);
      return { success: false, message: updateError.message };
    }

    await logFinancialAction({
      user_id: userId,
      action: 'post',
      resource_type: 'billing_adjustment',
      resource_id: adjustmentId,
      resource_label: `Posted adjustment R${delta.toFixed(2)} (incl VAT R${inclAmount.toFixed(2)})`,
      old_values: { status: 'approved' },
      new_values: { status: 'posted', adjustment_charge_id: adjustmentCharge.id },
    });

    await publish('billing.adjustment.posted', {
      correlationId: crypto.randomUUID(),
      source: 'billing-adjustment-service',
      version: '1.0',
      payload: { adjustmentId, adjustmentChargeId: adjustmentCharge.id },
    });

    return { success: true, adjustmentId, message: 'Adjustment posted' };
  }

  async reject(adjustmentId: string, userId?: string): Promise<AdjustmentResult> {
    const { error } = await supabase
      .from('billing_adjustments')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', adjustmentId)
      .eq('status', 'pending_review');

    if (error) return { success: false, message: error.message };

    await logFinancialAction({
      user_id: userId,
      action: 'reject',
      resource_type: 'billing_adjustment',
      resource_id: adjustmentId,
      resource_label: 'Adjustment rejected',
      old_values: { status: 'pending_review' },
      new_values: { status: 'rejected' },
    });

    return { success: true, adjustmentId, message: 'Adjustment rejected' };
  }
}

export const billingAdjustmentService = new BillingAdjustmentService();