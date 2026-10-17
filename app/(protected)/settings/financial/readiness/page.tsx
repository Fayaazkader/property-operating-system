'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useEntityContext } from '@/app/context/EntityContext';

type Readiness = { entity_id: string; revision: number; reviewed: boolean; can_manage: boolean; vat_status: string | null; accounting_mode: string; currency: string; year_start: number; issues: string[]; mappings: Record<string,boolean>; journal: boolean; receivable: boolean; payable: boolean; deposit: boolean; accounts: unknown[]; taxes: unknown[]; account_mappings: unknown[]; posting_templates: unknown[]; posting_template_lines: unknown[] };
const emptyImport = JSON.stringify({ accounts: [], taxes: [], mappings: [] }, null, 2);
export default function FinancialReadinessPage() {
  const { availableEntities } = useEntityContext();
  const [entity, setEntity] = useState('');
  const [state, setState] = useState<Readiness | null>(null);
  const [input, setInput] = useState(emptyImport);
  const [vat, setVat] = useState('');
  const [method, setMethod] = useState('');
  const [currency, setCurrency] = useState('');
  const [year, setYear] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null); setError(''); setMessage(''); setConfirmed(false); setInput(emptyImport);
    if (!entity) return;
    setBusy(true);
    void supabase.rpc('get_entity_financial_readiness', {p_entity:entity}).then(({data,error}) => {
      if (!active) return;
      setBusy(false);
      if (error) { setError(error.message); return; }
      setState(data); setVat(data.vat_status ?? ''); setMethod(data.accounting_mode ?? ''); setCurrency(data.currency ?? ''); setYear(String(data.year_start ?? ''));
    }, () => { if(active) { setBusy(false); setError('Configuration could not be loaded. Retry before making changes.'); } });
    return () => { active=false; };
  }, [entity,reload]);
  async function command(kind: 'import' | 'review') {
    if (!state || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const params = kind === 'import' ? {p_entity:entity,p_revision:state.revision,p_configuration:JSON.parse(input)} : {p_entity:entity,p_revision:state.revision,p_vat_status:vat,p_accounting_mode:method,p_currency:currency,p_year_start:Number(year)};
      const {data,error} = await supabase.rpc(kind === 'import' ? 'import_entity_financial_configuration' : 'review_entity_financial_configuration',params);
      if(error) throw error;
      setState(data); setConfirmed(false);
      setMessage(kind === 'import' ? 'Configuration imported. Review the saved records and confirm your policies before posting.' : 'Review recorded. Only the operations marked ready below are enabled; transaction and period controls still apply.');
    } catch(cause) { setError(cause instanceof Error ? cause.message : (cause as {message?:string})?.message ?? 'The operation was not confirmed. Reload before retrying.'); }
    finally { setBusy(false); }
  }
  const field='w-full rounded-lg border border-white/20 bg-zinc-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2';
  return <main className="max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-semibold">Financial setup</h1><p className="mt-2 text-sm text-zinc-300">Your organisation can operate while financial setup is incomplete. You choose its accounting structure, mappings and VAT treatment. AssetFlow enforces posting integrity.</p></div>
    <label className="block">Legal entity<select disabled={busy} className={field} value={entity} onChange={e=>setEntity(e.target.value)}><option value="">Select an entity</option>{availableEntities.map(e=><option key={e.entity_id} value={e.entity_id}>{e.entity_name}</option>)}</select></label>
    {busy && <p role="status">Checking or saving configuration…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-400/30 p-4 text-red-200">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-white/20 p-4">{message}</p>}
    {entity && <button disabled={busy} onClick={()=>setReload(x=>x+1)} className="underline">Reload authoritative configuration</button>}
    {state && <>
      <section className="rounded-xl border border-white/15 p-4"><h2 className="font-medium">{state.reviewed ? 'Client review recorded' : 'Configuration requires client review'}</h2>
        <ul className="mt-3 space-y-2">{(['journal','receivable','payable','deposit'] as const).map(op=><li key={op}>{op}: <strong>{state.reviewed && state[op] ? 'Ready' : 'Not ready'}</strong></li>)}</ul>
        {state.issues.length>0 && <ul className="mt-4 list-disc pl-5 text-amber-200">{state.issues.map(x=><li key={x}>{x}</li>)}</ul>}
        <p className="mt-3 text-sm text-zinc-300">AR control enables receivables; AP control enables payables; deposit liability enables deposits. Registered VAT also requires the relevant input/output VAT mappings. Open periods and transaction-specific rules remain mandatory.</p>
        <p className="mt-2 text-sm">Mappings: {Object.entries(state.mappings).map(([key,valid])=>`${key}: ${valid?'valid':'missing or invalid'}`).join(' · ')}</p>
      </section>
      <details className="rounded-xl border border-white/15 p-4"><summary>Review saved accounts, mappings and tax codes</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({accounts:state.accounts,mappings:state.account_mappings,taxes:state.taxes,postingTemplates:state.posting_templates,postingTemplateLines:state.posting_template_lines},null,2)}</pre></details>
      {state.can_manage ? <>
        <section className="space-y-3 rounded-xl border border-white/15 p-4"><h2 className="font-medium">Import your configuration</h2><p className="text-sm text-zinc-300">Upload or paste reviewed JSON. Imports add records; conflicting existing records are never silently overwritten. No recommended chart or VAT rates are applied automatically.</p>
          <details className="text-sm"><summary>Import fields</summary><p>accounts: code, name, type (asset/liability/equity/income/expense), category, vatCategory (standard/zero_rated/exempt/non_vatable), vatRate, isVatable, optional parentCode. taxes: code, name, rate, recoverable. mappings: role, accountCode. All three arrays are required. Supply your approved classifications; this is not tax advice.</p></details>
          <label className="block text-sm">JSON file<input type="file" accept="application/json,.json" disabled={busy} className="block py-2" onChange={async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>1000000)throw Error('Import must be under 1 MB.');const text=await f.text();JSON.parse(text);setInput(text);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Unable to read file');}}}/></label>
          <label className="block text-sm">Review import before saving<textarea disabled={busy} className={`${field} mt-1 font-mono`} rows={12} value={input} onChange={e=>setInput(e.target.value)}/></label>
          <button disabled={busy} onClick={()=>void command('import')} className="rounded-lg border border-white/30 px-4 py-2 disabled:opacity-50">Import reviewed records</button>
        </section>
        <form onSubmit={e=>{e.preventDefault();if(confirmed)void command('review');}} className="space-y-4 rounded-xl border border-white/15 p-4"><h2 className="font-medium">Confirm client accounting policies</h2>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label>VAT registration<select required className={field} value={vat} onChange={e=>{setVat(e.target.value);setConfirmed(false);}}><option value="">Choose treatment</option><option value="registered">VAT registered</option><option value="not_registered">Not VAT registered</option></select></label>
            <label>Accounting method<select required className={field} value={method} onChange={e=>{setMethod(e.target.value);setConfirmed(false);}}><option value="">Choose method</option><option value="accrual">Accrual</option><option value="cash">Cash</option></select></label>
            <label>Base currency<input required pattern="[A-Z]{3}" className={field} value={currency} onChange={e=>{setCurrency(e.target.value);setConfirmed(false);}}/></label>
            <label>Financial year starts (month 1–12)<input required type="number" min={1} max={12} className={field} value={year} onChange={e=>{setYear(e.target.value);setConfirmed(false);}}/></label>
          </fieldset>
          <label className="flex gap-3 text-sm"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have reviewed the saved accounting structure, mappings and tax codes and authorise these policies for this entity.</label>
          <button disabled={busy||!confirmed} className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-50">Confirm financial setup</button>
        </form>
      </> : <p>Your client administrator or a user with financial-configuration authority must complete this setup.</p>}
    </>}
    <Link href="/app" className="inline-block underline">Return to workspace</Link>
  </main>;
}
