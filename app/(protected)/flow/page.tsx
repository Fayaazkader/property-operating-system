'use client';
import {useState} from 'react';
import Link from 'next/link';
export default function FlowPage(){
 const [instruction,setInstruction]=useState(''),[reference,setReference]=useState(''),[action,setAction]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[approved,setApproved]=useState(false);
 async function call(input:any){setBusy(true);setError('');setApproved(false);try{const r=await fetch('/api/flow/statements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');setAction(data);if(data.id)setReference(data.id);}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 async function load(){setBusy(true);setError('');setApproved(false);try{const r=await fetch(`/api/flow/statements?id=${encodeURIComponent(reference)}`);if(!r.ok)throw new Error('Action unavailable. Check your reference and permissions.');setAction(await r.json());}catch(e){setError(e instanceof Error?e.message:'Could not load');}finally{setBusy(false);}}
 const button='rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50';
 return <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
  <Link href="/" className="text-sm underline">Back to workspace</Link>
  <header><h1 className="text-3xl font-semibold">Flow</h1><p className="mt-2 text-slate-600">Prepare tenant statements, review the exact documents, then authorise email submission.</p></header>
  <form className="space-y-3 rounded-xl border p-5" onSubmit={e=>{e.preventDefault();void call({action:'prepare',key:crypto.randomUUID(),instruction});}}>
   <label htmlFor="instruction" className="block font-medium">What would you like Flow to prepare?</label>
   <input id="instruction" className="w-full rounded border p-3" value={instruction} maxLength={500} required onChange={e=>setInstruction(e.target.value)} placeholder="Send [tenant] [property] their last six months of statements"/>
   <p className="text-sm text-slate-600">“Last months” means completed calendar months, excluding the current month. Only issued statements are used. Nothing is sent at this step.</p>
   <button disabled={busy} className={button}>Prepare for review</button>
  </form>
  <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void load();}}><label className="flex-1">Existing request reference<input className="mt-1 w-full rounded border p-2" value={reference} onChange={e=>setReference(e.target.value)} required/></label><button className={button} disabled={busy}>Load status</button></form>
  {busy&&<p role="status">Checking authorised records…</p>}{error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-4">{error}</p>}
  {action&&<section className="space-y-4 rounded-xl border p-5" aria-label="Statement action review">
   <h2 className="text-xl font-semibold">{action.status.replaceAll('_',' ')}</h2><p className="break-all text-sm">Reference: {action.id}</p>
   {action.reason&&<p role="status">{action.reason}</p>}{action.message&&<p role="status">{action.message}</p>}
   {action.status==='clarification'&&<div><p>Select the intended account. Each selection prepares a new request with explicit scope.</p>{action.choices?.map((c:any)=><button key={`${c.tenant_id}:${c.property_id}`} disabled={busy} className="my-2 block w-full rounded border p-3 text-left" onClick={()=>void call({action:'prepare',key:crypto.randomUUID(),instruction:action.instruction,entityId:c.entity_id,propertyId:c.property_id,tenantId:c.tenant_id})}>{c.company} · {c.property} · {c.tenant}</button>)}</div>}
   {action.status==='preparing'&&<button disabled={busy} className={button} onClick={()=>void call({action:'resume',id:action.id})}>Prepare verified PDF attachments</button>}
   {action.manifest&&<><dl><dt className="font-medium">Recipient</dt><dd className="break-all">{action.manifest.recipient}</dd><dt className="mt-2 font-medium">Subject</dt><dd>{action.manifest.subject}</dd></dl><pre className="whitespace-pre-wrap rounded bg-slate-50 p-4 font-sans">{action.manifest.body}</pre>
    <ul className="space-y-3">{action.manifest.attachments.map((file:any)=><li key={file.statement_id} className="break-all rounded border p-3"><a className="underline" download={file.filename} href={`data:application/pdf;base64,${file.content}`}>{file.filename}</a><p className="text-xs text-slate-600">SHA-256: {file.sha256}</p></li>)}</ul>
    <p className="text-sm">Approval expires: {action.expires_at}. Source or recipient changes require a fresh review.</p>
    {['review','failed'].includes(action.status)&&<><label className="flex items-start gap-2"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I have reviewed the recipient, periods, attached PDFs and message, and authorise this email.</label><button disabled={busy||!approved} className={button} onClick={()=>void call({action:'approve',id:action.id,hash:action.manifest_hash})}>Approve and submit email</button></>}
   </>}
   {action.status==='submitted'&&<p>Email accepted by the provider. Delivery has not been confirmed.</p>}
   {['submitting','reconciliation_required'].includes(action.status)&&<p>The send outcome needs confirmation. Do not create another request to resend; ask the authorised administrator to reconcile the provider record first.</p>}
  </section>}
 </main>;
}
