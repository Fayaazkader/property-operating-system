'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {apApi} from '@/lib/accounts-payable/api';
import {workOrderService} from '@/lib/property-operations/services/work-order.service';
export function MaintenanceInvoiceReview({order,onChanged}:{order:any;onChanged:()=>void}){
 const [invoices,setInvoices]=useState<any[]>([]),[accounts,setAccounts]=useState<any[]>([]),[taxes,setTaxes]=useState<any[]>([]),[documents,setDocuments]=useState<any[]>([]);
 const [number,setNumber]=useState(''),[date,setDate]=useState(''),[due,setDue]=useState(''),[document,setDocument]=useState('');
 const [lines,setLines]=useState([{glCode:'',description:'',amount:'',vatCode:'',costCentre:''}]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);void Promise.all([
  supabase.from('supplier_invoices_new').select('id,invoice_number,total_amount,vat_amount,lifecycle_status,maintenance_paid_amount').eq('entity_id',order.entity_id).eq('maintenance_work_order_id',order.id),
  supabase.from('chart_of_accounts').select('gl_code,account_name').eq('entity_id',order.entity_id).eq('is_active',true).in('account_type',['expense','asset']),
  supabase.from('tax_config').select('tax_code,tax_name,tax_rate').eq('entity_id',order.entity_id).eq('is_active',true),
  supabase.from('documents').select('id,file_name').eq('entity_id',order.entity_id).eq('requires_review',false)
 ]).then(results=>{if(!active)return;if(results.some(r=>r.error))throw new Error('Invoice review could not be loaded');setInvoices(results[0].data??[]);setAccounts(results[1].data??[]);setTaxes(results[2].data??[]);setDocuments(results[3].data??[]);setError('');}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[order.id,order.entity_id,revision]);
 async function act(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();setRevision(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'Invoice command failed. Retry unchanged details to recover.');}finally{setBusy(false);}}
 function field(index:number,key:string,value:string){setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));}
 return <section className="space-y-4 rounded-xl border border-[var(--border-default)] p-5" aria-label="Maintenance invoice reconciliation">
  <h2 className="text-lg font-medium">Supplier invoice reconciliation</h2><p className="text-sm text-[var(--text-secondary)]">Allocate the actual invoice to this property. Gross invoices must reconcile to the certified cost of R{Number(order.actual_cost??0).toFixed(2)}.</p>
  {error&&<p role="alert">{error} <button className="af-control" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Reload review</button></p>}
  {loading?<p role="status">Loading invoice review…</p>:<>
  <ul className="space-y-3">{invoices.map(i=><li key={i.id} className="flex flex-wrap items-center gap-3"><Link href={`/suppliers/invoices/${i.id}`} className="underline">{i.invoice_number}</Link><span>R{Number(i.total_amount).toFixed(2)} · {i.lifecycle_status}</span>{i.lifecycle_status==='finance_review'&&<button className="af-control" disabled={busy} onClick={()=>void act(()=>apApi.approveInvoice(i.id,'',order.entity_id))}>Approve invoice</button>}{i.lifecycle_status==='approved'&&<button className="af-control" disabled={busy} onClick={()=>void act(()=>apApi.postInvoice(i.id,'',order.entity_id))}>Post invoice</button>}{i.lifecycle_status==='posted'&&<PaymentAllocation invoice={i} entityId={order.entity_id} onChanged={()=>setRevision(n=>n+1)}/>}</li>)}</ul>
  {order.status==='verified'&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>apApi.captureInvoice({entityId:order.entity_id,workOrderId:order.id,supplierId:order.supplier_id,invoiceNumber:number,invoiceDate:date,dueDate:due,documentId:document,description:order.title,lines:lines.map(l=>({...l,amount:Number(l.amount),propertyId:order.property_id}))}));}}>
   <fieldset disabled={busy} className="space-y-3"><legend className="font-medium">Capture documented invoice</legend>
   <div className="grid gap-3 sm:grid-cols-3"><label>Invoice number<input required className="af-control block w-full" value={number} onChange={e=>setNumber(e.target.value)}/></label><label>Invoice date<input required type="date" className="af-control block w-full" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Due date<input required type="date" className="af-control block w-full" value={due} onChange={e=>setDue(e.target.value)}/></label></div>
   <label className="block">Reviewed invoice document<select required className="af-control block w-full" value={document} onChange={e=>setDocument(e.target.value)}><option value="">Select document</option>{documents.map(d=><option key={d.id} value={d.id}>{d.file_name}</option>)}</select></label>
   {lines.map((l,index)=><fieldset key={index} className="grid gap-3 rounded-lg border border-[var(--border-default)] p-3 sm:grid-cols-2"><legend>Cost allocation {index+1}</legend><label>Description<input required className="af-control block w-full" value={l.description} onChange={e=>field(index,'description',e.target.value)}/></label><label>Cost account<select required className="af-control block w-full" value={l.glCode} onChange={e=>field(index,'glCode',e.target.value)}><option value="">Select account</option>{accounts.map((a,i)=><option key={i} value={a.gl_code}>{a.gl_code} — {a.account_name}</option>)}</select></label><label>Amount excluding VAT<input required type="number" min="0.01" step="0.01" className="af-control block w-full" value={l.amount} onChange={e=>field(index,'amount',e.target.value)}/></label><label>Tax code<select required className="af-control block w-full" value={l.vatCode} onChange={e=>field(index,'vatCode',e.target.value)}><option value="">Select classification</option>{taxes.map((t,i)=><option key={i} value={t.tax_code}>{t.tax_name} ({t.tax_rate}%)</option>)}</select></label><label>Cost centre<input className="af-control block w-full" value={l.costCentre} onChange={e=>field(index,'costCentre',e.target.value)}/></label>{lines.length>1&&<button type="button" className="af-control" onClick={()=>setLines(rows=>rows.filter((_,i)=>i!==index))}>Remove allocation {index+1}</button>}</fieldset>)}
   <button type="button" className="af-control" onClick={()=>setLines(rows=>[...rows,{glCode:'',description:'',amount:'',vatCode:'',costCentre:''}])}>Add allocation</button><button className="af-control ml-2" type="submit">Capture invoice</button>
   </fieldset>
  </form>}
  {order.status==='verified'&&<button className="af-control" disabled={busy} onClick={()=>void act(async()=>{await workOrderService.closeAfterReconciliation(order.entity_id,order.id);onChanged();})}>Validate financial closure</button>}
  </>}
 </section>;
}

