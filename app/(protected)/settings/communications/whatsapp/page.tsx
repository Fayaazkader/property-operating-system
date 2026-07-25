'use client';
import { useState } from 'react';

const TEMPLATES = [
  { name: 'Invoice Ready', body: 'Your {{period}} invoice for {{property}} is ready. Total: R{{amount}}.', category: 'BILLING' },
  { name: 'Statement Ready', body: 'Your statement for {{period}} is available.', category: 'ACCOUNT_UPDATE' },
  { name: 'Payment Received', body: 'Payment of R{{amount}} received. Ref: {{reference}}. Thank you.', category: 'PAYMENT_UPDATE' },
  { name: 'Lease Reminder', body: 'Your lease at {{property}} expires in {{days}} days.', category: 'MARKETING' },
  { name: 'Maintenance Update', body: 'Work order #{{id}} — {{description}}. Status: {{status}}.', category: 'ALERT' },
];

export default function WhatsAppTemplatesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">WhatsApp Templates</h1><p className="text-sm text-zinc-500 mt-1">Pre-approved message templates for WhatsApp communications.</p></div>
      <div className="space-y-2">
        {TEMPLATES.map(t => (
          <div key={t.name} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelected(t.name)}>
            <div className="flex items-center justify-between"><p className="text-sm text-white font-light">{t.name}</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{t.category}</span></div>
            <p className="text-xs text-zinc-400 mt-1">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
