// lib/revenue/payment-terms.ts
// Payment Terms — Governed due date calculation
// NO hardcoded defaults. Missing configuration = explicit error.

import { supabase } from '@/lib/supabase';

export interface PaymentTerms {
  due_days: number;
  grace_days: number;
  source: 'lease' | 'property' | 'entity' | 'platform';
}

export class PaymentTermsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentTermsError';
  }
}

export async function resolvePaymentTerms(leaseId: string): Promise<PaymentTerms> {
  // Lease → Property → Entity → Platform (explicitly configured only)
  const { data: lease } = await supabase
    .from('leases')
    .select('property_id, lease_payment_terms')
    .eq('id', leaseId)
    .single();

  if (!lease) throw new PaymentTermsError('Lease not found');

  // 1. Lease override
  if (lease.lease_payment_terms?.due_days) {
    return { ...lease.lease_payment_terms, source: 'lease' };
  }

  // 2. Property level
  const { data: property } = await supabase
    .from('properties')
    .select('payment_terms, entity_id')
    .eq('id', lease.property_id)
    .single();

  if (property?.payment_terms?.due_days) {
    return { ...property.payment_terms, source: 'property' };
  }

  // 3. Entity level
  if (property?.entity_id) {
    const { data: entity } = await supabase
      .from('entities')
      .select('payment_terms')
      .eq('id', property.entity_id)
      .single();

    if (entity?.payment_terms?.due_days) {
      return { ...entity.payment_terms, source: 'entity' };
    }
  }

      const { data: platform } = await supabase
    .from('platform_settings')
    .select('settings')
    .eq('entity_id', '00000000-0000-0000-0000-000000000000')
    .single();

  if (platform?.settings?.payment_terms?.due_days != null) {
    return { ...platform.settings.payment_terms, source: 'platform' };
  }

  throw new PaymentTermsError('No payment terms configured for this lease');
}

export function calculateDueDate(billingDate: string, terms: PaymentTerms): string {
  const billing = new Date(billingDate);
  const due = new Date(billing.getTime() + terms.due_days * 86400000);
  return due.toISOString().split('T')[0];
}
