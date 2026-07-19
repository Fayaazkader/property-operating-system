'use client';
export default function VatPage() {
  const codes = [
    { code: 'standard', desc: 'Standard Rated', rate: '15%' },
    { code: 'zero_rated', desc: 'Zero Rated', rate: '0%' },
    { code: 'exempt', desc: 'Exempt', rate: '0%' },
    { code: 'non_vatable', desc: 'Non-VAT', rate: '0%' },
  ];
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">VAT Codes</h1>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Rate</th></tr></thead>
          <tbody>{codes.map(v => (<tr key={v.code} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{v.code}</td><td className="py-2.5 px-4 text-zinc-400">{v.desc}</td><td className="py-2.5 px-4 text-zinc-400">{v.rate}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
