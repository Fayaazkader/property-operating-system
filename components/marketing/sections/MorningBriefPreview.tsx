'use client';

import Image from 'next/image';
import { FileText, Receipt, Wrench, UserPlus } from 'lucide-react';

export function MorningBriefPreview() {
  const demo = {
    greeting: 'Good morning, Alex.',
    summary: 'Everything is operating normally. 2 items need your attention.',
    kpis: [
      { label: 'Monthly Revenue', value: 'R2,842,000', span: 2 },
      { label: 'Occupancy', value: '94.2%', span: 1 },
      { label: 'Arrears', value: 'R120,000', span: 1 },
      { label: 'Vacancy Cost', value: 'R180,000/mo', span: 1 },
      { label: 'Comms', value: '98%', span: 1 },
    ],
    attention: [
      { text: '3 leases expire within 90 days', detail: 'Combined annual value: R2.1m', level: 'high' },
      { text: 'R120,000 unallocated receipts', detail: 'Requires reconciliation', level: 'medium' },
    ],
    pulse: [
      { label: 'Revenue', trend: 'up', pct: 5.3 },
      { label: 'Occupancy', trend: 'up', pct: 1.2 },
      { label: 'Arrears', trend: 'down', pct: 3.1 },
      { label: 'Vacancy', trend: 'down', pct: 2.0 },
    ],
    activity: [
      { dot: 'emerald', text: 'Payment received — Sandton Office', amount: 'R52,000', date: '15 Jul' },
      { dot: 'blue', text: 'Lease activated — Rosebank Mall', amount: 'R45,000', date: '14 Jul' },
      { dot: 'zinc', text: 'Statement sent to 312 tenants', amount: null, date: '14 Jul' },
    ],
    quickActions: [
      { label: 'Create Invoice', icon: FileText },
      { label: 'Capture Receipt', icon: Receipt },
      { label: 'New Work Order', icon: Wrench },
      { label: 'Add Tenant', icon: UserPlus },
    ],
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 max-w-6xl mx-auto transition-transform duration-500 hover:scale-[1.005]">
      
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <Image src="/logo.png" alt="AssetFlow" width={24} height={24} className="rounded" />
        <div>
          <p className="text-xs font-medium text-white">Morning Brief</p>
          <p className="text-[10px] text-zinc-500 font-light">Today</p>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-5">
        
        {/* Greeting */}
        <div>
          <h3 className="text-3xl font-light text-white tracking-tight">{demo.greeting}</h3>
          <p className="text-sm text-zinc-400 font-light mt-2">{demo.summary}</p>
        </div>

        {/* Search with blinking caret */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center">
          <span className="text-xs text-zinc-500 font-light">Search tenants, leases, statements, receipts…</span>
          <span className="ml-0.5 inline-block h-3.5 w-px bg-zinc-400 animate-[caret_1s_steps(1)_infinite]" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-3">
          {demo.kpis.map((kpi, i) => (
            <div key={i} className={`${kpi.span === 2 ? 'col-span-2' : ''} rounded-xl border border-zinc-800 bg-zinc-900 p-4`}>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{kpi.label}</p>
              <p className="text-2xl font-light tracking-tight text-white">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Don't Forget + Pulse */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Don't Forget</p>
            <div className="space-y-3">
              {demo.attention.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-sm font-medium mt-0.5 ${item.level === 'high' ? 'text-red-400' : 'text-amber-400'}`}>!</span>
                  <div>
                    <p className="text-sm text-white font-light">{item.text}</p>
                    <p className="text-[11px] text-zinc-500 font-light mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Portfolio Pulse</p>
            <div className="space-y-3">
              {demo.pulse.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-zinc-800 last:border-0">
                  <span className="text-[11px] text-zinc-400 font-light">{item.label}</span>
                  <span className={`text-[11px] font-light tabular-nums ${item.trend === 'up' && item.label !== 'Arrears' && item.label !== 'Vacancy' ? 'text-emerald-400' : item.trend === 'down' && (item.label === 'Arrears' || item.label === 'Vacancy') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {item.trend === 'up' ? '▲' : '▼'} {item.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Recent Activity</p>
          <div className="space-y-1">
            {demo.activity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.dot === 'emerald' ? 'bg-emerald-400/50' : item.dot === 'blue' ? 'bg-blue-400/50' : 'bg-zinc-600'}`} />
                  <p className="text-xs text-zinc-300 font-light">{item.text}</p>
                </div>
                <div className="flex items-center gap-4">
                  {item.amount && <span className="text-xs text-zinc-400 font-light tabular-nums">{item.amount}</span>}
                  <span className="text-[10px] text-zinc-500 font-light">{item.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions — non-interactive */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Quick Actions</p>
          <div className="grid grid-cols-4 gap-3">
            {demo.quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center cursor-default">
                  <Icon className="w-4 h-4 text-zinc-500 mx-auto" />
                  <p className="text-[10px] text-zinc-500 font-light mt-1.5">{action.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
