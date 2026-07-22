'use client';
export default function ChargeCodesPage() {
  const codes = [
    { code: 'RENT', name: 'Base Rental', category: 'rent', gl: '4100', vat: 'STD' },
    { code: 'PARK', name: 'Parking', category: 'parking', gl: '4100', vat: 'STD' },
    { code: 'STOR', name: 'Storage', category: 'storage', gl: '4100', vat: 'STD' },
    { code: 'UTIL', name: 'Utilities Recovery', category: 'recovery', gl: '4200', vat: 'STD' },
    { code: 'RATE', name: 'Rates Recovery', category: 'recovery', gl: '4200', vat: 'STD' },
    { code: 'SEC', name: 'Security Levy', category: 'levy', gl: '4200', vat: 'STD' },
    { code: 'MKTG', name: 'Marketing Levy', category: 'levy', gl: '4200', vat: 'STD' },
    { code: 'PEN', name: 'Penalty', category: 'penalty', gl: '4400', vat: 'STD' },
  ];
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Charge Codes</h1><p className="text-sm text-zinc-500 mt-1">Billable items used across leases, billing rules, and manual charges.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Code</button></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Category</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">GL Account</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th></tr></thead>
          <tbody>{codes.map(c => (<tr key={c.code} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-zinc-400 text-xs font-mono">{c.code}</td><td className="py-2.5 px-4 text-white font-light">{c.name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{c.category}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{c.gl}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{c.vat}</td></tr>))}</tbody></table>
      </div>
    </div>
  );
}
