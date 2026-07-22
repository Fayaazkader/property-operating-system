'use client';
export default function LeaseTemplatesPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Lease Templates</h1><p className="text-sm text-zinc-500 mt-1">Pre-configured lease templates with default terms.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ New Template</button></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center"><p className="text-sm text-zinc-500">No lease templates yet. Create templates with default billing rules, escalation rates, and deposit requirements.</p></div>
    </div>
  );
}
