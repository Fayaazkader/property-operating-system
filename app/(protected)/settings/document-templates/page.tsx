'use client';
export default function DocumentTemplatesPage() {
  const templates = [
    { name: 'Tax Invoice', type: 'invoice', lastModified: '2026-07-15' },
    { name: 'Statement of Account', type: 'statement', lastModified: '2026-07-15' },
    { name: 'Credit Note', type: 'credit_note', lastModified: '—' },
    { name: 'Receipt', type: 'receipt', lastModified: '—' },
    { name: 'Lease Agreement', type: 'lease', lastModified: '—' },
    { name: 'Offer to Lease', type: 'offer', lastModified: '—' },
    { name: 'Renewal Letter', type: 'renewal', lastModified: '—' },
    { name: 'Deposit Receipt', type: 'deposit', lastModified: '—' },
    { name: 'Letter of Demand', type: 'demand', lastModified: '—' },
    { name: 'Supplier Remittance', type: 'remittance', lastModified: '—' },
    { name: 'Purchase Order', type: 'po', lastModified: '—' },
    { name: 'Inspection Report', type: 'inspection', lastModified: '—' },
  ];
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Document Templates</h1><p className="text-sm text-zinc-500 mt-1">Manage templates for all platform documents.</p></div>
      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.name} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <div><p className="text-sm text-white font-light">{t.name}</p><p className="text-xs text-zinc-500">{t.type.replace(/_/g, ' ')} · Last modified: {t.lastModified}</p></div>
            <button className="text-xs text-zinc-500 hover:text-white">Edit →</button>
          </div>
        ))}
      </div>
    </div>
  );
}
