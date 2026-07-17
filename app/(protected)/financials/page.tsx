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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    async function init() {
      try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      let per: any[] = [];
      try {
        per = await financialApi.periods({ entityId: entities[0] });
      } catch (e) {
        console.warn("No financial periods for entity, using defaults");
        per = [];
      }
      setPeriods(per);
      if (per?.length) setPeriodId(per[0].id);
      } catch (err) {
        console.error("Financials init error:", err);
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!entityId || !periodId) return;
    loadSection();
  }, [entityId, periodId, section]);

  async function loadSection() {
    try {
    setLoading(true);
    const d: any = {};
    switch (section) {
      case 'overview':
        const [tb, cs] = await Promise.all([
          financialApi.trialBalance({ entityId, periodId }),
          financialApi.closeStatus({ entityId, periodId }),
        ]);
        d.trialBalance = tb;
        d.closeData = cs;
        break;
      case 'trial-balance':
        d.trialBalance = await financialApi.trialBalance({ entityId, periodId });
        break;
      case 'income-statement':
        d.incomeStatement = await financialApi.incomeStatement({ entityId, periodId });
        break;
      case 'journals':
        d.journals = await financialApi.journals({ entityId, periodId });
        break;
      case 'vat':
        d.vatData = await financialApi.vatReturn({ entityId, periodId });
        break;
      case 'close':
        d.closeData = await financialApi.closeStatus({ entityId, periodId });
        break;
    }
    setData(d);
    } catch (err) {
      console.error("Load section error:", err);
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
      {/* Left Nav */}
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-1 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-3">Financials</p>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-colors ${
              section === item.key ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none">
            {periods.map(p => (<option key={p.id} value={p.id}>{p.period_name} — {p.status}</option>))}
          </select>
          {selectedPeriod && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${selectedPeriod.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {selectedPeriod.status}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-zinc-500 font-light">Loading...</p>}

        {!loading && section === 'overview' && <OverviewPanel data={data} />}
        {!loading && section === 'trial-balance' && <TrialBalancePanel data={data.trialBalance} />}
        {!loading && section === 'income-statement' && <IncomeStatementPanel data={data.incomeStatement} />}
        {!loading && section === 'journals' && <JournalsPanel data={data.journals} entityId={entityId} periodId={periodId} />}
        {!loading && section === 'vat' && <VatPanel data={data.vatData} entityId={entityId} periodId={periodId} setData={setData} />}
        {!loading && section === 'close' && <ClosePanel data={data.closeData} />}
      </div>
    </div>
  );
}

function OverviewPanel({ data }: any) {
  const { trialBalance, closeData } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Trial Balance" value={trialBalance?.balanced ? 'Balanced' : 'Out of balance'} color={trialBalance?.balanced ? 'emerald' : 'red'} />
        <MetricCard label="Integrity Score" value={`${closeData?.integrity_score?.percentage || 0}%`} color="white" />
        <MetricCard label="Critical Items" value={closeData?.critical_count || 0} color={closeData?.critical_count === 0 ? 'emerald' : 'red'} />
        <MetricCard label="Can Close" value={closeData?.can_close ? 'Yes' : 'Not yet'} color={closeData?.can_close ? 'emerald' : 'amber'} />
      </div>
      {closeData?.checklist && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[11px] font-medium text-zinc-500 uppercase">Close Checklist</p>
          </div>
          {closeData.checklist.slice(0, 8).map((item: any) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-2 border-b border-white/[0.03]">
              <span className="text-sm text-zinc-300 font-light">{item.item}</span>
              <span className={`text-[10px] ${item.status === 'pending' ? 'text-zinc-500' : 'text-emerald-400'}`}>{item.status === 'pending' ? '○' : '✓'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: any) {
  const colors: any = { emerald: 'text-emerald-400', red: 'text-red-400', amber: 'text-amber-400', white: 'text-white' };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p>
      <p className={`text-xl font-light ${colors[color]}`}>{value}</p>
    </div>
  );
}

function TrialBalancePanel({ data }: any) {
  if (!data) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Account</th>
            <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th>
            <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row: any, i: number) => (
            <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
              <td className="py-2.5 px-4 text-zinc-500 font-light text-xs">{row.gl_code}</td>
              <td className="py-2.5 px-4 text-white font-light">{row.account_name}</td>
              <td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{row.total_debits.toLocaleString()}</td>
              <td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{row.total_credits.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-white/[0.02]">
            <td colSpan={2} className="py-3 px-4 text-zinc-400 text-[11px] uppercase">Totals</td>
            <td className="py-3 px-4 text-right text-white font-medium tabular-nums">R{data.totalDr.toLocaleString()}</td>
            <td className="py-3 px-4 text-right text-white font-medium tabular-nums">R{data.totalCr.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      <div className="px-4 py-2 border-t border-white/[0.06]">
        <span className={`text-[11px] ${data.balanced ? 'text-emerald-400' : 'text-red-400'}`}>{data.balanced ? '✓ Balanced' : '✗ Out of balance'}</span>
      </div>
    </div>
  );
}

function IncomeStatementPanel({ data }: any) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Revenue</p></div>
        {data.revenue.map((r: any, i: number) => (
          <div key={i} className="flex justify-between px-5 py-2.5 border-b border-white/[0.03]"><span className="text-sm text-zinc-300 font-light">{r.account}</span><span className="text-sm text-white font-light tabular-nums">R{r.amount.toLocaleString()}</span></div>
        ))}
        <div className="flex justify-between px-5 py-3 bg-white/[0.01]"><span className="text-sm text-white font-medium">Total Revenue</span><span className="text-sm text-emerald-400 font-medium">R{data.total_revenue.toLocaleString()}</span></div>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Expenses</p></div>
        {data.expenses.map((e: any, i: number) => (
          <div key={i} className="flex justify-between px-5 py-2.5 border-b border-white/[0.03]"><span className="text-sm text-zinc-300 font-light">{e.account}</span><span className="text-sm text-white font-light tabular-nums">R{e.amount.toLocaleString()}</span></div>
        ))}
        <div className="flex justify-between px-5 py-3 bg-white/[0.01]"><span className="text-sm text-white font-medium">Total Expenses</span><span className="text-sm text-red-400 font-medium">R{data.total_expenses.toLocaleString()}</span></div>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex justify-between">
        <span className="text-sm font-medium text-white">Net Income</span>
        <span className={`text-lg font-light ${data.net_income >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R{data.net_income.toLocaleString()}</span>
      </div>
    </div>
  );
}

function JournalsPanel({ data, entityId, periodId }: any) {
  const [selectedJournal, setSelectedJournal] = useState<any>(null);
  if (!data) return null;

  return (
    <>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Number</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th>
              <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th>
              <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th>
              <th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.journals.map((j: any) => (
              <tr key={j.id} onClick={async () => setSelectedJournal(await financialApi.journalDetail({ journalId: j.id }))} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer">
                <td className="py-2.5 px-4 text-zinc-400 font-light text-xs">{j.journal_number}</td>
                <td className="py-2.5 px-4 text-white font-light">{j.description}</td>
                <td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{(j.total_debits || 0).toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right text-zinc-300 font-light tabular-nums">R{(j.total_credits || 0).toLocaleString()}</td>
                <td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${j.is_posted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{j.is_posted ? 'Posted' : 'Pending'}</span></td>
              </tr>
            ))}
          </tbody>
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
          <div className="flex justify-between items-center mb-6">
            <div><p className="text-sm font-medium text-white">{journal.journal_number}</p><p className="text-xs text-zinc-500 mt-0.5">{journal.description}</p></div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 text-[10px] text-zinc-500 uppercase">Account</th><th className="text-right py-2 text-[10px] text-zinc-500 uppercase">Debit</th><th className="text-right py-2 text-[10px] text-zinc-500 uppercase">Credit</th></tr></thead>
            <tbody>{(journal.lines || []).map((line: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2 text-zinc-300 font-light text-xs">{line.description}</td><td className="py-2 text-right text-zinc-300 font-light tabular-nums">R{(line.debit_amount || 0).toLocaleString()}</td><td className="py-2 text-right text-zinc-300 font-light tabular-nums">R{(line.credit_amount || 0).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function VatPanel({ data, entityId, periodId, setData }: any) {
  async function handleCalculate() {
    const result = await financialApi.calculateVat({ entityId, periodId });
    setData((prev: any) => ({ ...prev, vatData: result }));
  }

  return (
    <div>
      {!data ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center">
          <p className="text-sm text-zinc-500 font-light">VAT not yet calculated.</p>
          <button onClick={handleCalculate} className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Calculate VAT</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Output VAT</p><p className="text-2xl font-light text-white">R{data.output_vat.toLocaleString()}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Input VAT</p><p className="text-2xl font-light text-white">R{data.input_vat.toLocaleString()}</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Net VAT</p><p className={`text-2xl font-light ${data.net_vat >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>R{Math.abs(data.net_vat).toLocaleString()}<span className="text-xs ml-1">{data.net_vat >= 0 ? 'payable' : 'refundable'}</span></p></div>
        </div>
      )}
    </div>
  );
}

function ClosePanel({ data }: any) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Integrity Score" value={`${data.integrity_score?.percentage || 0}%`} color="white" />
        <MetricCard label="Critical" value={data.critical_count || 0} color={data.critical_count === 0 ? 'emerald' : 'red'} />
        <MetricCard label="Warnings" value={data.warning_count || 0} color="amber" />
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Close Checklist</p></div>
        {data.checklist.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.03]">
            <span className="text-sm text-zinc-300 font-light">{item.item}</span>
            <span className={`text-[10px] ${item.status === 'pending' ? 'text-zinc-500' : 'text-emerald-400'}`}>{item.status === 'pending' ? '○' : '✓'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
