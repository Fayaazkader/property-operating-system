'use client';
import { useState } from 'react';
export default function BrandingPage() {
  const [color, setColor] = useState('#000000');
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Branding</h1>
      <div className="space-y-4">
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Logo</label><div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center"><p className="text-sm text-zinc-500">Upload logo</p></div></div>
        <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Primary Colour</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-10 rounded border border-white/[0.08] bg-zinc-900" /></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
