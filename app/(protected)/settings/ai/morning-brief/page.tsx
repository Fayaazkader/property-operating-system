'use client';
import { useState } from 'react';
export default function MorningBriefConfigPage() {
  const [sections, setSections] = useState({ occupancy: true, revenue: true, arrears: true, leases: true, tasks: true });
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Morning Brief</h1><p className="text-sm text-zinc-500 mt-1">Configure what appears in your daily Morning Brief.</p></div>
      <div className="space-y-3">
        {Object.entries(sections).map(([key, val]) => (
          <label key={key} className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer capitalize">
            <input type="checkbox" checked={val} onChange={(e) => setSections({ ...sections, [key]: e.target.checked })} className="rounded" />{key}
          </label>
        ))}
        <button className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 mt-2">Save</button>
      </div>
    </div>
  );
}
