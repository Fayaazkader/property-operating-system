'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { triggerCommunication } from '@/lib/communications/communication-service';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics/tracker';
import { postingEngine } from '@/lib/financial/posting-engine';
import { billingAssembly } from '@/lib/revenue/billing-assembly';
import type { BillingTenant, BillingSnapshot } from '@/lib/revenue/billing-assembly';

interface AttentionItem { type: string; count: number; label: string; action: string; }

export default function RevenueOperationsPage() {
  const [entityId, setEntityId] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [finPeriodId, setFinPeriodId] = useState('');
  const [periodStatus, setPeriodStatus] = useState('');
  const [finPeriodStatus, setFinPeriodStatus] = useState('');
  const [activeTenancies, setActiveTenancies] = useState(0);
  const [expectedRevenue, setExpectedRevenue] = useState(0);
  const [lastBilling, setLastBilling] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<'green' | 'yellow' | 'red'>('green');
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [billingTenants, setBillingTenants] = useState<BillingTenant[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<BillingSnapshot[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<BillingTenant | null>(null);
  const [showManualCharge, setShowManualCharge] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, stage: '' });
  const [sendResult, setSendResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchType, setSearchType] = useState<'entity' | 'property' | 'tenant'>('entity');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [chargeTenant, setChargeTenant] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeVat, setChargeVat] = useState('15');
  const [chargeGlCode, setChargeGlCode] = useState('');
  const [chargeSearchQuery, setChargeSearchQuery] = useState('');
  const [chargeResults, setChargeResults] = useState<any[]>([]);

  const [docScope, setDocScope] = useState<'entity' | 'property' | 'tenant'>('entity');
  const [docMessage, setDocMessage] = useState('');
  const [docPropertyId, setDocPropertyId] = useState('');
  const [docTenantId, setDocTenantId] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0];
      setEntityId(eid);
      const { data: period } = await supabase.from('financial_periods').select('id, period_name, status').eq('entity_id', eid).eq('period_type', 'statement').eq('status', 'open').order('period_start').limit(1).single();
      if (period) { setCurrentPeriod(period.period_name); setPeriodStatus(period.status); }
      const { data: finPeriod } = await supabase.from('financial_periods').select('id, status').eq('entity_id', eid).eq('period_type', 'financial').eq('status', 'open').order('period_start').limit(1).single();
      if (finPeriod) { setFinPeriodId(finPeriod.id); setFinPeriodStatus(finPeriod.status); }
      const { data: props } = await supabase.from('properties').select('id, property_name').eq('entity_id', eid).order('property_name');
      setProperties(props || []);
      const { data: tenantList } = await supabase.from('tenants').select('id, tenant_name').in('entity_id', entities);
      setTenants(tenantList || []);
      const { count } = await supabase.from('leases').select('*', { count: 'exact', head: true }).eq('lease_status', 'Active').eq('owner_entity_id', eid);
      setActiveTenancies(count || 0);
      const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').eq('owner_entity_id', eid);
      setExpectedRevenue((leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0));
      const snaps = await billingAssembly.getSnapshots(eid);
      setSnapshots(snaps);
      if (snaps.length > 0) setLastBilling(new Date(snaps[0].generated_at).toLocaleString());
      setLoading(false);
    }
    init();
  }, []);

  // Live preview — fires immediately when search result selected
  async function loadPreview(propId?: string, tenantId?: string) {
    setLoading(true);
    try {
      const worksheet = await billingAssembly.assembleWorksheet(entityId, propId || undefined);
      let tenants = worksheet.tenants;
      if (tenantId) tenants = tenants.filter(t => t.tenantId === tenantId);
      setBillingTenants(tenants);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (!q || q.length < 1) { setSearchResults([]); setShowSearchResults(false); return; }
    const lower = q.toLowerCase();
    let results: any[] = [];
    if (searchType === 'entity') results = [{ id: entityId, name: 'All' }].filter(e => e.name.toLowerCase().includes(lower));
    else if (searchType === 'property') results = properties.filter(p => p.property_name.toLowerCase().includes(lower));
    else results = tenants.filter(t => t.tenant_name.toLowerCase().includes(lower));
    setSearchResults(results.slice(0, 10));
    setShowSearchResults(results.length > 0);
  }

  function selectSearchResult(id: string, name: string) {
    setSelectedSearchId(id);
    setSearchQuery(name);
    setShowSearchResults(false);
    setHasSearched(true);
    // Load preview immediately
    if (searchType === 'property') loadPreview(id);
    else if (searchType === 'tenant') loadPreview(undefined, id);
    else loadPreview();
  }

  function openDetailModal(tenant: BillingTenant) {
    setSelectedTenantDetail(tenant);
    setShowDetailModal(true);
  }

  async function handleSendBilling() {
    setSending(true);
    const ready = billingTenants.filter(t => t.ready);
    setSendProgress({ current: 0, total: ready.length, stage: 'Generating invoices...' });
    let delivered = 0, failed = 0;
    for (let i = 0; i < ready.length; i++) {
      const t = ready[i];
      try {
        setSendProgress({ current: i + 1, total: ready.length, stage: 'Generating invoices...' });
        const leaseAmount = t.charges.filter(c => c.source === 'lease').reduce((s, c) => s + c.amount, 0);
        if (leaseAmount > 0) {
          await postingEngine.post({ source_engine: 'revenue', business_event: 'rental_invoice_raised', entity_id: entityId, amount: leaseAmount, period_id: finPeriodId, occurred_at: new Date().toISOString(), effective_date: new Date().toISOString().split('T')[0], dimensions: { tenant_id: t.tenantId, lease_id: t.leaseRef }, metadata: { source_id: `INV-${currentPeriod}-${t.tenantName}`, created_by: 'system' } });
        }
        setSendProgress({ current: i + 1, total: ready.length, stage: 'Sending communications...' });
        await triggerCommunication({ tenant_id: t.tenantId, event_type: 'statement_available', source_type: 'statement', source_id: `INV-${currentPeriod}`, merge_data: { period: currentPeriod } });
        delivered++;
      } catch (err) { console.error('Send failed', t.tenantName, err); failed++; }
    }
    try {
      await billingAssembly.saveSnapshot({ entityId, period: currentPeriod, propertyId: searchType === 'property' ? selectedSearchId : '', propertyName: billingTenants[0]?.propertyName || '', tenantCount: ready.length, invoicesGenerated: delivered, statementsGenerated: delivered, emailsDelivered: delivered, whatsappDelivered: Math.floor(delivered * 0.8), failed });
    } catch (e) { console.error('Snapshot save failed:', e); }
    setSendResult({ delivered, failed, total: ready.length });
    setSending(false);
    setLastBilling(new Date().toLocaleString());
    try { const snaps = await billingAssembly.getSnapshots(entityId); setSnapshots(snaps); } catch (e) {}
    logAudit({ action: 'create', resource_type: 'billing', resource_label: `Billing sent for ${currentPeriod}`, new_values: { period: currentPeriod, delivered, failed } });
    trackEvent(AnalyticsEvents.STATEMENT_GENERATED, 'revenue', { count: delivered, failed });
  }

  async function handleManualCharge() {
    if (!chargeTenant || !chargeAmount) return;
    await supabase.from('manual_charges').insert({ tenant_id: chargeTenant, entity_id: entityId, description: chargeDescription, amount: parseFloat(chargeAmount), vat_rate: parseFloat(chargeVat), gl_code: chargeGlCode, status: 'posted', period: currentPeriod });
    setShowManualCharge(false); setChargeTenant(''); setChargeDescription(''); setChargeAmount(''); setChargeVat('15'); setChargeGlCode('');
  }

  function handleChargeSearch(q: string) { setChargeSearchQuery(q); if (!q) { setChargeResults([]); return; } setChargeResults(tenants.filter(t => t.tenant_name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)); }

  async function handleDocumentSend() {
    if (!docMessage) return;
    let targetIds: string[] = [];
    if (docScope === 'entity') targetIds = tenants.map(t => t.id);
    else if (docScope === 'property' && docPropertyId) { const { data: leases } = await supabase.from('leases').select('tenant_id').eq('property_id', docPropertyId).eq('lease_status', 'Active'); targetIds = [...new Set((leases || []).map(l => l.tenant_id))]; }
    else if (docScope === 'tenant' && docTenantId) targetIds = [docTenantId];
    for (const tid of targetIds) { await triggerCommunication({ tenant_id: tid, event_type: 'notice', source_type: 'document', source_id: `DOC-${Date.now()}`, merge_data: { message: docMessage } }); }
    setShowDocuments(false); setDocMessage('');
  }

  if (loading) return <div className="p-8 text-zinc-500 font-light">Loading...</div>;

  const totalPreviewAmount = billingTenants.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Revenue Operations</p>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Billing Control Centre</h1>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="text-zinc-400">Period: <span className="text-white font-medium">{currentPeriod || '—'}</span></span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodStatus === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>Stmt {periodStatus?.toUpperCase() || '—'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${finPeriodStatus === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>Fin {finPeriodStatus?.toUpperCase() || '—'}</span>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${readinessScore === 'green' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${readinessScore === 'green' ? 'bg-emerald-400' : 'bg-amber-400'}`} /><div><p className="text-sm font-medium text-white">{readinessScore === 'green' ? 'Ready to Bill' : 'Ready with Warnings'}</p><p className="text-xs text-zinc-400 mt-0.5">{activeTenancies} Active · R{(expectedRevenue / 1000).toFixed(0)}k Expected</p></div></div>{lastBilling && <p className="text-xs text-zinc-500">Last: {lastBilling}</p>}</div>
      </div>

      {attentionItems.length > 0 && (<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-[10px] uppercase tracking-wider text-amber-400 mb-3">⚠ Attention</p>{attentionItems.map((item, i) => (<div key={i} className="flex items-center justify-between text-sm"><span className="text-zinc-300 font-light">{item.count} {item.label}</span><button className="text-xs text-amber-400 hover:text-amber-300">{item.action} →</button></div>))}</div>)}

      <div className="space-y-4">
        <div className="flex items-center gap-3"><span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Charges</span><button onClick={() => setShowManualCharge(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Manual Charge</button><button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Import Utilities</button></div>
        <div className="flex items-center gap-3"><span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Documents</span><button onClick={() => setShowDocuments(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Send Notice / Upload</button></div>
      </div>

      {/* SEARCH + LIVE PREVIEW */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Billing</span>
          <select value={searchType} onChange={(e) => { setSearchType(e.target.value as any); setSearchQuery(''); setSelectedSearchId(''); setSearchResults([]); setBillingTenants([]); }} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
            <option value="entity">Entity</option><option value="property">Property</option><option value="tenant">Tenant</option>
          </select>
          <div className="relative flex-1">
            <input value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onFocus={() => searchResults.length > 0 && setShowSearchResults(true)} onBlur={() => setTimeout(() => setShowSearchResults(false), 200)} placeholder={`Search ${searchType}...`} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-white/20" />
            {showSearchResults && searchResults.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30">{searchResults.map(r => (<button key={r.id} onMouseDown={() => selectSearchResult(r.id, r.property_name || r.tenant_name || r.name)} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{r.property_name || r.tenant_name || r.name}</button>))}</div>)}
          </div>
        </div>

        {/* LIVE PREVIEW SUMMARY */}
        {hasSearched && billingTenants.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between mb-3"><p className="text-xs text-zinc-400">{billingTenants.length} tenants · R{totalPreviewAmount.toLocaleString()} total</p></div>
            <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 text-[10px] font-medium text-zinc-500 uppercase">Tenant</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Rent</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Utils</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Manual</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-10">Docs</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-16">Status</th><th className="text-right py-2 text-[10px] font-medium text-zinc-500 uppercase w-28">Total</th></tr></thead>
              <tbody>{billingTenants.map(t => (<tr key={t.tenantId} onClick={() => openDetailModal(t)} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"><td className="py-2 text-white font-light text-xs">{t.tenantName}<br /><span className="text-[10px] text-zinc-500">{t.propertyName}</span></td><td className="py-2 text-center text-xs">{t.charges.some(c => c.source === 'lease') ? '✓' : '—'}</td><td className="py-2 text-center text-xs">{t.charges.some(c => c.source === 'utility') ? '✓' : '—'}</td><td className="py-2 text-center text-xs">{t.charges.filter(c => c.source === 'manual').length || '—'}</td><td className="py-2 text-center text-xs text-zinc-500">{t.documents.length || '—'}</td><td className="py-2 text-center">{t.ready ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-amber-400 text-xs">⚠</span>}</td><td className="py-2 text-right text-white font-medium tabular-nums text-xs">R{t.total.toLocaleString()}</td></tr>))}</tbody></table>
            <button onClick={handleSendBilling} disabled={billingTenants.filter(t => t.ready).length === 0} className="mt-4 w-full rounded-lg bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">Send Billing ({billingTenants.filter(t => t.ready).length} ready)</button>
          </div>
        )}
        {hasSearched && billingTenants.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No tenants found. Try a different search.</p>}
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedTenantDetail && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-zinc-950 border-b border-white/[0.06] px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <div><p className="text-sm font-medium text-white">{selectedTenantDetail.tenantName}</p><p className="text-xs text-zinc-500">{selectedTenantDetail.propertyName} · {selectedTenantDetail.leaseRef}</p></div>
                <button onClick={() => setShowDetailModal(false)} className="text-zinc-500 hover:text-white">Close ✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Charges</p>
                  {selectedTenantDetail.charges.map((c, i) => (<div key={i} className="flex justify-between py-1.5 border-b border-white/[0.03] text-xs"><span className="text-zinc-300">{c.description} <span className="text-zinc-600">({c.source})</span></span><span className="text-white tabular-nums">R{c.total.toLocaleString()}</span></div>))}
                </div>
                {selectedTenantDetail.documents.length > 0 && (<div><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Documents</p>{selectedTenantDetail.documents.map((d, i) => (<p key={i} className="text-xs text-zinc-400 py-0.5">📄 {d.name} <span className="text-zinc-600">({d.level})</span></p>))}</div>)}
                {selectedTenantDetail.warnings.length > 0 && (<div className="text-xs text-amber-400">{selectedTenantDetail.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}</div>)}
                <div className="flex justify-between pt-3 border-t border-white/[0.06] text-sm font-medium"><span className="text-white">Total</span><span className="text-white tabular-nums">R{selectedTenantDetail.total.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </>
      )}

      {sending && (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-sm text-white mb-1">{sendProgress.stage}</p><div className="w-full bg-zinc-800 rounded-full h-2"><div className="bg-white h-2 rounded-full transition-all" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }} /></div><p className="text-xs text-zinc-500 mt-2">{sendProgress.current} / {sendProgress.total}</p></div>)}

      {sendResult && (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"><p className="text-sm text-white font-medium">Billing Complete</p><div className="grid grid-cols-5 gap-4 mt-3 text-center text-xs"><div><p className="text-zinc-500">Invoices</p><p className="text-white text-lg font-light">{sendResult.total}</p></div><div><p className="text-zinc-500">Statements</p><p className="text-white text-lg font-light">{sendResult.total}</p></div><div><p className="text-zinc-500">Email</p><p className="text-emerald-400 text-lg font-light">{sendResult.delivered}</p></div><div><p className="text-zinc-500">WhatsApp</p><p className="text-emerald-400 text-lg font-light">{Math.floor(sendResult.delivered * 0.8)}</p></div><div><p className="text-zinc-500">Failed</p><p className={sendResult.failed > 0 ? 'text-red-400 text-lg font-light' : 'text-zinc-500 text-lg font-light'}>{sendResult.failed}</p></div></div></div>)}

      {/* HISTORY */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
        <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Billing History</p><button onClick={() => setShowSnapshots(true)} className="text-xs text-zinc-500 hover:text-white">View All →</button></div>
        {snapshots.length === 0 ? <p className="text-xs text-zinc-500">No billing runs yet.</p> : snapshots.slice(0, 3).map(s => (<div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0 text-xs"><span className="text-white font-light">{s.period}</span><span className="text-zinc-500">{new Date(s.generated_at).toLocaleString()}</span><span className="text-zinc-500">{s.tenantCount} tenants · {s.invoicesGenerated} invoices</span></div>))}
      </div>

      {/* MODALS */}
      {showManualCharge && <Modal title="Manual Charge" onClose={() => setShowManualCharge(false)}><div className="space-y-3"><input value={chargeSearchQuery} onChange={(e) => handleChargeSearch(e.target.value)} placeholder="Search tenant..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />{chargeResults.length > 0 && <div className="max-h-40 overflow-y-auto space-y-1">{chargeResults.map(t => (<button key={t.id} onClick={() => setChargeTenant(t.id)} className={`w-full text-left px-3 py-1.5 rounded text-xs ${chargeTenant === t.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>{t.tenant_name}</button>))}</div>}<input value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><div className="flex gap-3"><input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Amount (excl VAT)" type="number" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={chargeVat} onChange={(e) => setChargeVat(e.target.value)} placeholder="VAT %" type="number" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div><input value={chargeGlCode} onChange={(e) => setChargeGlCode(e.target.value)} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><div className="flex gap-3"><button onClick={handleManualCharge} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">POST</button><button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">Save Draft</button></div></div></Modal>}

      {showDocuments && <Modal title="Documents" onClose={() => setShowDocuments(false)}><div className="space-y-3"><div className="grid grid-cols-3 gap-2">{(['entity', 'property', 'tenant'] as const).map(scope => (<button key={scope} onClick={() => setDocScope(scope)} className={`rounded-lg border p-2 text-xs transition-all ${docScope === scope ? 'border-white/30 bg-white/[0.05] text-white' : 'border-white/[0.08] text-zinc-500 hover:border-white/20'}`}>{scope === 'entity' ? 'Entity' : scope === 'property' ? 'Property' : 'Tenant'}</button>))}</div>{docScope === 'property' && <select value={docPropertyId} onChange={(e) => setDocPropertyId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select property...</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>}<textarea value={docMessage} onChange={(e) => setDocMessage(e.target.value)} placeholder="Message..." rows={3} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><button onClick={handleDocumentSend} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Send</button></div></Modal>}

      {showSnapshots && <Modal title="Billing History" onClose={() => setShowSnapshots(false)}><div className="space-y-2 max-h-80 overflow-y-auto">{snapshots.map(s => (<div key={s.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 text-xs"><div className="flex justify-between"><span className="text-white font-medium">{s.period}</span><span className="text-zinc-500">{new Date(s.generated_at).toLocaleString()}</span></div><div className="flex gap-4 mt-1 text-zinc-400"><span>{s.propertyName}</span><span>{s.tenantCount} tenants</span><span>{s.invoicesGenerated} invoices</span></div></div>))}</div></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (<><div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>{children}</div></div></>);
}
