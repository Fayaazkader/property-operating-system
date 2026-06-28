
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const [betaEmail, setBetaEmail] = useState('');
  const [betaCompany, setBetaCompany] = useState('');
  const [betaPortfolio, setBetaPortfolio] = useState('');
  const [betaSystem, setBetaSystem] = useState('');
  const [betaHeadache, setBetaHeadache] = useState('');
  const [betaSubmitted, setBetaSubmitted] = useState(false);

  const handleBetaSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/beta_waitlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
    body: JSON.stringify({
      name: betaEmail.split('@')[0] || "Unknown",
      company_name: betaCompany,
      email: betaEmail,
      portfolio_size: betaPortfolio,
      pain_point: betaHeadache,
      status: "new",
    }),
  });

  console.log("Status:", res.status);
  
  if (res.ok) {
    setBetaSubmitted(true);
  } else {
    try {
      const data = await res.json();
      console.error("Insert failed:", data);
    } catch {
      console.error("Insert failed with status:", res.status);
    }
  }
};

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <h1 className="text-xl font-bold tracking-tight text-white">AssetFlow</h1>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-400 transition-colors hover:text-white">
              Sign In
            </Link>
            <a
              href="#beta"
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
            >
              Request Access
            </a>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* HERO */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20 md:pt-40">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Morning Brief</p>

            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Good Morning.
              <br />
              <span className="text-gray-400">Your portfolio is talking.</span>
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-lg text-gray-400 md:text-xl">
              <span className="flex items-center gap-2">
                <span className="text-emerald-400">R127,000</span>
                <span className="text-sm text-gray-500">unallocated</span>
              </span>
              <span className="hidden h-4 w-px bg-gray-700 md:block" />
              <span className="flex items-center gap-2">
                <span className="text-amber-400">3</span>
                <span className="text-sm text-gray-500">leases expiring</span>
              </span>
              <span className="hidden h-4 w-px bg-gray-700 md:block" />
              <span className="flex items-center gap-2">
                <span className="text-blue-400">1</span>
                <span className="text-sm text-gray-500">vacancy</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="#beta"
                className="rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black transition hover:bg-white/90"
              >
                See Your Portfolio →
              </a>
              <Link
                href="/login"
                className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-medium text-white transition hover:border-white/30"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* REAL SCREENSHOT — Replace src with actual screenshot */}
          <div className="mt-16 overflow-hidden rounded-2xl border border-white/5 bg-white/5">
            <div className="aspect-[16/9] flex items-center justify-center text-gray-600">
              <span className="text-sm">Morning Brief · Screenshot</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* THE INSIGHT */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-2xl font-light leading-relaxed text-gray-400 md:text-3xl">
          This isn't a dashboard.
          <br />
          <span className="text-white">It's your portfolio telling you what to do today.</span>
        </p>
      </section>

      {/* ============================================================ */}
      {/* UNIVERSAL SEARCH */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-10 md:p-14 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Ask Your Portfolio</p>
          <div className="mt-6 space-y-4 text-lg text-gray-400 md:text-xl">
            <p className="text-white">"Show me all leases in Sandton."</p>
            <p className="text-white">"Which tenants are behind on payments?"</p>
            <p className="text-white">"Should I sell this asset?"</p>
          </div>
          <div className="mt-8 rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-gray-500">
            ⌘K — Ask AssetFlow anything
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CASH BOOK PROOF */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-6 py-12 text-center">
        <div className="border-t border-white/5 pt-16">
          <p className="text-4xl font-bold text-white">905</p>
          <p className="mt-1 text-lg text-gray-400">transactions matched automatically</p>
          <p className="mt-2 text-sm text-gray-500">Review the exceptions. Post the rest.</p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTELLIGENCE ENGINES */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Intelligence</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            What your portfolio is trying to tell you.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/5 bg-white/5 p-8 transition hover:border-white/10">
            <div className="text-4xl font-bold text-emerald-400">R47,500</div>
            <p className="mt-2 text-lg font-medium text-white">Missed recoveries found</p>
            <p className="mt-1 text-sm text-gray-400">Before it hits your P&L.</p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5 p-8 transition hover:border-white/10">
            <div className="text-4xl font-bold text-amber-400">5</div>
            <p className="mt-2 text-lg font-medium text-white">Leases expiring soon</p>
            <p className="mt-1 text-sm text-gray-400">Renewal alerts. Revenue at risk.</p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5 p-8 transition hover:border-white/10">
            <div className="text-4xl font-bold text-blue-400">7</div>
            <p className="mt-2 text-lg font-medium text-white">Things need attention</p>
            <p className="mt-1 text-sm text-gray-400">Prioritized. Actionable.</p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PHILOSOPHY */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="border-t border-white/5 pt-16">
          <p className="text-2xl font-light italic text-gray-400 md:text-3xl">
            "Simple on top.
            <br />
            Galaxy beneath."
          </p>
          <div className="mt-6 space-y-2 text-sm text-gray-500">
            <p>Most systems expose complexity.</p>
            <p className="text-white">AssetFlow hides it until you need it.</p>
            <p>The system recommends. <span className="text-white">The human approves.</span></p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* THE STORY */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-2xl px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-gray-400">
          Started as a property administrator.
          <br />
          Worked up to portfolio manager.
          <br />
          Lived the month-end. Lived the reconciliations.
          <br />
          <span className="text-white">Built AssetFlow because the tools never evolved.</span>
        </p>
      </section>

      {/* ============================================================ */}
      {/* BUILT FOR */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Built For</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-300">
          <span>Portfolio Managers</span>
          <span className="text-gray-600">·</span>
          <span>Property Managers</span>
          <span className="text-gray-600">·</span>
          <span>Finance Teams</span>
          <span className="text-gray-600">·</span>
          <span>Managing Agents</span>
          <span className="text-gray-600">·</span>
          <span>Asset Managers</span>
          <span className="text-gray-600">·</span>
          <span>Leasing Teams</span>
        </div>
      </section>

      {/* ============================================================ */}
      {/* BETA FORM */}
      {/* ============================================================ */}
      <section id="beta" className="mx-auto max-w-2xl px-6 py-16 pb-24">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur-sm md:p-12">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Early Access</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Request Beta Access</h2>
            <p className="mt-1 text-sm text-gray-400">Be among the first to use AssetFlow.</p>
          </div>

          {betaSubmitted ? (
            <div className="py-8 text-center">
              <div className="mb-4 text-4xl">✓</div>
              <p className="font-medium text-white">Thank you for your interest.</p>
              <p className="mt-1 text-sm text-gray-400">We'll reach out soon.</p>
            </div>
          ) : (
            <form onSubmit={handleBetaSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Company Name</label>
                <input
                  type="text"
                  value={betaCompany}
                  onChange={(e) => setBetaCompany(e.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30"
                  placeholder="Acme Property Group"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Email</label>
                <input
                  type="email"
                  value={betaEmail}
                  onChange={(e) => setBetaEmail(e.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Portfolio Size</label>
                <select
                  value={betaPortfolio}
                  onChange={(e) => setBetaPortfolio(e.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">Select...</option>
                  <option value="1-50">1-50 properties</option>
                  <option value="51-200">51-200 properties</option>
                  <option value="201-500">201-500 properties</option>
                  <option value="500+">500+ properties</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Current System</label>
                <select
                  value={betaSystem}
                  onChange={(e) => setBetaSystem(e.target.value)}
                  required
                  className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">Select...</option>
                  <option value="mda">MDA</option>
                  <option value="mri">MRI</option>
                  <option value="yardi">Yardi</option>
                  <option value="re-leased">Re-Leased</option>
                  <option value="excel">Excel / Spreadsheets</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">
                  What's your biggest operational headache?
                </label>
                <textarea
                  value={betaHeadache}
                  onChange={(e) => setBetaHeadache(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30"
                  placeholder="Reconciliation, billing, arrears, lease renewals, reporting..."
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-white/90"
              >
                Request Early Access
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER */}
      {/* ============================================================ */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-sm text-gray-500">© 2026 AssetFlow — The Commercial Property Operating System</p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/privacy" className="transition-colors hover:text-white">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-white">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}