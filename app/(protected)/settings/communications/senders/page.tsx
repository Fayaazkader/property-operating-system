'use client';
import { useState } from 'react';

const SENDERS = [
  { name: 'AssetFlow Email', type: 'Email', address: 'hello@assetflow.africa', provider: 'SendGrid', status: 'active' },
  { name: 'AssetFlow WhatsApp', type: 'WhatsApp', address: '+27123456789', provider: 'Twilio', status: 'pending' },
];

export default function SenderAccountsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Sender Accounts</h1><p className="text-sm text-zinc-500 mt-1">Email and WhatsApp sender configurations.</p></div>
      <div className="space-y-2">
        {SENDERS.map(s => (
          <div key={s.name} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 flex items-center justify-between">
            <div><p className="text-sm text-white font-light">{s.name}</p><p className="text-xs text-zinc-500">{s.address} · {s.provider}</p></div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
