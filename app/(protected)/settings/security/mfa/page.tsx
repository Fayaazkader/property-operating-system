'use client';
import { useState } from 'react';

export default function MFAPage() {
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Multi-Factor Authentication</h1><p className="text-sm text-zinc-500 mt-1">Require MFA for all users or specific roles.</p></div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded" />
          Require MFA for all users
        </label>
        <p className="text-xs text-zinc-600">When enabled, all users must set up an authenticator app before accessing the platform.</p>
        <button className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200">Save</button>
      </div>
    </div>
  );
}
