'use client';
export default function RevenueCategoriesPage() {
  const cats = ['rental','parking','storage','utility_recovery','rates_recovery','security_levy','marketing_levy','generator_recovery','aircon_recovery','penalty','interest','deposit'];
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Revenue Categories</h1>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Category</th></tr></thead>
          <tbody>{cats.map(c => (<tr key={c} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light capitalize">{c.replace(/_/g,' ')}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
