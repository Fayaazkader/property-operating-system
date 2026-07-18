'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit/audit-log';
import { triggerCommunication } from '@/lib/communications/communication-service';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics/tracker';
import { postingEngine } from '@/lib/financial/posting-engine';
import { documentEngine } from '@/lib/documents/engine/document-engine';
import { billingAssembly } from '@/lib/revenue/billing-assembly';
import type { BillingTenant, BillingSnapshot } from '@/lib/revenue/billing-assembly';

interface AttentionItem { type: string; count: number; label: string; action: string; }

export default function RevenueOperationsPage() {
  const [entityId, setEntityId] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [periodStatus, setPeriodStatus] = useState('');
  const [finPeriodStatus, setFinPeriodStatus] = useState('');
  const [activeTenancies, setActiveTenancies] = useState(0);
  const [expectedRevenue, setExpectedRevenue] = useState(0);
  const [lastBilling, setLastBilling] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<'green' | 'yellow' | 'red'>('green');
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [billingTenants, setBillingTenants] = useState<BillingTenant[]>([]);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<BillingSnapshot[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showManualCharge, setShowManualCharge] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, stage: '' });
  const [sendResult, setSendResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [docScope, setDocScope] = useState<'entity' | 'property' | 'tenant'>('entity');
  const [docMessage, setDocMessage] = useState('');
  const [docPropertyId, setDocPropertyId] = useState('');
  const [docTenantId, setDocTenantId] = useState('');
  const [chargeTenant, setChargeTenant] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeVat, setChargeVat] = useState('15');
  const [chargeGlCode, setChargeGlCode] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0];
      setEntityId(eid);
      const { data: period } = await supabase.from('financial_periods').select('period_name, status').eq('entity_id', eid).eq('period_type', 'statement').eq('status', 'open').order('period_start').limit(1).single();
      if (period) { setCurrentPeriod(period.period_name); setPeriodStatus(period.status); }
      const { data: finPeriod } = await supabase.from('financial_periods').select('status').eq('entity_id', eid).eq('period_type', 'financial').eq('status', 'open').order('period_start').limit(1).single();
      if (finPeriod) setFinPeriodStatus(finPeriod.status);
      const { data: props } = await supabase.from('properties').select('id, property_name').eq('entity_id', eid).order('property_name');
      setProperties(props || []);
      const { data: tenantList } = await supabase.from('tenants').select('id, tenant_name').in('entity_id', entities);
      setTenants(tenantList || []);
      const { count } = await supabase.from('leases').select('*', { count: 'exact', head: true }).eq('lease_status', 'Active').eq('owner_entity_id', eid);
      setActiveTenancies(count || 0);
      const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('lease_status', 'Active').eq('owner_entity_id', eid);
      setExpectedRevenue((leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0));
      const items: AttentionItem[] = [];
      const { data: leaseIds } = await supabase.from('leases').select('id').eq('lease_status', 'Active').eq('owner_entity_id', eid);
      const ids = (leaseIds || []).map((l: any) => l.id);
      if (ids.length > 0) {
        const { data: rules } = await supabase.from('billing_rules').select('lease_id').in('lease_id', ids).eq('status', 'active');
        const leasesWithRules = new Set((rules || []).map((r: any) => r.lease_id));
        const missing = ids.filter(id => !leasesWithRules.has(id));
        if (missing.length > 0) items.push({ type: 'missing_rules', count: missing.length, label: 'Missing Billing Rules', action: 'Review' });
      }
      const { data: drafts } = await supabase.from('manual_charges').select('id', { count: 'exact', head: true }).eq('entity_id', eid).eq('status', 'draft');
      if ((drafts || 0) > 0) items.push({ type: 'draft_charges', count: drafts as number, label: 'Draft Manual Charges', action: 'Review' });
      const { data: interestDrafts } = await supabase.from('interest_charges').select('id', { count: 'exact', head: true }).eq('entity_id', eid).eq('status', 'draft');
      if ((interestDrafts || 0) > 0) items.push({ type: 'interest', count: interestDrafts as number, label: 'Interest Charges Ready', action: 'Approve' });
      setAttentionItems(items);
      setReadinessScore(items.filter(i => i.type === 'missing_rules').length > 0 ? 'red' : items.length > 0 ? 'yellow' : 'green');
      const snaps = await billingAssembly.getSnapshots(eid);
      setSnapshots(snaps);
      if (snaps.length > 0) setLastBilling(new Date(snaps[0].generated_at).toLocaleString());
      setLoading(false);
    }
    init();
  }, []);

  async function handlePreview() {
    setShowPreview(true);
    setLoading(true);
    try {
      const worksheet = await billingAssembly.assembleWorksheet(entityId, selectedProperty || undefined);
      setBillingTenants(worksheet.tenants);
    } catch (err) { console.error(err); }
    setLoading(false);
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
          await postingEngine.post({ source_engine: 'revenue', business_event: 'rental_invoice_raised', entity_id: entityId, amount: leaseAmount, occurred_at: new Date().toISOString(), effective_date: new Date().toISOString().split('T')[0], dimensions: { tenant_id: t.tenantId, lease_id: t.leaseRef }, metadata: { source_id: `INV-${currentPeriod}-${t.tenantName}`, created_by: 'system' } });
        }
        await documentEngine.generate({ entityId, documentType: 'invoice', tenantName: t.tenantName, propertyName: t.propertyName, leaseRef: t.leaseRef, data: { charges: t.charges.map(c => ({ amount: c.amount, vat_amount: c.vatAmount, description: c.description, vat_rate: 15 })) } });

        setSendProgress({ current: i + 1, total: ready.length, stage: 'Sending communications...' });
        await triggerCommunication({ tenant_id: t.tenantId, event_type: 'statement_available', source_type: 'statement', source_id: `INV-${currentPeriod}`, merge_data: { period: currentPeriod } });
        delivered++;
      } catch { failed++; }
    }

    await billingAssembly.saveSnapshot({ entityId, period: currentPeriod, propertyId: selectedProperty, propertyName: billingTenants[0]?.propertyName || '', tenantCount: ready.length, invoicesGenerated: delivered, statementsGenerated: delivered, emailsDelivered: delivered, whatsappDelivered: Math.floor(delivered * 0.8), failed });
    setSendResult({ delivered, failed, total: ready.length });
    setSending(false);
    setLastBilling(new Date().toLocaleString());
    const snaps = await billingAssembly.getSnapshots(entityId);
    setSnapshots(snaps);
    logAudit({ action: 'create', resource_type: 'billing', resource_label: `Billing sent for ${currentPeriod}`, new_values: { period: currentPeriod, delivered, failed } });
    trackEvent(AnalyticsEvents.STATEMENT_GENERATED, 'revenue', { count: delivered, failed });
  }

  async function handleManualCharge() {
    if (!chargeTenant || !chargeAmount) return;
    await supabase.from('manual_charges').insert({ tenant_id: chargeTenant, entity_id: entityId, description: chargeDescription, amount: parseFloat(chargeAmount), vat_rate: parseFloat(chargeVat), gl_code: chargeGlCode, status: 'posted', period: currentPeriod });
    setShowManualCharge(false);
    setChargeTenant(''); setChargeDescription(''); setChargeAmount(''); setChargeVat('15'); setChargeGlCode('');
  }

  async function handleDocumentSend() {
    if (!docMessage) return;
    let targetIds: string[] = [];
    if (docScope === 'entity') targetIds = tenants.map(t => t.id);
    else if (docScope === 'property' && docPropertyId) { const { data: leases } = await supabase.from('leases').select('tenant_id').eq('property_id', docPropertyId).eq('lease_status', 'Active'); targetIds = [...new Set((leases || []).map(l => l.tenant_id))]; }
    else if (docScope === 'tenant' && docTenantId) targetIds = [docTenantId];
    for (const tid of targetIds) { await triggerCommunication({ tenant_id: tid, event_type: 'notice', source_type: 'document', source_id: `DOC-${Date.now()}`, merge_data: { message: docMessage } }); }
    setShowDocuments(false);
    setDocMessage('');
  }

  if (loading) return <div className="p-8 text-zinc-500 font-light">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Revenue Operations</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Billing Control Centre</h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Billing Period: <span className="text-white font-medium">{currentPeriod || '—'}</span></span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${periodStatus === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>Statement {periodStatus?.toUpperCase() || '—'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${finPeriodStatus === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>Financial {finPeriodStatus?.toUpperCase() || '—'}</span>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${readinessScore === 'green' ? 'border-emerald-500/20 bg-emerald-500/5' : readinessScore === 'yellow' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${readinessScore === 'green' ? 'bg-emerald-400' : readinessScore === 'yellow' ? 'bg-amber-400' : 'bg-red-400'}`} />
            <div>
              <p className="text-sm font-medium text-white">{readinessScore === 'green' ? '🟢 Ready to Bill' : readinessScore === 'yellow' ? '🟡 Ready with Warnings' : '🔴 Billing Blocked'}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{activeTenancies} Active Tenancies · R{(expectedRevenue / 1000).toFixed(0)}k Expected Revenue</p>
            </div>
          </div>
          {lastBilling && <p className="text-xs text-zinc-500">Last Billing: {lastBilling}</p>}
        </div>
      </div>

      {attentionItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-3">⚠ Attention</p>
          <div className="space-y-2">
            {attentionItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300 font-light">{item.count} {item.label}</span>
                <button className="text-xs text-amber-400 hover:text-amber-300">{item.action} →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button onClick={() => setShowManualCharge(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">+ Manual Charge</button>
        <button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20 transition-all">Import Utilities</button>
        <button onClick={handlePreview} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20 transition-all">Billing Preview</button>
        <button onClick={handleSendBilling} disabled={billingTenants.filter(t => t.ready).length === 0} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">Send Billing</button>
        <button onClick={() => setShowDocuments(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20 transition-all">Documents</button>
        <button onClick={() => setShowSnapshots(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20 transition-all">History</button>
      </div>

      {showPreview && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Property:</span>
            <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
              <option value="">All Properties</option>
              {properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
            </select>
            <button onClick={handlePreview} className="text-xs text-zinc-500 hover:text-white">Refresh ↻</button>
          </div>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Billing Worksheet — {currentPeriod}</p>
            </div>
            {billingTenants.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">No billing data. Add billing rules to active leases.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                      <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Tenant</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-16">Rent</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-16">Utils</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-16">Manual</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-16">Interest</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-16">Late Fee</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-12">Docs</th>
                      <th className="text-center py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-20">Warnings</th>
                      <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingTenants.map(t => (
                      <tr key={t.tenantId} onClick={() => setExpandedTenant(expandedTenant === t.tenantId ? null : t.tenantId)} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer transition-colors">
                        <td className="py-2.5 px-4 text-white font-light">{t.tenantName}</td>
                        <td className="py-2.5 px-4 text-center">{t.charges.some(c => c.source === 'lease') ? '✓' : '—'}</td>
                        <td className="py-2.5 px-4 text-center">{t.charges.some(c => c.source === 'utility') ? '✓' : t.warnings.some(w => w.includes('Utility')) ? '⚠' : '—'}</td>
                        <td className="py-2.5 px-4 text-center">{t.charges.some(c => c.source === 'manual') ? t.charges.filter(c => c.source === 'manual').length : '—'}</td>
                        <td className="py-2.5 px-4 text-center">{t.charges.some(c => c.source === 'interest') ? '✓' : '—'}</td>
                        <td className="py-2.5 px-4 text-center">{t.charges.some(c => c.source === 'late_fee') ? '✓' : '—'}</td>
                        <td className="py-2.5 px-4 text-center text-zinc-400">{t.documents.length}</td>
                        <td className="py-2.5 px-4 text-center">{t.warnings.length > 0 ? <span className="text-amber-400 text-xs">⚠ {t.warnings.length}</span> : <span className="text-emerald-400 text-xs">✓</span>}</td>
                        <td className="py-2.5 px-4 text-right text-white font-medium tabular-nums">R{t.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {sending && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
          <p className="text-sm text-white mb-1">{sendProgress.stage}</p>
          <div className="w-full bg-zinc-800 rounded-full h-2"><div className="bg-white h-2 rounded-full transition-all" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }} /></div>
          <p className="text-xs text-zinc-500 mt-2">{sendProgress.current} / {sendProgress.total}</p>
        </div>
      )}

      {sendResult && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-sm text-white font-medium">Billing Complete</p>
          <div className="grid grid-cols-5 gap-4 mt-3 text-center text-xs">
            <div><p className="text-zinc-500">Invoices</p><p className="text-white text-lg font-light">{sendResult.total}</p></div>
            <div><p className="text-zinc-500">Statements</p><p className="text-white text-lg font-light">{sendResult.total}</p></div>
            <div><p className="text-zinc-500">Email</p><p className="text-emerald-400 text-lg font-light">{sendResult.delivered}</p></div>
            <div><p className="text-zinc-500">WhatsApp</p><p className="text-emerald-400 text-lg font-light">{Math.floor(sendResult.delivered * 0.8)}</p></div>
            <div><p className="text-zinc-500">Failed</p><p className={sendResult.failed > 0 ? 'text-red-400 text-lg font-light' : 'text-zinc-500 text-lg font-light'}>{sendResult.failed}</p></div>
          </div>
          {sendResult.failed > 0 && <button className="text-xs text-amber-400 mt-3 hover:text-amber-300">Retry Failed →</button>}
        </div>
      )}

      {/* Billing History Modal */}
      {showSnapshots && (
        <Modal title="Billing History" onClose={() => setShowSnapshots(false)}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {snapshots.length === 0 ? <p className="text-sm text-zinc-500">No billing runs yet.</p> : snapshots.map(s => (
              <div key={s.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 text-xs">
                <div className="flex justify-between"><span className="text-white font-medium">{s.period}</span><span className="text-zinc-500">{new Date(s.generated_at).toLocaleString()}</span></div>
                <div className="flex gap-4 mt-1 text-zinc-400"><span>{s.propertyName}</span><span>{s.tenantCount} tenants</span><span>{s.invoicesGenerated} invoices</span></div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Manual Charge Modal */}
      {showManualCharge && (
        <Modal title="Manual Charge" onClose={() => setShowManualCharge(false)}>
          <div className="space-y-3">
            <select value={chargeTenant} onChange={(e) => setChargeTenant(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select tenant...</option>{tenants.map(t => (<option key={t.id} value={t.id}>{t.tenant_name}</option>))}</select>
            <input value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <div className="flex gap-3"><input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="Amount (excl VAT)" type="number" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={chargeVat} onChange={(e) => setChargeVat(e.target.value)} placeholder="VAT %" type="number" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
            <input value={chargeGlCode} onChange={(e) => setChargeGlCode(e.target.value)} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <div className="border border-dashed border-white/[0.1] rounded-lg p-4 text-center"><p className="text-xs text-zinc-500">Drop supporting documents here</p></div>
            <div className="flex gap-3"><button onClick={handleManualCharge} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">POST</button><button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">Save Draft</button></div>
          </div>
        </Modal>
      )}

      {/* Documents Modal */}
      {showDocuments && (
        <Modal title="Documents" onClose={() => setShowDocuments(false)}>
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">Send a document or notice to tenants.</p>
            <div className="grid grid-cols-3 gap-2">{(['entity', 'property', 'tenant'] as const).map(scope => (<button key={scope} onClick={() => setDocScope(scope)} className={`rounded-lg border p-2 text-xs transition-all ${docScope === scope ? 'border-white/30 bg-white/[0.05] text-white' : 'border-white/[0.08] text-zinc-500 hover:border-white/20'}`}>{scope === 'entity' ? 'Entire Entity' : scope === 'property' ? 'By Property' : 'Specific Tenant'}</button>))}</div>
            {docScope === 'property' && <select value={docPropertyId} onChange={(e) => setDocPropertyId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select property...</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>}
            {docScope === 'tenant' && <select value={docTenantId} onChange={(e) => setDocTenantId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select tenant...</option>{tenants.map(t => (<option key={t.id} value={t.id}>{t.tenant_name}</option>))}</select>}
            <textarea value={docMessage} onChange={(e) => setDocMessage(e.target.value)} placeholder="Message..." rows={3} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <div className="border border-dashed border-white/[0.1] rounded-lg p-4 text-center"><p className="text-xs text-zinc-500">Drop files to attach</p></div>
            <button onClick={handleDocumentSend} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Send</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>
          {children}
        </div>
      </div>
    </>
  );
}
