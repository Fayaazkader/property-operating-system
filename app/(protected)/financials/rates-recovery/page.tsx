'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ratesRecoveryEngine, ratesRecoveryDocuments } from '@/lib/revenue/services/rates-recovery-engine';
import { ratesProofGenerator } from '@/lib/revenue/services/rates-proof-generator';
import { renderProofHTML } from '@/lib/revenue/services/rates-proof-renderer';
import { publish } from '@/lib/platform/events/event-bus';

export default function RatesRecoveryPage() {
  const [entityId, setEntityId] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [previousRates, setPreviousRates] = useState('');
  const [newRates, setNewRates] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [proofHTML, setProofHTML] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState({ property: '', year: '', status: '' });
  const [kpis, setKpis] = useState({ latestRun: '', runsThisYear: 0, pending: 0, awaiting: 0 });

  const monthlyIncrease = (parseFloat(newRates) || 0) - (parseFloat(previousRates) || 0);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);

      const { data: props } = await supabase.from('properties').select('id, property_name, municipality').eq('entity_id', entities[0]);
      setProperties(props || []);

      const history = await ratesRecoveryEngine.getRunHistory(entities[0]);
      setRuns(history || []);
      updateKPIs(history || []);
    }
    init();
  }, []);

  function updateKPIs(history: any[]) {
    const thisYear = new Date().getFullYear();
    const yearRuns = history.filter((r: any) => new Date(r.effective_date).getFullYear() === thisYear);
    setKpis({
      latestRun: history[0] ? new Date(history[0].effective_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) : '—',
      runsThisYear: yearRuns.length,
      pending: history.filter((r: any) => r.status === 'preview' || r.status === 'draft').length,
      awaiting: 0,
    });
  }

  async function handleCreateRun() {
    if (!selectedProperty || !previousRates || !newRates || !effectiveDate) return;
    setLoading(true);
    try {
      const run = await ratesRecoveryEngine.createRun({
        entityId,
        propertyId: selectedProperty,
        effectiveDate,
        previousMonthlyRates: parseFloat(previousRates),
        newMonthlyRates: parseFloat(newRates),
        reason: reason || undefined,
        municipalityName: municipality || undefined,
      });
      const prev = await ratesRecoveryEngine.previewAllocations(run.id);
      setPreview(prev);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  }

  async function handleSaveAllocations() {
    if (!preview) return;
    setLoading(true);
    await ratesRecoveryEngine.saveAllocations(preview.run.id, preview.allocations);
    const updated = await ratesRecoveryEngine.previewAllocations(preview.run.id);
    setPreview(updated);
    setLoading(false);
  }

  async function handleApprove() {
    if (!preview) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await ratesRecoveryEngine.approve(preview.run.id, session?.user?.id || 'system');
      
      await publish('revenue.activity', {
        correlationId: crypto.randomUUID(),
        source: 'rates-recovery',
        version: '1.0',
        payload: {
          type: 'rates_increase_applied',
          property: preview.property_name,
          effectiveDate: preview.run.effective_date,
          billingRulesUpdated: preview.allocations.length,
          backChargesCreated: preview.allocations.length,
        },
      });

      setShowApprovalConfirm(false);
      setPreview(null);
      setActiveTab('history');
      const history = await ratesRecoveryEngine.getRunHistory(entityId);
      setRuns(history || []);
      updateKPIs(history || []);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  }

  async function handleViewRun(runId: string) {
    const detail = await ratesRecoveryEngine.getRunDetail(runId);
    setSelectedRun(detail);
    const docs = await ratesRecoveryDocuments.getDocuments(runId);
    setDocuments(docs || []);
  }

  async function handleGenerateProof(allocationId: string) {
    const proof = await ratesProofGenerator.generateProof(allocationId);
    if (proof) {
      setSelectedAllocation(proof);
      setProofHTML(renderProofHTML(proof));
    }
  }

  function handlePropertySelect(propertyId: string) {
    setSelectedProperty(propertyId);
    const prop = properties.find(p => p.id === propertyId);
    if (prop?.municipality) setMunicipality(prop.municipality);
  }

  const filteredRuns = runs.filter(run => {
    if (historyFilter.property && (run as any).properties?.id !== historyFilter.property) return false;
    if (historyFilter.year && new Date(run.effective_date).getFullYear().toString() !== historyFilter.year) return false;
    if (historyFilter.status && run.status !== historyFilter.status) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Revenue Operations</p>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Rates & Taxes Recovery</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Latest Run', value: kpis.latestRun },
          { label: 'Runs This Year', value: kpis.runsThisYear },
          { label: 'Pending Approval', value: kpis.pending },
          { label: 'Properties Awaiting', value: kpis.awaiting },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{kpi.label}</p>
            <p className="text-xl font-light text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {[
          { key: 'new' as const, label: 'New Run' },
          { key: 'history' as const, label: 'History' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${activeTab === tab.key ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* NEW RUN */}
      {activeTab === 'new' && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">New Rates Increase Run</p>
              
              <div>
                <label className="text-[10px] text-zinc-600 block mb-1">Property</label>
                <select value={selectedProperty} onChange={(e) => handlePropertySelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="">Select property...</option>
                  {properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-600 block mb-1">Previous Monthly</label>
                  <input type="number" value={previousRates} onChange={(e) => setPreviousRates(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="R10,000" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 block mb-1">New Monthly</label>
                  <input type="number" value={newRates} onChange={(e) => setNewRates(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="R12,000" />
                </div>
              </div>

              {monthlyIncrease !== 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-[10px] text-amber-500 uppercase tracking-wider">Monthly Increase</p>
                  <p className="text-lg font-light text-amber-400">R{monthlyIncrease.toLocaleString()}</p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-zinc-600 block mb-1">Effective Date</label>
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 block mb-1">Municipality</label>
                <input type="text" value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="Auto-populated from property" />
              </div>

              <div>
                <label className="text-[10px] text-zinc-600 block mb-1">Reason</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="Annual Municipal Rates Increase 2026" />
              </div>

              <button onClick={handleCreateRun} disabled={loading || !selectedProperty || !previousRates || !newRates || !effectiveDate} className="w-full rounded-lg bg-white py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {loading ? 'Calculating...' : 'Preview Allocations'}
              </button>
            </div>
          </div>

          {/* PREVIEW */}
          {preview && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
              <div>
                <p className="text-xs text-white font-medium">{preview.property_name}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Monthly increase: R{preview.run.monthly_increase.toLocaleString()} · Total GLA: {preview.total_gla.toFixed(2)} m² · {preview.allocations.length} tenants
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-500">
                      <th className="text-left py-1.5 font-medium">Tenant</th>
                      <th className="text-right py-1.5 font-medium">GLA</th>
                      <th className="text-right py-1.5 font-medium">%</th>
                      <th className="text-right py-1.5 font-medium">Previous</th>
                      <th className="text-right py-1.5 font-medium">+Increase</th>
                      <th className="text-right py-1.5 font-medium">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.allocations.map((a: any) => (
                      <tr key={a.tenant_id} className="border-b border-white/[0.03] text-zinc-400">
                        <td className="py-1.5 text-zinc-300">{a.tenant_name}</td>
                        <td className="py-1.5 text-right">{a.gla_sqm.toFixed(2)}</td>
                        <td className="py-1.5 text-right">{(a.gla_percentage * 100).toFixed(2)}%</td>
                        <td className="py-1.5 text-right">R{a.previous_monthly_charge.toFixed(2)}</td>
                        <td className="py-1.5 text-right text-amber-400">+R{a.monthly_increase.toFixed(2)}</td>
                        <td className="py-1.5 text-right text-white">R{a.new_monthly_charge.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveAllocations} disabled={loading || preview.run.status !== 'draft'} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-white hover:border-white/20 disabled:opacity-40">
                  Save
                </button>
                <button onClick={() => setShowApprovalConfirm(true)} disabled={loading || preview.run.status === 'draft'} className="flex-1 rounded-lg bg-white py-2 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">
                  Approve & Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPROVAL CONFIRMATION */}
      {showApprovalConfirm && preview && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowApprovalConfirm(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-medium text-white mb-4">Confirm Approval</p>
              <div className="space-y-2 text-xs text-zinc-400 mb-6">
                <p>✓ Update {preview.allocations.length} billing rules</p>
                <p>✓ Create {preview.allocations.length} back charges</p>
                <p>✓ Apply increases effective {new Date(preview.run.effective_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowApprovalConfirm(false)} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-white hover:border-white/20">Cancel</button>
                <button onClick={handleApprove} disabled={loading} className="flex-1 rounded-lg bg-white py-2 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">Confirm</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-3">
            <select value={historyFilter.property} onChange={(e) => setHistoryFilter({ ...historyFilter, property: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
              <option value="">All Properties</option>
              {properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
            </select>
            <select value={historyFilter.year} onChange={(e) => setHistoryFilter({ ...historyFilter, year: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
              <option value="">All Years</option>
              {[2026, 2025, 2024].map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
            <select value={historyFilter.status} onChange={(e) => setHistoryFilter({ ...historyFilter, status: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-white outline-none">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="preview">Preview</option>
              <option value="applied">Applied</option>
            </select>
          </div>

          {filteredRuns.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8">No recovery runs found.</p>
          ) : (
            filteredRuns.map((run: any) => (
              <div key={run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-white font-medium">
                      {(run as any).properties?.property_name} — {new Date(run.effective_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      R{run.previous_monthly_rates.toLocaleString()} → R{run.new_monthly_rates.toLocaleString()} · +R{run.monthly_increase.toLocaleString()}/mo
                      {run.reason && ` · ${run.reason}`}
                      {run.municipality_name && ` · ${run.municipality_name}`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    run.status === 'applied' ? 'bg-emerald-500/10 text-emerald-400' :
                    run.status === 'processing' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>{run.status}</span>
                </div>

                <div className="flex gap-4 text-[11px]">
                  <button onClick={() => handleViewRun(run.id)} className="text-zinc-500 hover:text-white transition-colors">View Allocations</button>
                  <button onClick={() => {}} className="text-zinc-500 hover:text-white transition-colors">Evidence</button>
                  <button onClick={() => {}} className="text-zinc-500 hover:text-white transition-colors">Audit</button>
                </div>

                {selectedRun?.run?.id === run.id && (
                  <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
                    {/* Allocations */}
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-zinc-500">
                          <th className="text-left py-1.5">Tenant</th>
                          <th className="text-right py-1.5">Previous</th>
                          <th className="text-right py-1.5">+Increase</th>
                          <th className="text-right py-1.5">New</th>
                          <th className="text-right py-1.5">Back Charge</th>
                          <th className="text-right py-1.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedRun.allocations || []).map((a: any) => (
                          <tr key={a.id} className="border-b border-white/[0.03] text-zinc-400">
                            <td className="py-1.5 text-zinc-300">{(a as any).tenants?.tenant_name || a.shop_number}</td>
                            <td className="py-1.5 text-right">R{a.previous_monthly_charge.toFixed(2)}</td>
                            <td className="py-1.5 text-right text-amber-400">+R{a.monthly_increase.toFixed(2)}</td>
                            <td className="py-1.5 text-right text-white">R{a.new_monthly_charge.toFixed(2)}</td>
                            <td className="py-1.5 text-right">R{a.back_charge_amount.toFixed(2)}</td>
                            <td className="py-1.5 text-right">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => handleGenerateProof(a.id)} className="text-[10px] text-zinc-500 hover:text-white">Proof</button>
                                <button onClick={() => alert('Email coming soon')} className="text-[10px] text-zinc-500 hover:text-white">Email</button>
                                <button onClick={() => window.print()} className="text-[10px] text-zinc-500 hover:text-white">PDF</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Evidence */}
                    {documents.length > 0 && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Supporting Evidence</p>
                        <div className="space-y-1">
                          {documents.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between py-1 text-[11px]">
                              <span className="text-zinc-400">{doc.document_type}: {doc.file_name}</span>
                              <span className={doc.tenant_visible ? 'text-emerald-500' : 'text-zinc-600'}>
                                {doc.tenant_visible ? 'Included' : 'Not Included'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* PROOF MODAL */}
      {proofHTML && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => { setProofHTML(''); setSelectedAllocation(null); }} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-white font-light">Tenant Proof — {selectedAllocation?.tenant_name}</p>
                <div className="flex gap-3">
                  <button onClick={() => alert('Email coming soon')} className="text-[11px] text-zinc-400 hover:text-white">Email</button>
                  <button onClick={() => window.print()} className="text-[11px] text-zinc-400 hover:text-white">Print</button>
                  <button onClick={() => { setProofHTML(''); setSelectedAllocation(null); }} className="text-zinc-500 hover:text-white">✕</button>
                </div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: proofHTML }} className="bg-white rounded-lg overflow-hidden" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
