'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {workOrderService,type MaintenanceAction,type MaintenanceCommand} from '@/lib/property-operations/services/work-order.service';

/** One web interface to the canonical command. Authorization is enforced by SQL. */
export function WorkOrderLifecycle({order,onChanged}:{order:any;onChanged:()=>void}){
 const [suppliers,setSuppliers]=useState<any[]>([]),[documents,setDocuments]=useState<any[]>([]),[quotes,setQuotes]=useState<any[]>([]),[taxes,setTaxes]=useState<any[]>([]),[events,setEvents]=useState<any[]>([]);
 const [action,setAction]=useState<MaintenanceAction>('quote'),[note,setNote]=useState(''),[supplier,setSupplier]=useState(''),[document,setDocument]=useState(''),[quote,setQuote]=useState(''),[amount,setAmount]=useState(''),[tax,setTax]=useState(''),[appointment,setAppointment]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
 const pending=useRef<MaintenanceCommand|null>(null);
 const actions:MaintenanceAction[]=({reported:['quote','cancel'],triaged:['quote','cancel'],quoted:['quote','approve','reject_quote','cancel'],approved:['authorize','cancel'],assigned:['accept','cancel'],accepted:['schedule','cancel'],scheduled:['schedule','start','cancel'],in_progress:['progress','complete'],completed:['certify','reject_completion']} as Record<string,MaintenanceAction[]>)[order.status]??[];
 useEffect(()=>{setAction(actions[0]??'quote');},[order.status]);
 useEffect(()=>{let current=true;setLoadError('');void Promise.all([
  supabase.from('suppliers').select('id,supplier_name').eq('entity_id',order.entity_id).eq('is_active',true).eq('blacklisted',false).eq('status','active'),
  supabase.from('documents').select('id,file_name').eq('entity_id',order.entity_id).eq('requires_review',false),
  supabase.from('maintenance_quotes').select('*').eq('work_order_id',order.id).eq('entity_id',order.entity_id).order('created_at'),
  supabase.from('tax_config').select('tax_code,tax_name,tax_rate').eq('entity_id',order.entity_id).eq('is_active',true),
  supabase.from('work_order_events').select('id,event_type,note,created_at,changed_by').eq('work_order_id',order.id).order('created_at')
 ]).then(results=>{if(!current)return;if(results.some(r=>r.error)){setLoadError('Could not load the complete work order review. Reload before acting.');return;}setSuppliers(results[0].data??[]);setDocuments(results[1].data??[]);setQuotes(results[2].data??[]);setTaxes(results[3].data??[]);setEvents(results[4].data??[]);}).catch(()=>{if(current)setLoadError('Could not load the work order review.');});return()=>{current=false;};},[order.id,order.entity_id,order.lifecycle_version,revision]);
 async function submit(){if(busy||loadError)return;setBusy(true);setError('');try{
  if(!pending.current){const payload:Record<string,unknown>={note};if(['quote','accept','progress','complete','certify'].includes(action))payload.document_id=document;
   if(action==='quote')Object.assign(payload,{supplier_id:supplier,amount_excl_vat:amount,tax_code:tax});if(['approve','reject_quote'].includes(action))payload.quote_id=quote;
   if(action==='complete')payload.actual_cost=amount;
   if(action==='schedule'){const date=new Date(appointment);if(!appointment||!Number.isFinite(date.getTime()))throw new Error('Select a valid appointment in your local time.');payload.scheduled_at=date.toISOString();}
   pending.current={entityId:order.entity_id,workOrderId:order.id,requestId:crypto.randomUUID(),expectedVersion:order.lifecycle_version,action,payload};}
  await workOrderService.commandLifecycle(pending.current);pending.current=null;setNote('');onChanged();
 }catch(e){setError(e instanceof Error?e.message:'Command unavailable. Retry the same request to recover.');}finally{setBusy(false);}}
 return <section className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5" aria-label="Work order lifecycle">
  <div><h2 className="text-lg font-medium">{order.title}</h2><p className="text-sm text-[var(--text-secondary)]">{order.status.replaceAll('_',' ')} · revision {order.lifecycle_version}</p></div>
  {loadError&&<div role="alert">{loadError}<button className="af-control ml-2" onClick={()=>setRevision(n=>n+1)}>Reload review</button></div>}
  {quotes.length>0&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="text-left py-2">Quotation comparison — amounts include configured VAT</caption><thead><tr><th>Contractor</th><th>Net</th><th>VAT</th><th>Total</th><th>Status</th></tr></thead><tbody>{quotes.map(q=><tr key={q.id}><td className="py-2">{suppliers.find(s=>s.id===q.supplier_id)?.supplier_name??'Contractor unavailable'}</td><td>{Number(q.amount).toFixed(2)}</td><td>{Number(q.vat_amount).toFixed(2)}</td><td>{Number(q.total_amount).toFixed(2)}</td><td>{q.status}</td></tr>)}</tbody></table></div>}
  {actions.length>0&&<form className="grid gap-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void submit();}}>
   <fieldset disabled={busy||!!pending.current||!!loadError} className="contents">
    <label className="text-sm">Next action<select className="af-control block w-full" value={action} onChange={e=>setAction(e.target.value as MaintenanceAction)}>{actions.map(a=><option key={a} value={a}>{a.replaceAll('_',' ')}</option>)}</select></label>
    {action==='quote'&&<><label className="text-sm">Contractor<select required className="af-control block w-full" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Select contractor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.supplier_name}</option>)}</select></label><label className="text-sm">Tax classification<select required className="af-control block w-full" value={tax} onChange={e=>setTax(e.target.value)}><option value="">Select classification</option>{taxes.map((t,i)=><option key={i} value={t.tax_code}>{t.tax_name} ({t.tax_rate}%)</option>)}</select></label></>}
    {['quote','complete'].includes(action)&&<label className="text-sm">{action==='quote'?'Quoted amount excluding VAT':'Actual cost including VAT'}<input required type="number" step="0.01" min="0" className="af-control block w-full" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    {['approve','reject_quote'].includes(action)&&<label className="text-sm">Received quotation<select required className="af-control block w-full" value={quote} onChange={e=>setQuote(e.target.value)}><option value="">Select quotation</option>{quotes.filter(q=>q.status==='received').map(q=><option key={q.id} value={q.id}>{suppliers.find(s=>s.id===q.supplier_id)?.supplier_name??q.supplier_id} — R{Number(q.total_amount).toFixed(2)}</option>)}</select></label>}
    {['quote','accept','progress','complete','certify'].includes(action)&&<label className="text-sm">Reviewed supporting document<select required className="af-control block w-full" value={document} onChange={e=>setDocument(e.target.value)}><option value="">Select evidence</option>{documents.map(d=><option key={d.id} value={d.id}>{d.file_name}</option>)}</select></label>}
    {action==='schedule'&&<label className="text-sm">Appointment (your local time)<input required type="datetime-local" className="af-control block w-full" value={appointment} onChange={e=>setAppointment(e.target.value)}/></label>}
    <label className="text-sm sm:col-span-2">Operational note<textarea required className="af-control block w-full" value={note} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
   <button className="af-control bg-[var(--text-primary)] text-[var(--bg-primary)]" disabled={busy||!!loadError} aria-busy={busy}>{busy?'Saving…':pending.current?'Retry same command':'Record action'}</button>
   {error&&<><p role="alert" className="text-sm sm:col-span-2">{error}</p><button type="button" className="af-control" disabled={busy} onClick={()=>{pending.current=null;setError('');onChanged();}}>Reload before a revised action</button></>}
  </form>}
  {order.status==='verified'&&<p role="status" className="text-sm text-[var(--text-secondary)]">Completion certified. The expected supplier invoice is recorded. Financial reconciliation is required before closure.</p>}
  <ol className="space-y-2 border-t border-[var(--border-default)] pt-4" aria-label="Work order audit history">{events.map(e=><li key={e.id} className="text-sm"><span className="font-medium">{e.event_type.replaceAll('_',' ')}</span> · {new Date(e.created_at).toLocaleString('en-ZA')}<p className="text-[var(--text-secondary)]">{e.note}</p></li>)}</ol>
 </section>;
}
