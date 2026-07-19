'use client';
import { useState } from 'react';
export default function GeneralSettings() {
  const [form, setForm] = useState({ platform_name: 'AssetFlow', timezone: 'Africa/Johannesburg', currency: 'ZAR', date_format: 'DD/MM/YYYY' });
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">General Settings</h1>
      <div className="space-y-4">
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Platform Name</label><input value={form.platform_name} onChange={(e) => setForm({...form, platform_name: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Timezone</label><select value={form.timezone} onChange={(e) => setForm({...form, timezone: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option>Africa/Johannesburg</option><option>Africa/Nairobi</option><option>Africa/Lagos</option></select></div>
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Currency</label><select value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option></select></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
