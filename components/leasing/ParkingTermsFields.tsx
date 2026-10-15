'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export function ParkingTermsFields({entityId,rate,vatTreatment,taxCode,disabled=false,onRate,onVatTreatment,onTaxCode}:{entityId:string;rate:string;vatTreatment:string;taxCode:string;disabled?:boolean;onRate:(value:string)=>void;onVatTreatment:(value:string)=>void;onTaxCode:(value:string)=>void}) {
 const [taxes,setTaxes]=useState<Array<{tax_code:string;tax_name:string;tax_rate:number}>>([]);const [error,setError]=useState('');
 useEffect(()=>{let active=true;setTaxes([]);setError('');if(entityId)void supabase.from('tax_config').select('tax_code,tax_name,tax_rate').eq('entity_id',entityId).eq('is_active',true).order('tax_code').then(({data,error})=>{if(active){if(error)setError('Tax classifications could not be loaded for this entity.');else setTaxes(data??[]);}});return()=>{active=false;};},[entityId]);
 return <fieldset className="space-y-3 rounded-xl border border-[var(--border-default)] p-4" disabled={disabled}>
  <legend className="px-2 text-sm font-medium">Agreed parking terms</legend>
  <p className="text-xs text-[var(--text-secondary)]">For allocated bays, record the agreed price and tax treatment before submitting commercial terms. These values form part of the approved lease.</p>
  <div className="grid gap-3 sm:grid-cols-3">
   <label className="text-sm">Price per bay (R)<input className="af-control mt-1 block w-full bg-[var(--bg-secondary)]" type="number" min="0" step="0.01" value={rate} onChange={e=>onRate(e.target.value)}/></label>
   <label className="text-sm">Parking VAT treatment<select className="af-control mt-1 block w-full bg-[var(--bg-secondary)]" value={vatTreatment} onChange={e=>onVatTreatment(e.target.value)}><option value="">Select treatment</option><option value="exclusive">Excludes VAT</option><option value="inclusive">Includes VAT</option><option value="not_applicable">Not applicable</option></select></label>
   <label className="text-sm">Tax classification<select className="af-control mt-1 block w-full bg-[var(--bg-secondary)]" value={taxCode} onChange={e=>onTaxCode(e.target.value)}><option value="">Select classification</option>{taxes.map((tax,index)=><option key={tax.tax_code+index} value={tax.tax_code}>{tax.tax_name} ({tax.tax_rate}%)</option>)}</select></label>
  </div>{error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
 </fieldset>;
}
