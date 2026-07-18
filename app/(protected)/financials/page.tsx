'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { financialApi } from '@/lib/financial/api';

type Section = 'overview' | 'trial-balance' | 'income-statement' | 'journals' | 'vat' | 'close';

export default function FinancialWorkspacePage() {
  const [section, setSection] = useState<Section>('overview');
  const [entityId, setEntityId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: entities } = await supabase.rpc('auth_entities');
        if (!entities?.length) { setLoading(false); return; }
        setEntityId(entities[0]);
        try {
          const per = await financialApi.periods({ entityId: entities[0] });
          setPeriods(per || []);
          if (per?.length) setPeriodId(per[0].id);
        } catch { setPeriods([]); }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!entityId || !periodId) return;
    loadSection();
  }, [entityId, periodId, section]);

  async function loadSection() {
    setLoading(true);
    setError('');
    const d: any = {};
    try {
      switch (section) {
        case 'overview':
          d.trialBalance = await financialApi.trialBalance({ entityId, periodId }).catch(() => null);
          d.closeData = await financialApi.closeStatus({ entityId, periodId }).catch(() => null);
          break;
        case 'trial-balance':
          d.trialBalance = await financialApi.trialBalance({ entityId, periodId }).catch(() => null);
          break;
        case 'income-statement':
          d.incomeStatement = await financialApi.incomeStatement({ entityId, periodId }).catch(() => null);
          break;
        case 'journals':
          d.journals = await financialApi.journals({ entityId, periodId }).catch(() => ({ journals: [], total: 0 }));
          break;
        case 'vat':
          d.vatData = await financialApi.vatReturn({ entityId, periodId }).catch(() => null);
          break;
        case 'close':
          d.closeData = await financialApi.closeStatus({ entityId, periodId }).catch(() => null);
          break;
      }
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    }
    setLoading(false);
  }

  const selectedPeriod = periods.find(p => p.id === periodId);
  const navItems: Array<{ key: Section; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'trial-balance', label: 'Trial Balance' },
    { key: 'income-statement', label: 'Income Statement' },
    { key: 'journals', label: 'Journals' },
    { key: 'vat', label: 'VAT' },
    { key: 'close', label: 'Close Assistant' },
  ];

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-1 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-3">Financials</p>
        {navItems.map(item => (
          <button key={item.key} onClick={() => setSection(item.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-colors ${section === item.key ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
            {periods.length === 0 && <option value="">No periods</option>}
            {periods.map(p => (<option key={p.id} value={p.id}>{p.period_name} — {p.status}</option>))}
          </select>
          {selectedPeriod && <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedPeriod.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{selectedPeriod.status}</span>}
        </div>

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mb-6"><p className="text-sm text-red-400">{error}</p></div>}
        {loading && <p className="text-sm text-zinc-500 font-light">Loading...</p>}

        {!loading && !error && (
          <>
            {section === 'overview' && <OverviewPanel trialBalance={data.trialBalance} closeData={data.closeData} />}
            {section === 'trial-balance' && <TrialBalancePanel data={data.trialBalance} />}
            {section === 'income-statement' && <IncomeStatementPanel data={data.incomeStatement} />}
            {section === 'journals' && <JournalsPanel data={data.journals} />}
            {section === 'vat' && <VatPanel data={data.vatData} entityId={entityId} periodId={periodId} onUpdate={(d: any) => setData((p: any) => ({ ...p, vatData: d }))} />}
            {section === 'close' && <ClosePanel data={data.closeData} />}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-12 text-center">
      <p className="text-sm text-zinc-400 font-light">{message}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

function OverviewPanel({ trialBalance, closeData }: any) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Trial Balance</p>
          <p className={`text-xl font-light ${trialBalance?.balanced ? 'text-emerald-400' : trialBalance ? 'text-red-400' : 'text-zinc-500'}`}>{trialBalance ? (trialBalance.balanced ? 'Balanced' : 'Unbalanced') : 'No data'}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Integrity</p>
          <p className="text-xl font-light text-white">{closeData?.integrity_score?.percentage || 0}%</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Critical</p>
          <p className={`text-xl font-light ${!closeData || closeData.critical_count === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{closeData?.critical_count || 0}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Can Close</p>
          <p className={`text-xl font-light ${closeData?.can_close ? 'text-emerald-400' : 'text-amber-400'}`}>{closeData?.can_close ? 'Yes' : 'Not yet'}</p>
        </div>
      </div>
    </div>
  );
}

function TrialBalancePanel({ data }: any) {
  if (!data || !data.rows || data.rows.length === 0) return <EmptyState message="No data for this period." sub="Post journals to see your trial balance." />;
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Account</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th></tr></thead>
        <tbody>{data.rows.map((row: any, i: number) => (<tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01]"><td className="py-2.5 px-4 text-zinc-500 font-light text-xs">{row.gl_code}</td><td className="py-2.5 px-4 text-white font-light">{row.account_name}</td><td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{row.total_debits.toLocaleString()}</td><td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{row.total_credits.toLocaleString()}</td></tr>))}</tbody>
        <tfoot><tr className="bg-white/[0.02]"><td colSpan={2} className="py-3 px-4 text-zinc-400 text-[11px] uppercase">Totals</td><td className="py-3 px-4 text-right text-white font-medium tabular-nums">R{data.totalDr.toLocaleString()}</td><td className="py-3 px-4 text-right text-white font-medium tabular-nums">R{data.totalCr.toLocaleString()}</td></tr></tfoot>
      </table>
      <div className="px-4 py-2 border-t border-white/[0.06]"><span className={`text-[11px] ${data.balanced ? 'text-emerald-400' : 'text-red-400'}`}>{data.balanced ? '✓ Balanced' : '✗ Out of balance'}</span></div>
    </div>
  );
}

function IncomeStatementPanel({ data }: any) {
  if (!data || !data.revenue || data.revenue.length === 0) return <EmptyState message="No data for this period." sub="Post revenue and expense journals to see your income statement." />;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] overflow-hidden"><div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Revenue</p></div>{data.revenue.map((r: any, i: number) => (<div key={i} className="flex justify-between px-5 py-2.5 border-b border-white/[0.03]"><span className="text-sm text-zinc-300 font-light">{r.account}</span><span className="text-sm text-white font-light tabular-nums">R{r.amount.toLocaleString()}</span></div>))}<div className="flex justify-between px-5 py-3 bg-white/[0.01]"><span className="text-sm text-white font-medium">Total Revenue</span><span className="text-sm text-emerald-400 font-medium">R{data.total_revenue.toLocaleString()}</span></div></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden"><div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Expenses</p></div>{data.expenses.map((e: any, i: number) => (<div key={i} className="flex justify-between px-5 py-2.5 border-b border-white/[0.03]"><span className="text-sm text-zinc-300 font-light">{e.account}</span><span className="text-sm text-white font-light tabular-nums">R{e.amount.toLocaleString()}</span></div>))}<div className="flex justify-between px-5 py-3 bg-white/[0.01]"><span className="text-sm text-white font-medium">Total Expenses</span><span className="text-sm text-red-400 font-medium">R{data.total_expenses.toLocaleString()}</span></div></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex justify-between"><span className="text-sm font-medium text-white">Net Income</span><span className={`text-lg font-light ${data.net_income >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R{data.net_income.toLocaleString()}</span></div>
    </div>
  );
}

function JournalsPanel({ data }: any) {
  const [selectedJournal, setSelectedJournal] = useState<any>(null);
  if (!data || !data.journals || data.journals.length === 0) return <EmptyState message="No journals for this period." sub="Post transactions to see your journals." />;
  return (
    <>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Number</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>{data.journals.map((j: any) => (<tr key={j.id} onClick={async () => { const d = await financialApi.journalDetail({ journalId: j.id }).catch(() => null); setSelectedJournal(d); }} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"><td className="py-2.5 px-4 text-zinc-400 font-light text-xs">{j.journal_number}</td><td className="py-2.5 px-4 text-white font-light">{j.description}</td><td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{(j.total_debits || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{(j.total_credits || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${j.is_posted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{j.is_posted ? 'Posted' : 'Pending'}</span></td></tr>))}</tbody>
        </table>
      </div>
      {selectedJournal && <JournalDrawer journal={selectedJournal} onClose={() => setSelectedJournal(null)} />}
    </>
  );
}

function JournalDrawer({ journal, onClose }: any) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[480px] z-50 bg-zinc-950 border-l border-white/[0.08] shadow-2xl overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6"><div><p className="text-sm font-medium text-white">{journal.journal_number}</p><p className="text-xs text-zinc-500 mt-0.5">{journal.description}</p></div><button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button></div>
          <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 text-[10px] text-zinc-500 uppercase">Account</th><th className="text-right py-2 text-[10px] text-zinc-500 uppercase">Debit</th><th className="text-right py-2 text-[10px] text-zinc-500 uppercase">Credit</th></tr></thead><tbody>{(journal.lines || []).map((line: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2 text-zinc-300 font-light text-xs">{line.description}</td><td className="py-2 text-right text-zinc-300 font-light tabular-nums">R{(line.debit_amount || 0).toLocaleString()}</td><td className="py-2 text-right text-zinc-300 font-light tabular-nums">R{(line.credit_amount || 0).toLocaleString()}</td></tr>))}</tbody></table>
        </div>
      </div>
    </>
  );
}

function VatPanel({ data, entityId, periodId, onUpdate }: any) {
  async function handleCalculate() {
    const result = await financialApi.calculateVat({ entityId, periodId }).catch(() => null);
    if (result) onUpdate(result);
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-12 text-center">
        <p className="text-sm text-zinc-400 font-light">VAT not yet calculated for this period.</p>
        <button onClick={handleCalculate} className="mt-4 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">Calculate VAT</button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Output VAT</p><p className="text-2xl font-light text-white">R{data.output_vat.toLocaleString()}</p></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Input VAT</p><p className="text-2xl font-light text-white">R{data.input_vat.toLocaleString()}</p></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Net VAT</p><p className={`text-2xl font-light ${data.net_vat >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>R{Math.abs(data.net_vat).toLocaleString()}<span className="text-xs ml-1">{data.net_vat >= 0 ? 'payable' : 'refundable'}</span></p></div>
    </div>
  );
}

function ClosePanel({ data }: any) {
  if (!data) return <EmptyState message="Unable to load close status." />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Integrity</p><p className="text-xl font-light text-white">{data.integrity_score?.percentage || 0}%</p></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Critical</p><p className={`text-xl font-light ${data.critical_count === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.critical_count}</p></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Warnings</p><p className="text-xl font-light text-amber-400">{data.warning_count}</p></div>
      </div>
      {data.checklist?.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Close Checklist</p></div>
          {data.checklist.map((item: any) => (<div key={item.id} className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]"><span className="text-sm text-zinc-300 font-light">{item.item}</span><span className={`text-[10px] ${item.status === 'pending' ? 'text-zinc-500' : 'text-emerald-400'}`}>{item.status === 'pending' ? '○' : '✓'}</span></div>))}
        </div>
      )}
    </div>
  );
}
