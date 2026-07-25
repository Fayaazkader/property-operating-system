'use client';
export default function WebhooksPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Webhooks</h1><p className="text-sm text-zinc-500 mt-1">Configure webhooks for real-time event notifications.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-zinc-200">+ Add Webhook</button></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center"><p className="text-sm text-zinc-500">No webhooks configured yet.</p></div>
    </div>
  );
}
