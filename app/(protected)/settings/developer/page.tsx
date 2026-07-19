'use client';
import { useState } from 'react';
export default function DeveloperPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Developer</h1>
      <div className="space-y-4">
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">API Keys</label><input value="●●●●●●●●●●●●●●●●" readOnly className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Webhook URL</label><input placeholder="https://..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
