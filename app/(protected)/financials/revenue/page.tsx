'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { triggerCommunication } from '@/lib/communications/communication-service';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics/tracker';
import { postingEngine } from '@/lib/financial/posting-engine';
import { buildRevenueContext } from '@/lib/revenue/revenue-context-builder';
import { buildPortfolioRevenueContext } from '@/lib/revenue/portfolio-revenue-builder';
import { billingAssembly } from '@/lib/revenue/billing-assembly';
import { freezeBilling } from '@/lib/revenue/billing-freeze';
import type { BillingTenant, RevenueContext } from '@/lib/revenue/types';
import type { BillingSnapshot } from '@/lib/revenue/billing-assembly';
import ImportUtilitiesModal from '@/app/components/financials/ImportUtilitiesModal';
import InvoicePreviewModal from '@/app/components/financials/InvoicePreviewModal';
import { useEntityContext } from '@/app/context/EntityContext';
import { getPortfolioHistory } from '@/lib/revenue/portfolio-history';

interface AttentionItem { type: string; count: number; label: string; action: string; }

export default function RevenueOperationsPage() {
  const [entityId, setEntityId] = useState('');
    const { activeEntityId, activeScope, availableEntities, loading: entityLoading } = useEntityContext();
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [stmtPeriodId, setStmtPeriodId] = useState('');
  const [finPeriodId, setFinPeriodId] = useState('');
  const [periodStatus, setPeriodStatus] = useState('');
  const [worksheetStatus, setWorksheetStatus] = useState('');
  const [worksheet, setWorksheet] = useState<any>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<any>(null);
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
  const [showImportUtilities, setShowImportUtilities] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
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
  const [docTenantSearch, setDocTenantSearch] = useState('');
  const [docTenantResults, setDocTenantResults] = useState<any[]>([]);
  const [docTenantId, setDocTenantId] = useState('');
  
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Use platform Entity Context
      const entityIds = activeEntityId ? [activeEntityId] : availableEntities.map(e => e.entity_id);
      if (!entityIds.length) { setLoading(false); return; }

      setEntityId(activeEntityId || '');

      // Load properties and tenants across all entities (portfolio or entity scope)
      const { data: props } = await supabase.from('properties').select('id, property_name').in('entity_id', entityIds).order('property_name');
      setProperties(props || []);

      const { data: tenantList } = await supabase.from('tenants').select('id, tenant_name').in('entity_id', entityIds);
      setTenants(tenantList || []);

      const { count } = await supabase.from('leases').select('*', { count: 'exact', head: true }).eq('lease_status', 'Active').in('owner_entity_id', entityIds);
      setActiveTenancies(count || 0);

      const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').in('owner_entity_id', entityIds);
      setExpectedRevenue((leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0));

                   // Load period context based on scope
      if (activeEntityId) {
        const { data: period } = await supabase.from('financial_periods').select('id, period_name, status, period_start').eq('entity_id', activeEntityId).eq('period_type', 'statement').eq('status', 'open').order('period_start').limit(1).single();
        if (period) { setCurrentPeriod(period.period_name); setPeriodStatus(period.status); setPeriodStartDate(period.period_start); setStmtPeriodId(period.id); }
        const { data: finPeriod } = await supabase.from('financial_periods').select('id, status').eq('entity_id', activeEntityId).eq('period_type', 'financial').eq('status', 'open').order('period_start').limit(1).single();
        if (finPeriod) { setFinPeriodId(finPeriod.id); setFinPeriodStatus(finPeriod.status); }
        await refreshHistory(activeEntityId);
      } else {
        const portfolioHistory = await getPortfolioHistory(entityIds);
        setSnapshots(portfolioHistory as any);
        if (portfolioHistory.length > 0) setLastBilling(new Date(portfolioHistory[0].generated_at).toLocaleString());
      }

      setLoading(false);
    }
    if (!entityLoading) init();
  }, [activeEntityId, entityLoading, availableEntities]);

  async function refreshHistory(eid: string) {
    const snaps = await billingAssembly.getSnapshots(eid);
    setSnapshots(snaps);
    if (snaps.length > 0) setLastBilling(new Date(snaps[0].generated_at).toLocaleString());
  }

      async function loadPreview(propId?: string, tenantId?: string) {
    setPreviewLoading(true);
    try {
      // Portfolio-wide — build per-entity contexts
      const { data: { user } } = await supabase.auth.getUser();
      const { data: accessRows } = await supabase
        .from('user_entity_access')
        .select('entity_id')
        .eq('user_id', user?.id);
      const entityIds = (accessRows || []).map((r: any) => r.entity_id);

      const portfolio = await buildPortfolioRevenueContext(entityIds);
      let tenants = portfolio.allTenants;
      const worksheet = {
        entityId: 'portfolio',
        periodName: null,
        periodStart: null,
        periodEnd: null,
        tenants,
        isAlreadyBilled: false,
        totalExpected: portfolio.totalExpected,
        entityContexts: portfolio.entityContexts,
        errors: portfolio.errors,
      };

      if (tenantId) tenants = tenants.filter((t: any) => t.tenantId === tenantId);
      setBillingTenants(tenants);
      setWorksheet(worksheet);
      setWorksheetStatus(worksheet?.isAlreadyBilled ? 'already_billed' : 'ready');
    } catch (err) {
      console.error('Load preview failed', err);
    }
    setPreviewLoading(false);
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
    if (searchType === 'property') loadPreview(id);
    else if (searchType === 'tenant') loadPreview(undefined, id);
    else loadPreview();
  }

  function openDetailModal(tenant: BillingTenant) {
    setSelectedTenantDetail(tenant);
    setShowDetailModal(true);
  }

          // ─── SEND INVOICES — Delivery only. No financial mutation. ───
      async function handleSendInvoices() {
        setSending(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setSending(false); alert("Session expired"); return; }
        const accessToken = session.access_token;

        let sent = 0, sendFailed = 0, totalCount = 0;

        // Current Revenue view — ALL tenants (not filtered by ready yet)
        const viewTenants = [...billingTenants];
        if (viewTenants.length === 0) {
        console.log("View tenants:", viewTenants.map((t: any) => ({ name: t.tenantName, entityId: t.entityId })));
          setSendResult({ delivered: 0, failed: 0, total: 0 });
          setSending(false);
          return;
        }

        // Group by authoritative entity
        const entityGroups = new Map<string, any[]>();
        for (const t of viewTenants) {
          const eid = (t as any).entityId;
          if (!eid) { console.error('Tenant missing entityId:', t.tenantName); sendFailed++; continue; }
          if (!entityGroups.has(eid)) entityGroups.set(eid, []);
          entityGroups.get(eid)!.push(t);
        }

        // Get period context per entity from portfolio builder if available
        const contextMap = new Map<string, any>();
        if (worksheet?.entityContexts) {
          for (const ec of worksheet.entityContexts) {
            contextMap.set(ec.entityId, ec);
          }
        }

        for (const [eid, tenants] of entityGroups) {
          // Use the portfolio builder's context if available
          const ctx = contextMap.get(eid);
          if (!ctx) { console.error('No period context for entity:', eid); sendFailed += tenants.length; continue; }

          const isClosed = ctx.statementStatus === 'closed';

          if (isClosed) {
            // CLOSED — send frozen statements for these tenants
            const tenantIds = tenants.map((t: any) => t.tenantId);
            const { data: statements } = await supabase
              .from('statements_generated')
              .select('id, tenant_id, statement_data')
              .eq('entity_id', eid)
              .in('tenant_id', tenantIds)
              .eq('status', 'issued')
              .order('generated_at', { ascending: false });

            const relevant = (statements || []).filter((s: any) => {
              const data = s.statement_data || {};
              return data.period_id === ctx.stmtPeriodId;
            });

            totalCount += relevant.length;

            for (const stmt of relevant) {
              try {
                const invoiceId = (stmt as any).statement_data?.invoice_id;
                if (!invoiceId) { sendFailed++; continue; }
                const { data: tenant } = await supabase.from('tenants').select('email, whatsapp_number').eq('id', (stmt as any).tenant_id).single();
                if (tenant) {
                  const response = await fetch('/api/communications/send-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                    body: JSON.stringify({ invoice_id: invoiceId, send_email: !!tenant.email, send_whatsapp: !!tenant.whatsapp_number }),
                  });
                  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
                  const result = await response.json();
                  if (!result.success) throw new Error(result.error || 'Delivery failed');
                }
                sent++;
              } catch (err: any) { console.error('Send failed', (stmt as any).id, err); sendFailed++; }
            }
          } else {
            // OPEN — send live invoices for READY tenants only
            const readyTenants = tenants.filter((t: any) => t.ready);
            if (readyTenants.length === 0) continue;

            // Must have financial period
            if (!ctx.finPeriodId) { console.error('No financial period for entity:', eid); sendFailed += readyTenants.length; totalCount += readyTenants.length; continue; }

            totalCount += readyTenants.length;

            for (const t of readyTenants) {
              try {
                const response = await fetch('/api/communications/send-open-invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                  body: JSON.stringify({
                    tenant_id: (t as any).tenantId,
                    lease_id: (t as any).leaseId,
                    entity_id: eid,
                    stmt_period_id: ctx.stmtPeriodId,
                    fin_period_id: ctx.finPeriodId,
                  }),
                });
                if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`);
                const result = await response.json();
                if (!result.success) throw new Error(result.error || 'Delivery failed');
                sent++;
              } catch (err: any) { console.error('Send failed', (t as any).tenantName, err); sendFailed++; }
            }
          }
        }

        setSendResult({ delivered: sent, failed: sendFailed, total: totalCount });
        setSending(false);
      }

    async function handleViewSnapshot(snapshot: BillingSnapshot) {
    if (billingTenants.length > 0) {
      const tenantId = billingTenants[0].tenantId;
      const { data } = await supabase
        .from('statements_generated')
        .select('statement_data')
        .eq('entity_id', entityId)
        .eq('tenant_id', tenantId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data?.statement_data) {
        setPreviewInvoiceData(data.statement_data);
        setShowInvoicePreview(true);
      }
    }
  }
  async function handleManualCharge() {
    if (!chargeTenant || !chargeAmount) return;
    await supabase.from('manual_charges').insert({ tenant_id: chargeTenant, entity_id: entityId, description: chargeDescription, amount: parseFloat(chargeAmount), vat_rate: parseFloat(chargeVat), gl_code: chargeGlCode, status: 'posted', period: currentPeriod });
    setShowManualCharge(false); setChargeTenant(''); setChargeDescription(''); setChargeAmount(''); setChargeVat('15'); setChargeGlCode('');
  }

  function handleChargeSearch(q: string) { setChargeSearchQuery(q); if (!q) { setChargeResults([]); return; } setChargeResults(tenants.filter(t => t.tenant_name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)); }

  function handleDocTenantSearch(q: string) { setDocTenantSearch(q); if (!q) { setDocTenantResults([]); return; } setDocTenantResults(tenants.filter(t => t.tenant_name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)); }

  async function handleDocumentSend() {
    if (!docMessage) return;
    let targetIds: string[] = [];
    if (docScope === 'entity') targetIds = tenants.map(t => t.id);
    else if (docScope === 'property' && docPropertyId) { const { data: leases } = await supabase.from('leases').select('tenant_id').eq('property_id', docPropertyId).eq('lease_status', 'Active'); targetIds = [...new Set((leases || []).map(l => l.tenant_id))]; }
    else if (docScope === 'tenant' && docTenantId) targetIds = [docTenantId];
    for (const tid of targetIds) { await triggerCommunication({ tenant_id: tid, event_type: 'notice', source_type: 'document', source_id: `DOC-${Date.now()}`, merge_data: { message: docMessage } }); }
    setShowDocuments(false); setDocMessage(''); setDocTenantId('');
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
        <div className="flex items-center gap-3"><span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Charges</span><button onClick={() => setShowManualCharge(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Manual Charge</button><button onClick={() => setShowImportUtilities(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Import Utilities</button></div>
        <div className="flex items-center gap-3"><span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Documents</span><button onClick={() => setShowDocuments(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Send Notice / Upload</button></div>
      </div>

      {/* SEARCH + LIVE PREVIEW */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 w-24">Billing</span>
          <select value={searchType} onChange={(e) => { setSearchType(e.target.value as any); setSearchQuery(''); setSelectedSearchId(''); setSearchResults([]); setBillingTenants([]); }} className="rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-white outline-none">
            <option value="entity">Entity</option><option value="property">Property</option><option value="tenant">Tenant</option>
          </select>
          <div className="relative flex-1">
            <input value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onFocus={() => searchResults.length > 0 && setShowSearchResults(true)} onBlur={() => setTimeout(() => setShowSearchResults(false), 200)} placeholder={`Search ${searchType}...`} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-white outline-none focus:border-white/20" />
            {showSearchResults && searchResults.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-white/[0.08] rounded-lg overflow-hidden z-30">{searchResults.map(r => (<button key={r.id} onMouseDown={() => selectSearchResult(r.id, r.property_name || r.tenant_name || r.name)} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{r.property_name || r.tenant_name || r.name}</button>))}</div>)}
          </div>
        </div>

        {/* LIVE PREVIEW — only this area shows loading */}
        {previewLoading && <p className="text-xs text-zinc-500 py-2">Loading preview...</p>}
        {!previewLoading && hasSearched && billingTenants.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between mb-3"><p className="text-xs text-zinc-400">{billingTenants.length} tenants · R{totalPreviewAmount.toLocaleString()} total</p></div>
            <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 text-[10px] font-medium text-zinc-500 uppercase">Tenant</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Rent</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Utils</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-14">Manual</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-10">Docs</th><th className="text-center py-2 text-[10px] font-medium text-zinc-500 uppercase w-16">Status</th><th className="text-right py-2 text-[10px] font-medium text-zinc-500 uppercase w-28">Total</th></tr></thead>
              <tbody>{billingTenants.map(t => (<tr key={t.tenantId} onClick={() => openDetailModal(t)} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"><td className="py-2 text-white font-light text-xs">{t.tenantName}<br /><span className="text-[10px] text-zinc-500">{t.property_name}</span></td><td className="py-2 text-center text-xs">{t.charges.some(c => c.source === 'lease') ? '✓' : '—'}</td><td className="py-2 text-center text-xs">{t.charges.some(c => c.source === 'utility') ? '✓' : '—'}</td><td className="py-2 text-center text-xs">{t.charges.filter(c => c.source === 'manual').length || '—'}</td><td className="py-2 text-center text-xs text-zinc-500">{t.documents.length || '—'}</td><td className="py-2 text-center">{t.ready ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-amber-400 text-xs">⚠</span>}</td><td className="py-2 text-right text-white font-medium tabular-nums text-xs">R{t.total.toLocaleString()}</td></tr>))}</tbody></table>
                                    <div className="mt-4 space-y-2">
              <button onClick={handleSendInvoices} disabled={sending} className="w-full rounded-lg bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {sending ? 'Sending...' : 'Send Invoice'}
              </button>
            </div>
          </div>
        )}
        {!previewLoading && hasSearched && billingTenants.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No tenants found. Try a different search.</p>}
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedTenantDetail && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-white/[0.06] px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <div><p className="text-sm font-medium text-white">{selectedTenantDetail.tenantName}</p><p className="text-xs text-zinc-500">{selectedTenantDetail.property_name} · {selectedTenantDetail.leaseRef}</p></div>
                <button onClick={() => setShowDetailModal(false)} className="text-zinc-500 hover:text-white">Close ✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Charges</p>
                <div className="flex text-[9px] text-zinc-600 mb-1">
                  <span className="flex-1">Description</span>
                  <span className="w-20 text-right">Ex VAT</span>
                  <span className="w-16 text-right">VAT</span>
                  <span className="w-24 text-right">Incl VAT</span>
                </div>
                {selectedTenantDetail.charges.map((c, i) => (
                  <div key={i} className="flex items-center py-1.5 border-b border-white/[0.03] text-xs">
                    <span className="flex-1 text-zinc-300 truncate pr-2">{c.description} <span className="text-zinc-600">({c.source})</span></span>
                    <span className="w-20 text-right text-zinc-400 tabular-nums">R{c.amount.toLocaleString()}</span>
                    <span className="w-16 text-right text-zinc-400 tabular-nums">R{c.vatAmount.toLocaleString()}</span>
                    <span className="w-24 text-right text-white tabular-nums font-medium">R{c.total.toLocaleString()}</span>
                  </div>
                ))}</div>
                {selectedTenantDetail.documents.length > 0 && (<div><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Documents</p>{selectedTenantDetail.documents.map((d, i) => (<p key={i} className="text-xs text-zinc-400 py-0.5">📄 {d.name} <span className="text-zinc-600">({d.level})</span></p>))}</div>)}
                {selectedTenantDetail.warnings.length > 0 && (<div className="text-xs text-amber-400">{selectedTenantDetail.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}</div>)}
                <div className="pt-3 border-t border-white/[0.06] space-y-1">
                <div className="flex text-xs"><span className="flex-1 text-zinc-500">Subtotal (Ex VAT)</span><span className="w-24 text-right text-zinc-300 tabular-nums">R{selectedTenantDetail.charges.reduce((s: number, c: any) => s + c.amount, 0).toLocaleString()}</span></div>
                <div className="flex text-xs"><span className="flex-1 text-zinc-500">VAT</span><span className="w-24 text-right text-zinc-300 tabular-nums">R{selectedTenantDetail.charges.reduce((s: number, c: any) => s + c.vatAmount, 0).toLocaleString()}</span></div>
                <div className="flex text-sm font-medium pt-1 border-t border-white/[0.06]"><span className="flex-1 text-white">Total (Incl VAT)</span><span className="w-24 text-right text-white tabular-nums">R{selectedTenantDetail.total.toLocaleString()}</span></div>
              </div>
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
        {snapshots.length === 0 ? <p className="text-xs text-zinc-500">No billing runs yet.</p> : snapshots.slice(0, 3).map(s => (<div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0 text-xs hover:bg-white/[0.02] cursor-pointer px-2 -mx-2 rounded"><div onClick={() => { /* TODO: navigate to invoice view */ }}><span className="text-white font-light">{s.period}</span><span className="text-zinc-500 ml-3">{new Date(s.generated_at).toLocaleString()}</span><span className="text-zinc-500 ml-3">{s.tenant_count} tenants · {s.invoices_generated} invoices</span></div><button onClick={(e) => { e.stopPropagation(); handleViewSnapshot(s); }} className="text-[10px] text-zinc-500 hover:text-white border border-white/[0.08] rounded px-2 py-0.5">View</button></div>))}
      </div>

      {/* MANUAL CHARGE MODAL */}
      {showManualCharge && <Modal title="Manual Charge" onClose={() => setShowManualCharge(false)}><div className="space-y-3"><input value={chargeSearchQuery} onChange={(e) => handleChargeSearch(e.target.value)} placeholder="Search tenant..." className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />{chargeResults.length > 0 && <div className="max-h-40 overflow-y-auto space-y-1">{chargeResults.map(t => (<button key={t.id} onClick={() => setChargeTenant(t.id)} className={`w-full text-left px-3 py-1.5 rounded text-xs ${chargeTenant === t.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>{t.tenant_name}</button>))}</div>}<input value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><div className="flex gap-3"><input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Amount (excl VAT)" type="number" className="flex-1 rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><input value={chargeVat} onChange={(e) => setChargeVat(e.target.value)} placeholder="VAT %" type="number" className="w-20 rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /></div><input value={chargeGlCode} onChange={(e) => setChargeGlCode(e.target.value)} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><div className="flex gap-3"><button onClick={handleManualCharge} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">POST</button><button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">Save Draft</button></div></div></Modal>}

      {/* DOCUMENTS MODAL */}
      {showDocuments && <Modal title="Documents" onClose={() => setShowDocuments(false)}><div className="space-y-3"><div className="grid grid-cols-3 gap-2">{(['entity', 'property', 'tenant'] as const).map(scope => (<button key={scope} onClick={() => { setDocScope(scope); setDocTenantId(''); setDocTenantSearch(''); }} className={`rounded-lg border p-2 text-xs transition-all ${docScope === scope ? 'border-white/30 bg-white/[0.05] text-white' : 'border-white/[0.08] text-zinc-500 hover:border-white/20'}`}>{scope === 'entity' ? 'Entity' : scope === 'property' ? 'Property' : 'Tenant'}</button>))}</div>
      {docScope === 'entity' && <p className="text-xs text-zinc-500 py-2">This will send to ALL tenants in your entity ({tenants.length} tenants).</p>}
      {docScope === 'property' && <select value={docPropertyId} onChange={(e) => setDocPropertyId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"><option value="">Select property...</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>}
      {docScope === 'tenant' && (<div><input value={docTenantSearch} onChange={(e) => handleDocTenantSearch(e.target.value)} placeholder="Search tenant..." className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />{docTenantResults.length > 0 && <div className="max-h-32 overflow-y-auto space-y-1 mt-1">{docTenantResults.map(t => (<button key={t.id} onClick={() => { setDocTenantId(t.id); setDocTenantSearch(t.tenant_name); setDocTenantResults([]); }} className="w-full text-left px-3 py-1.5 rounded text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{t.tenant_name}</button>))}</div>}</div>)}
      <textarea value={docMessage} onChange={(e) => setDocMessage(e.target.value)} placeholder="Message..." rows={3} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><button onClick={handleDocumentSend} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Send</button></div></Modal>}

      {/* IMPORT UTILITIES MODAL */}
      {showImportUtilities && <ImportUtilitiesModal entityId={entityId || ''} periodId={finPeriodId || ''} onClose={() => setShowImportUtilities(false)} onImported={() => {}} />}

      {showInvoicePreview && previewInvoiceData && (
        <InvoicePreviewModal data={previewInvoiceData} onClose={() => setShowInvoicePreview(false)} />
      )}

      {showSnapshots && <Modal title="Billing History" onClose={() => setShowSnapshots(false)}><div className="space-y-2 max-h-80 overflow-y-auto">{snapshots.map(s => (<div key={s.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 text-xs"><div className="flex justify-between"><span className="text-white font-medium">{s.period}</span><span className="text-zinc-500">{new Date(s.generated_at).toLocaleString()}</span></div><div className="flex gap-4 mt-1 text-zinc-400"><span>{s.property_name}</span><span>{s.tenant_count} tenants</span><span>{s.invoices_generated} invoices</span></div></div>))}</div></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (<><div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>{children}</div></div></>);
}
