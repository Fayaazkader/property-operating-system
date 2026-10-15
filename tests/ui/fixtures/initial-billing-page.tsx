'use client';
import { PrepareWorkOrderAction } from '@/components/maintenance/PrepareWorkOrderAction';
import type { WorkOrder } from '@/lib/maintenance/types';
import { useState } from 'react';
import { InitialBillingModal } from '@/app/(protected)/tenants/components/InitialBillingModal';
import type { InitialBillingResult } from '@/lib/revenue/initial-billing-service';
let attempts=0;let workAttempts=0;
const maintenanceService={async createWorkOrder(){if(++workAttempts===1)throw new Error('SLA configuration unavailable; retry after recovery.');return {id:'order',entity_id:'entity',property_id:'property',title:'Burst pipe',priority:'emergency',status:'reported',timeline:[],source:'tenant',sla_breached:true,created_at:'2026-10-15',updated_at:'2026-10-15',tenant_chargeable:false} as WorkOrder;}};
const charge=(type:string,amount:number,vat:number)=>({id:type,charge_type:type,description:type==='rent'?'First Month Rental':'Tenant Deposit',source:'Lease Agreement',source_detail:'Contract',account_id:'account',gl_code:type==='rent'?'RENT':'DEPOSIT',tax_code:vat?'VAT_STANDARD':'NO_VAT',vat_rate:vat?15:0,vat_treatment:vat?'standard':'no_vat',amount_excl_vat:amount,vat_amount:vat,amount_incl_vat:amount+vat,selected:true});
const billing:InitialBillingResult={planSha256:'a'.repeat(64),leaseId:'lease',entityId:'entity',tenantName:'Canonical Tenant',leaseRef:'AF-001',propertyName:'Johannesburg Property',
 charges:[charge('rent',10000,1500),charge('deposit',20000,0)],total_excl_vat:30000,total_incl_vat:31500,status:'calculated',
 policy:{lease_fee_amount:0,lease_fee_description:'',late_payment_fee_pct:0,late_payment_fee_description:'',deposit_months:2,billing_day:1,auto_approve_below:0,source:'Approved commercial agreement'}};
const service={async getInvoiceTerms(){return {selectedId:'term',options:[{id:'term',name:'Due on commencement',days:0}]};},async issueInvoice(){return {invoiceId:'invoice',statementId:'statement'};},async calculate(){return structuredClone(billing);},async approve(value:InitialBillingResult){return value;},async postCharges(){attempts++;if(attempts===1)throw new Error('Review changed. Reload before approval.');return 2;}};
export default function LocalReview(){const [open,setOpen]=useState(false);const [done,setDone]=useState(false);const [prepared,setPrepared]=useState(false);
 return <main className="p-6 text-[var(--text-primary)]"><h1>AssetFlow workflow component test</h1><button type="button" className="af-control mt-4" onClick={()=>setOpen(true)}>Open initial charges</button>
 <section className="mt-8" aria-label="Maintenance preparation"><PrepareWorkOrderAction issueId="issue" entityId="entity" propertyId="property" exists={prepared} onPrepared={()=>setPrepared(true)} service={maintenanceService}/></section>{done&&<p role="status">Charges approved</p>}{open&&<InitialBillingModal leaseId="lease" entityId="entity" service={service} onClose={()=>setOpen(false)} onSkip={()=>setOpen(false)} onApprove={()=>{setOpen(false);setDone(true);}}/>}</main>;
}
