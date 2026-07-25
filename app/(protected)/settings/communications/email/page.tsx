'use client';
import { useState } from 'react';

const TEMPLATES = [
  { name: 'Invoice Ready', subject: 'Your {{period}} invoice from {{company}}', description: 'Sent when a new invoice is generated' },
  { name: 'Statement Ready', subject: 'Your statement for {{period}}', description: 'Sent when a statement is available' },
  { name: 'Payment Received', subject: 'Payment of {{amount}} received — Thank you', description: 'Sent when a payment is allocated' },
  { name: 'Lease Expiring', subject: 'Your lease expires in {{days}} days', description: 'Sent when a lease is approaching expiry' },
  { name: 'Welcome', subject: 'Welcome to {{company}}', description: 'Sent when a new tenant is added' },
];

export default function EmailTemplatesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Email Templates</h1><p className="text-sm text-zinc-500 mt-1">Manage email templates used for tenant communications.</p></div>
      <div className="space-y-2">
        {TEMPLATES.map(t => (
          <div key={t.name} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelected(t.name)}>
            <div className="flex items-center justify-between"><p className="text-sm text-white font-light">{t.name}</p><span className="text-[10px] text-zinc-600">Email</span></div>
            <p className="text-xs text-zinc-500 mt-1">{t.subject}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{t.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
