'use client';

import { useState } from 'react';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';
import Link from 'next/link';

export function ContactPageClient() {
  const [submitted, setSubmitted] = useState(false);
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); setSubmitted(true); }

  return (
    <MarketingLayout>
      <Section id="contact" className="pt-32 md:pt-48 pb-20">
        <Container>
          <div className="max-w-lg mx-auto text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">Contact</p>
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white leading-[1.12]">Book a demo.</h1>
            <p className="mt-4 text-zinc-400 text-sm leading-relaxed">See how AssetFlow connects your entire commercial property portfolio into one intelligent operating system.</p>
            {submitted ? (
              <div className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-8 text-center"><p className="text-sm font-medium text-white">Thank you — your enquiry has been submitted.</p><p className="mt-2 text-xs text-zinc-400">Our team will contact you within one business day.</p></div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-4 text-left">
                <input type="text" placeholder="Full name" required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all" />
                <input type="email" placeholder="Work email" required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all" />
                <input type="text" placeholder="Company" required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all" />
                <select className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all"><option value="">Portfolio size</option><option>1–25 properties</option><option>26–100 properties</option><option>101–250 properties</option><option>251–500 properties</option><option>500+ properties</option></select>
                <textarea rows={3} placeholder="Tell us about your portfolio and what you're looking for" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all" />
                <button type="submit" className="w-full rounded-full border border-amber-500/50 px-8 py-4 text-sm font-medium text-white hover:bg-amber-500 hover:text-black transition-all duration-300">Submit Enquiry</button>
              </form>
            )}
            <p className="mt-6 text-xs text-zinc-600">Or email us at <Link href="mailto:hello@assetflow.africa" className="text-zinc-400 hover:text-white transition-colors">hello@assetflow.africa</Link></p>
          </div>
        </Container>
      </Section>
    </MarketingLayout>
  );
}
