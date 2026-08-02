'use client';

import Link from 'next/link';
import { Lock, FileText, PenLine, Send, Users, Shield } from 'lucide-react';

export default function DocumentSigningProPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/signatures" className="text-sm text-zinc-500 hover:text-white">← Lease Execution</Link>
        <Lock className="w-4 h-4 text-amber-400" />
      </div>

      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
          <PenLine className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-light text-white">Document Signing Pro</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          Sign any document — NDAs, sale agreements, employment contracts, supplier agreements, and more.
        </p>

        <div className="mt-10 grid gap-4 max-w-lg mx-auto text-left">
          {[
            { icon: FileText, title: 'Unlimited Documents', desc: 'Upload and sign any PDF document.' },
            { icon: PenLine, title: 'Custom Field Placement', desc: 'Place signature, initial, date, and text fields anywhere.' },
            { icon: Send, title: 'Send for Signing', desc: 'Send documents to multiple recipients for signature.' },
            { icon: Users, title: 'Unlimited Signers', desc: 'Add as many signers as you need.' },
            { icon: Shield, title: 'Audit Trail', desc: 'Every signature is certified and auditable.' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
              <f.icon className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">{f.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <button className="rounded-lg bg-amber-500 px-8 py-3 text-sm font-medium text-black hover:bg-amber-400 transition-all">
            Upgrade to Pro
          </button>
          <p className="text-xs text-zinc-600 mt-3">Coming soon. Contact us for early access.</p>
        </div>
      </div>
    </div>
  );
}
