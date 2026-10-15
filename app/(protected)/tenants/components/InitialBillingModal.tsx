'use client';

import { useEffect, useState } from 'react';
import WorkflowDialog from '@/app/components/ui/WorkflowDialog';
import { initialBillingService, type InitialCharge, type InitialBillingResult, type InitialBillingService } from '@/lib/revenue/initial-billing-service';

interface Props {
 leaseId:string;entityId:string;onApprove:(result:InitialBillingResult)=>void;onSkip:()=>void;onClose:()=>void;
 service?:Pick<InitialBillingService,'calculate'|'approve'|'postCharges'|'getInvoiceTerms'|'issueInvoice'>;
}
const money=(amount:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',minimumFractionDigits:2}).format(amount);
export function InitialBillingModal({leaseId,entityId,onApprove,onSkip,onClose,service=initialBillingService}:Props) {
 const [phase,setPhase]=useState<'loading'|'review'|'approving'>('loading');
 const [billing,setBilling]=useState<InitialBillingResult|null>(null);const [charges,setCharges]=useState<InitialCharge[]>([]);
 const [terms,setTerms]=useState<Array<{id:string;name:string;days:number}>>([]);const [paymentTermId,setPaymentTermId]=useState('');
 const [error,setError]=useState('');const [generation,setGeneration]=useState(0);
 useEffect(()=>{let active=true;setPhase('loading');setError('');
  void Promise.all([service.calculate(leaseId,entityId),service.getInvoiceTerms(leaseId,entityId)]).then(([result,invoiceTerms])=>{if(active){setTerms(invoiceTerms.options);setPaymentTermId(invoiceTerms.selectedId??'');setBilling(result);setCharges(result.charges);setPhase('review');}})
   .catch(caught=>{if(active){setError(caught instanceof Error?caught.message:'Unable to prepare initial charges.');setPhase('review');}});
  return()=>{active=false;};
 },[leaseId,entityId,service,generation]);
 const selected=charges.filter(c=>c.selected);const total=selected.reduce((sum,c)=>sum+Number(c.amount_incl_vat),0);
 async function approve(){
  if(!billing||!selected.length||!paymentTermId||phase==='approving')return;setPhase('approving');setError('');
  try{
   const review=await service.approve({...billing,charges});
   await service.postCharges(leaseId,review.charges,{entityId,planSha256:billing.planSha256});
   await service.issueInvoice(leaseId,{entityId,planSha256:billing.planSha256,paymentTermId});
   onApprove({...review,status:'posted'});
  }catch(caught){setError(caught instanceof Error?caught.message:'Approval requires recovery. Reload to check the current charges.');setPhase('review');}
 }
 return <WorkflowDialog title="Review initial charges" busy={phase==='approving'} onClose={onClose}>
  <div className="space-y-5">
   {error&&<div role="alert" className="rounded-lg border border-[var(--danger)] p-3 text-sm"><p>{error}</p><button type="button" className="af-control mt-2" onClick={()=>setGeneration(n=>n+1)}>Reload review</button></div>}
   {phase==='loading'&&<p role="status" className="py-8 text-center">Preparing contractual charges…</p>}
   {billing&&phase!=='loading'&&<>
    <div><p className="font-medium">{billing.tenantName}</p><p className="text-sm text-[var(--text-secondary)]">{billing.propertyName} · {billing.leaseRef}</p></div>
    <p className="rounded-lg bg-[var(--bg-elevated)] p-3 text-sm">Review the first rental, deposit and any configured fees before posting. A deposit charge records an amount due; it does not confirm funds received.</p>
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]" tabIndex={0} role="region" aria-label="Initial charges table">
     <table className="w-full text-sm"><caption className="sr-only">Initial charges for {billing.tenantName}</caption>
      <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]"><tr>
       <th scope="col" className="px-3 py-3 text-left">Include</th><th scope="col" className="px-3 py-3 text-left">Charge</th>
       <th scope="col" className="px-3 py-3 text-right">Excl. VAT</th><th scope="col" className="px-3 py-3 text-right">VAT</th><th scope="col" className="px-3 py-3 text-right">Total</th>
      </tr></thead><tbody>{charges.map(charge=><tr key={charge.id} className="border-t border-[var(--border-default)]">
       <td className="px-3 py-3"><input type="checkbox" className="h-5 w-5" disabled={phase==='approving'||billing.status==='posted'} aria-label={`Include ${charge.description}`} checked={charge.selected}
        onChange={()=>setCharges(previous=>previous.map(c=>c.id===charge.id?{...c,selected:!c.selected}:c))}/></td>
       <th scope="row" className="px-3 py-3 text-left font-normal"><p>{charge.description}</p><p className="text-xs text-[var(--text-secondary)]">Account {charge.gl_code}</p></th>
       <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(charge.amount_excl_vat)}</td>
       <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(charge.vat_amount)}</td>
       <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(charge.amount_incl_vat)}</td>
      </tr>)}</tbody>
     </table>
    </div>
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border-default)] pt-4"><span>Selected total</span><output aria-live="polite" className="text-lg font-semibold tabular-nums">{money(total)}</output></div>
    <p className="text-xs text-[var(--text-secondary)]">{billing.policy.source}</p>
    <label className="block text-sm">Invoice payment terms<select aria-label="Invoice payment terms" className="af-control mt-2 block w-full bg-[var(--bg-secondary)]" value={paymentTermId} disabled={phase==='approving'} onChange={e=>setPaymentTermId(e.target.value)}><option value="">Select the agreed payment terms</option>{terms.map(term=><option key={term.id} value={term.id}>{term.name} · {term.days} days</option>)}</select></label>
    {terms.length===0&&<p role="alert">Configure the payment terms catalogue before issuance.</p>}
    {billing.status==='posted'&&<p role="status">These commencement charges have already been approved and posted.</p>}
    <div className="flex flex-wrap gap-3">
     <button type="button" disabled={phase==='approving'||!selected.length||!paymentTermId} onClick={()=>void approve()} className="af-control bg-[var(--text-primary)] text-[var(--bg-primary)]">{phase==='approving'?'Issuing invoice…':billing.status==='posted'?'Issue approved invoice':'Approve charges and issue invoice'}</button>
     <button type="button" disabled={phase==='approving'} onClick={onSkip} className="af-control">Review later</button>
    </div>
   </>}
  </div>
 </WorkflowDialog>;
}
