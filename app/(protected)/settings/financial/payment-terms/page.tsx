'use client';
export default function PaymentTermsPage() {
  const terms = [
    { code: '7DAYS', name: '7 Days', days: 7 },
    { code: '15DAYS', name: '15 Days', days: 15 },
    { code: '30DAYS', name: '30 Days', days: 30 },
    { code: '45DAYS', name: '45 Days', days: 45 },
    { code: '60DAYS', name: '60 Days', days: 60 },
    { code: 'IMMED', name: 'Immediate', days: 0 },
  ];
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Payment Terms</h1><p className="text-sm text-zinc-500 mt-1">Standard payment terms for suppliers and tenants.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Term</button></div>
      <div className="space-y-2">
        {terms.map(t => (
          <div key={t.code} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <div><p className="text-sm text-white font-light">{t.name}</p><p className="text-xs text-zinc-500">Code: {t.code}</p></div>
            <span className="text-sm text-zinc-400 font-light">{t.days} days</span>
          </div>
        ))}
      </div>
    </div>
  );
}
