// lib/revenue/initial-billing-service.ts
// Canonical review, approval and issuance adapter. PostgreSQL owns financial writes.
// Resolves accounts via entity accounting config — no hardcoded GL/VAT

import { supabase } from '@/lib/supabase';
import { type BillingPolicy } from './billing-policy-engine';

export interface InitialCharge {
  id: string;
  charge_type: string;
  description: string;
  source: string;
  source_detail: string;
  account_id: string;
  gl_code: string;
  tax_code: string;
  vat_rate: number;
  vat_treatment: string;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  selected: boolean;
}

export interface InitialBillingResult {
  planSha256: string;
  leaseId: string;
  entityId: string;
  tenantName: string;
  leaseRef: string;
  propertyName: string;
  charges: InitialCharge[];
  total_excl_vat: number;
  total_incl_vat: number;
  policy: BillingPolicy;
  status: 'calculated' | 'approved' | 'posted';
}

export interface CommencementInvoiceTerms {selectedId:string|null;options:Array<{id:string;name:string;days:number}>}
export class InitialBillingService {
  async getInvoiceTerms(leaseId:string,entityId:string):Promise<CommencementInvoiceTerms> {
    const {data,error}=await supabase.rpc('get_lease_commencement_invoice_terms',{p_entity_id:entityId,p_lease_id:leaseId});
    if(error)throw new Error(error.message);if(!data||!Array.isArray(data.options))throw new Error('Payment terms review unavailable');return data;
  }
  async issueInvoice(leaseId:string,authority:{entityId:string;planSha256:string;paymentTermId:string}):Promise<{invoiceId:string;statementId:string}> {
    const {data,error}=await supabase.rpc('issue_lease_commencement_invoice',{p_entity_id:authority.entityId,p_lease_id:leaseId,p_plan_sha256:authority.planSha256,p_payment_term_id:authority.paymentTermId});
    if(error)throw new Error(error.message);if(!data?.invoiceId||!data?.statementId)throw new Error('Invoice issuance requires reconciliation');return data;
  }

  async calculate(leaseId: string, entityId: string): Promise<InitialBillingResult> {
    const {data,error}=await supabase.rpc('prepare_lease_commencement_billing',{p_entity_id:entityId,p_lease_id:leaseId});
    if(error)throw new Error(error.message);
    if(!data||data.leaseId!==leaseId||data.entityId!==entityId||!Array.isArray(data.charges)||!/^[a-f0-9]{64}$/.test(data.planSha256))throw new Error('Initial billing review requires reconciliation');
    return data as InitialBillingResult;
  }

  // Select the review model only. Authority, recalculation, audit and posting
  // happen atomically in postCharges; publishing approval must not post twice.
  async approve(billing: InitialBillingResult, _actorId?: string): Promise<InitialBillingResult> {
    const charges=billing.charges.filter(c=>c.selected);
    if(!charges.length)throw new Error('Select at least one commencement charge');
    return {...billing,charges,status:'approved',
      total_excl_vat:charges.reduce((s,c)=>s+Number(c.amount_excl_vat),0),
      total_incl_vat:charges.reduce((s,c)=>s+Number(c.amount_incl_vat),0)};
  }

  async postCharges(leaseId: string, charges: InitialCharge[], authority: {entityId:string;planSha256:string}): Promise<number> {
    const {data,error}=await supabase.rpc('post_lease_commencement_billing',{
      p_entity_id:authority.entityId,p_lease_id:leaseId,p_plan_sha256:authority.planSha256,
      p_selected_types:charges.filter(c=>c.selected).map(c=>c.charge_type),
    });
    if(error)throw new Error(error.message);
    if(!Number.isInteger(data)||data<0)throw new Error('Initial billing result requires reconciliation');
    return data;
  }
}
export const initialBillingService = new InitialBillingService();