function PaymentAllocation({invoice,entityId,onChanged}:{invoice:any;entityId:string;onChanged:()=>void}){
 const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{setRows(await apApi.listMaintenancePaymentAllocations(entityId,invoice.id));}catch(e){setError(e instanceof Error?e.message:'Unable to load bank allocations');}finally{setBusy(false);}}
 async function reconcile(){setBusy(true);setError('');try{await apApi.reconcileMaintenancePayment(entityId,invoice.id,selected);onChanged();}catch(e){setError(e instanceof Error?e.message:'Reconciliation failed. Retry to recover.');}finally{setBusy(false);}}
 return <div className="w-full space-y-2"><p>Verified payments: R{Number(invoice.maintenance_paid_amount??0).toFixed(2)}</p><button type="button" className="af-control" disabled={busy} onClick={()=>void load()}>Review bank allocations</button>
 {rows.length>0&&<><label className="block">Bank payment for {invoice.invoice_number}<select className="af-control block w-full" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select recorded payment</option>{rows.map(r=><option key={r.id} value={r.id}>{r.transaction_date} · {r.transaction_reference||'Bank payment'} · R{Number(r.amount).toFixed(2)}</option>)}</select></label><button className="af-control" disabled={busy||!selected} onClick={()=>void reconcile()}>Validate and reconcile payment</button></>}
 {error&&<p role="alert">{error}</p>}<p className="text-sm text-[var(--text-secondary)]">Only existing supplier bank allocations are eligible. Statement verification and posted ledger evidence are checked before closure.</p></div>;
}
