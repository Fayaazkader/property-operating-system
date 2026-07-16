'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [betaEmail, setBetaEmail] = useState('');
  const [betaCompany, setBetaCompany] = useState('');
  const [betaPortfolio, setBetaPortfolio] = useState('');
  const [betaSubmitted, setBetaSubmitted] = useState(false);

  const handleBetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/beta_waitlist`, {
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
          status: "new",
        }),
      });
      setBetaSubmitted(true);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-white">
      
      {/* NAV */}
      <nav className="fixed top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">AssetFlow</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <a href="#beta" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-all">Request Access</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20 md:pt-44">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-6">Commercial Property Operating System</p>
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Commercial property.
            <br />
            <span className="text-gray-400">Finally connected.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300 leading-relaxed">
            One platform for leases, billing, cash books, financials, and operations. Everything working as one.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="#beta" className="rounded-full bg-white px-8 py-4 text-sm font-medium text-black hover:bg-gray-100 transition-all">Request Early Access</a>
            <Link href="/login" className="rounded-full border border-white/20 px-8 py-4 text-sm font-medium text-white hover:border-white/40 transition-all">Sign In</Link>
          </div>
        </div>

        {/* Preview */}
        <div className="relative mx-auto mt-16 max-w-6xl">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
              </div>
              <span className="text-xs text-gray-400 ml-3">Morning Brief — Today</span>
            </div>
            <div className="p-10 md:p-14">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Occupancy</p>
                  <p className="text-5xl font-bold text-white">94<span className="text-emerald-400 text-xl">%</span></p>
                  <p className="text-sm text-gray-400 mt-1">Across 247 properties</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Collected Today</p>
                  <p className="text-5xl font-bold text-white">R842<span className="text-gray-500 text-xl">k</span></p>
                  <p className="text-sm text-gray-400 mt-1">From 312 tenants</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Needs Attention</p>
                  <p className="text-5xl font-bold text-amber-400">3</p>
                  <p className="text-sm text-gray-400 mt-1">Leases expire within 90 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">The Problem</p>
          <h2 className="mt-3 text-3xl font-bold md:text-5xl">Your team works in five different systems.</h2>
          <p className="mt-3 text-gray-400">That's five places for things to go wrong.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Leasing", tool: "Spreadsheets" },
            { label: "Billing", tool: "MRI / MDA" },
            { label: "Payments", tool: "Bank Portal" },
            { label: "Reports", tool: "Built manually" },
            { label: "Tenants", tool: "WhatsApp" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">{card.label}</p>
              <p className="text-lg text-white mt-2 font-medium">{card.tool}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <p className="text-xl text-white font-semibold">What if it all worked as one?</p>
        </div>
      </section>

      {/* MORNING BRIEF */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Your Morning</p>
          <h2 className="mt-3 text-3xl font-bold md:text-5xl">
            Good morning.
            <br />
            <span className="text-gray-400">Your portfolio is talking.</span>
          </h2>
          <p className="mt-3 text-gray-400 max-w-lg">Every day starts with clarity. Not a dashboard. Just what needs attention.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="p-10 md:p-14">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-8">Today — 15 July 2027</p>
            <div className="space-y-6">
              <div className="border-l-2 border-l-amber-400 pl-5">
                <p className="text-xs text-gray-500 mb-1">07:00</p>
                <p className="text-lg font-medium text-amber-400">3 leases expire within 90 days</p>
                <p className="text-sm text-gray-400 mt-0.5">Combined annual value: R2.1m</p>
              </div>
              <div className="border-l-2 border-l-white/10 pl-5">
                <p className="text-xs text-gray-500 mb-1">07:00</p>
                <p className="text-lg font-medium text-white">R842,000 collected overnight</p>
                <p className="text-sm text-gray-400 mt-0.5">312 tenants. 3 payments outstanding.</p>
              </div>
              <div className="border-l-2 border-l-white/10 pl-5">
                <p className="text-xs text-gray-500 mb-1">07:01</p>
                <p className="text-lg font-medium text-white">Municipality invoice awaiting approval</p>
                <p className="text-sm text-gray-400 mt-0.5">Rosebank Office Park. R120,000 due 22 July.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ONE WORKFLOW */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">How It Works</p>
          <h2 className="mt-3 text-3xl font-bold md:text-5xl">
            One lease.
            <br />
            <span className="text-gray-400">End to end.</span>
          </h2>
        </div>

        <div className="space-y-8">
          {[
            { step: "1", title: "Lease activated", detail: "Tenant signs. AssetFlow schedules billing, registers the deposit, updates occupancy." },
            { step: "2", title: "Invoice generated", detail: "R115,000 billed automatically. VAT invoice for commercial. Tax-exempt for residential." },
            { step: "3", title: "Payment received", detail: "Tenant pays. Bank import matches the transaction. One click confirms." },
            { step: "4", title: "Supplier paid", detail: "Municipality bill arrives. OCR extracts details. Routed for approval. Paid in next batch." },
            { step: "5", title: "Period closed", detail: "Financial Close Assistant checks everything. Bank reconciled. VAT complete. Period closed." },
          ].map(item => (
            <div key={item.step} className="flex gap-6 py-4 border-b border-white/10 last:border-0">
              <p className="text-sm text-emerald-400 font-bold w-8 flex-shrink-0">{item.step}</p>
              <div>
                <p className="text-lg font-medium text-white">{item.title}</p>
                <p className="text-sm text-gray-400 mt-1">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINANCIAL PLATFORM */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">The Galaxy Beneath</p>
          <h2 className="mt-3 text-3xl font-bold md:text-5xl">
            A complete financial
            <br />
            <span className="text-gray-400">operating system.</span>
          </h2>
          <p className="mt-3 text-gray-400 max-w-lg">
            Most property systems stop at billing. AssetFlow includes a full double-entry accounting engine.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            "General Ledger — built from posted journals",
            "Trial Balance — derived. Must balance.",
            "Income Statement — revenue, expenses, NOI",
            "Balance Sheet — assets, liabilities, equity",
            "Cash Flow Statement — from bank ledger",
            "VAT Engine — input, output, residential exempt",
            "Budgeting — variance analysis per property",
            "Financial Close Assistant — month-end intelligence",
          ].map(item => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-sm text-gray-300">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Why We Exist</p>
        <h2 className="mt-3 text-3xl font-bold md:text-5xl leading-tight">
          Built because commercial
          <br />
          <span className="text-gray-400">property deserved better.</span>
        </h2>
        <p className="mt-4 text-gray-400 max-w-lg leading-relaxed">
          One of the world's largest asset classes still operates on disconnected software and spreadsheets.
          AssetFlow was built to change that.
        </p>
      </section>

      {/* TRUST */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Trust</p>
        <h2 className="mt-3 text-3xl font-bold md:text-5xl leading-tight">
          Built for the
          <br />
          <span className="text-gray-400">numbers that matter.</span>
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {[
            "Role-based permissions",
            "Complete audit trail on every action",
            "Every number is drillable to source",
            "Enterprise-grade encryption",
            "Financial integrity checks built in",
            "Daily backups",
          ].map(item => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3">
              <p className="text-sm text-gray-300">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold md:text-5xl">One platform. Everything included.</h2>
          <p className="mt-3 text-gray-400">No feature tiers. No modules to unlock. Priced by portfolio.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {[
            { leases: "1–25", price: "995", users: "2" },
            { leases: "1–100", price: "2,995", users: "4" },
            { leases: "101–250", price: "4,995", users: "6", featured: true },
            { leases: "251–500", price: "8,995", users: "10" },
            { leases: "501–1,000", price: "18,995", users: "12" },
          ].map(tier => (
            <div key={tier.leases} className={`rounded-xl border p-5 text-center transition-all ${tier.featured ? 'border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/20' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              {tier.featured && <p className="text-xs font-medium text-emerald-400 mb-2">Most Popular</p>}
              <p className="text-sm text-gray-400">{tier.leases} leases</p>
              <p className="mt-2 text-3xl font-bold text-white">R{tier.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <p className="text-xs text-gray-500 mt-1">{tier.users} users included</p>
              <a href="#beta" className={`mt-4 block w-full rounded-full py-2 text-xs font-medium transition-all ${tier.featured ? 'bg-white text-black hover:bg-gray-100' : 'border border-white/20 text-white hover:border-white/40'}`}>
                {tier.featured ? 'Request Access' : 'Get Started'}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center space-y-1">
          <p className="text-sm text-gray-500">1,000+ leases? <Link href="/contact" className="text-white underline underline-offset-4">Enterprise pricing</Link></p>
          <p className="text-xs text-gray-600">Additional users R175/mo · Tenants, suppliers, and brokers always free</p>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-2xl md:text-4xl font-light italic text-gray-400 leading-relaxed">
          "Simple on top.
          <br />
          <span className="text-white">Galaxy beneath."</span>
        </p>
        <p className="mt-4 text-sm text-gray-500">The system recommends. The human approves. Everything is explainable.</p>
      </section>

      {/* CTA */}
      <section id="beta" className="mx-auto max-w-2xl px-6 py-16 pb-32">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 md:p-14 text-center">
          <h2 className="text-2xl font-bold text-white">Apply for access</h2>
          <p className="mt-2 text-sm text-gray-400">We're inviting a limited number of commercial portfolios to become our founding customers.</p>

          {betaSubmitted ? (
            <div className="mt-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-lg font-medium text-white">Application received.</p>
              <p className="text-sm text-gray-400 mt-1">We'll be in touch within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleBetaSubmit} className="mt-8 space-y-3 max-w-sm mx-auto">
              <input type="text" value={betaCompany} onChange={(e) => setBetaCompany(e.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all" placeholder="Company name" />
              <input type="email" value={betaEmail} onChange={(e) => setBetaEmail(e.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all" placeholder="Work email" />
              <select value={betaPortfolio} onChange={(e) => setBetaPortfolio(e.target.value)} required className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all appearance-none">
                <option value="">Portfolio size</option>
                <option value="1-25">1–25 properties</option>
                <option value="26-100">26–100 properties</option>
                <option value="101-250">101–250 properties</option>
                <option value="251-500">251–500 properties</option>
                <option value="500+">500+ properties</option>
              </select>
              <button type="submit" className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">Submit application</button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-sm text-gray-500">© 2026 AssetFlow — The Commercial Property Operating System</p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
