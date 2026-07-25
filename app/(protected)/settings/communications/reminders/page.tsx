'use client';
import { useState } from 'react';

const RULES = [
  { event: 'Invoice Due', timing: '3 days before due', channel: 'Email + WhatsApp', enabled: true },
  { event: 'Invoice Overdue', timing: '1 day after due', channel: 'WhatsApp', enabled: true },
  { event: 'Invoice Overdue', timing: '7 days after due', channel: 'Email + WhatsApp', enabled: true },
  { event: 'Lease Expiring', timing: '90 days before expiry', channel: 'Email', enabled: true },
  { event: 'Lease Expiring', timing: '30 days before expiry', channel: 'Email + WhatsApp', enabled: true },
  { event: 'Deposit Refund Due', timing: '14 days after lease end', channel: 'Email', enabled: false },
];

export default function ReminderRulesPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Reminder Rules</h1><p className="text-sm text-zinc-500 mt-1">Automated reminders for invoices, leases, and deposits.</p></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Event</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Timing</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Channel</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Active</th></tr></thead>
          <tbody>{RULES.map(r => (<tr key={`${r.event}-${r.timing}`} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{r.event}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.timing}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.channel}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{r.enabled ? 'On' : 'Off'}</span></td></tr>))}</tbody></table>
      </div>
    </div>
  );
}
