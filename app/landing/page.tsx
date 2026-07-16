'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [betaEmail, setBetaEmail] = useState('');
  const [betaCompany, setBetaCompany] = useState('');
  const [betaPortfolio, setBetaPortfolio] = useState('');
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

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
    <div className="min-h-screen bg-black text-white selection:bg-white/10" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      
      {/* NAV */}
      <nav className="fixed top-0 z-50 w-full bg-black/70 backdrop-blur-2xl border-b border-white/[0.03]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-[13px] font-medium tracking-tight">AssetFlow</Link>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-[12px] text-gray-500 hover:text-white transition-colors duration-700">Sign in</Link>
            <a href="#apply" className="rounded-full bg-white px-4 py-1.5 text-[12px] font-medium text-black hover:bg-gray-100 transition-all duration-300">
              Apply for access
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-center px-6">
        <div className={`transition-all duration-1000 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Ambient */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[900px] bg-gradient-to-b from-white/[0.012] via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-b from-white/[0.008] via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-5xl text-center pt-20">
            <h1 className="text-[3.25rem] font-light leading-[1.04] tracking-[-0.02em] md:text-[5.5rem] lg:text-[7rem]">
              Commercial property.
              <br />
              <span className="text-gray-400">Finally connected.</span>
            </h1>
            
            <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-gray-500 font-light">
              One operating system for leases, billing, financials, and operations.
            </p>
            
            <div className="mt-10">
              <a href="#apply" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-[13px] font-medium text-black hover:bg-gray-100 transition-all duration-300">
                Apply for access
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
              </a>
            </div>
          </div>

          {/* Preview card */}
          <div className="relative mx-auto mt-16 max-w-5xl w-full">
            <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-b from-white/[0.01] to-transparent p-[0.5px] shadow-2xl shadow-black/80">
              <div className="rounded-2xl bg-black/60 backdrop-blur-md overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/12" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/12" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/12" />
                  </div>
                </div>
                <div className="p-10 md:p-14">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-8">Good morning. Today.</p>
                  <div className="grid gap-10 md:grid-cols-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.25em] text-gray-700 mb-2">Occupancy</p>
                      <p className="text-5xl font-light tracking-[-0.02em]">94<span className="text-gray-600 text-xl font-light">%</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.25em] text-gray-700 mb-2">Collected today</p>
                      <p className="text-5xl font-light tracking-[-0.02em]">R842<span className="text-gray-600 text-xl font-light">k</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.25em] text-gray-700 mb-2">Needs attention</p>
                      <p className="text-5xl font-light tracking-[-0.02em] text-amber-400/80">3</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-5xl px-6 py-56">
        <div className="grid gap-24 md:grid-cols-2 items-center">
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">The problem</p>
            <h2 className="text-2xl font-light tracking-[-0.02em] md:text-4xl leading-[1.12]">
              Your portfolio runs
              <br />
              <span className="text-gray-400">on five systems.</span>
            </h2>
            <p className="mt-6 text-[13px] text-gray-500 font-light leading-relaxed max-w-sm">
              Leasing in spreadsheets. Billing in legacy software. Payments in a bank portal. 
              Reports built manually. None of them talk to each other.
            </p>
          </div>
          <div className="space-y-[0.5px]">
            {[
              { label: "Leasing", tool: "Excel. Email. Memory." },
              { label: "Billing", tool: "MRI / MDA. Complex." },
              { label: "Payments", tool: "Bank portal. No trace." },
              { label: "Maintenance", tool: "WhatsApp. No audit." },
              { label: "Reports", tool: "Built by hand. Days lost." },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-3 border-b border-white/[0.02] last:border-0">
                <p className="text-[11px] text-gray-700 font-light w-24">{item.label}</p>
                <p className="text-[13px] text-gray-400 font-light">{item.tool}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MORNING BRIEF */}
      <section className="mx-auto max-w-5xl px-6 py-40">
        <div className="mb-16">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">Your morning</p>
          <h2 className="text-2xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
            Good morning.
            <br />
            <span className="text-gray-400">Your portfolio is talking.</span>
          </h2>
          <p className="mt-4 text-[13px] text-gray-500 font-light max-w-sm">
            Every day starts with clarity. Not a dashboard. Not widgets. Just what matters.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-b from-white/[0.008] to-transparent overflow-hidden">
          <div className="p-10 md:p-14">
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-8">Today — 15 July 2027</p>
            <div className="space-y-6">
              <div className="border-l border-l-amber-400/30 pl-5">
                <p className="text-[10px] text-gray-700 font-light mb-1">07:00</p>
                <p className="text-base font-light text-amber-400/90">3 leases expire within 90 days</p>
                <p className="text-[12px] text-gray-600 font-light mt-0.5">Combined annual value: R2.1m</p>
              </div>
              <div className="border-l border-l-white/[0.06] pl-5">
                <p className="text-[10px] text-gray-700 font-light mb-1">07:00</p>
                <p className="text-base font-light">R842,000 collected overnight</p>
                <p className="text-[12px] text-gray-600 font-light mt-0.5">312 tenants. 3 payments outstanding.</p>
              </div>
              <div className="border-l border-l-white/[0.06] pl-5">
                <p className="text-[10px] text-gray-700 font-light mb-1">07:01</p>
                <p className="text-base font-light">Municipality invoice awaiting approval</p>
                <p className="text-[12px] text-gray-600 font-light mt-0.5">Rosebank Office Park. R120,000 due 22 July.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ONE WORKFLOW */}
      <section className="mx-auto max-w-4xl px-6 py-40">
        <div className="mb-20">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">How it works</p>
          <h2 className="text-2xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
            One lease.
            <br />
            <span className="text-gray-400">End to end.</span>
          </h2>
        </div>

        <div className="relative">
          <div className="absolute left-[14px] top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="space-y-16">
            {[
              { step: "1", title: "Lease activated", detail: "Tenant signs. AssetFlow schedules billing, registers the deposit, updates portfolio occupancy." },
              { step: "2", title: "Invoice generated", detail: "R115,000 billed. VAT invoice for commercial. Tax-exempt for residential. Statement produced automatically." },
              { step: "3", title: "Payment received", detail: "Tenant pays. Bank import matches the transaction. One click confirms. Cash Book and GL update." },
              { step: "4", title: "Supplier paid", detail: "Municipality bill arrives. OCR extracts details. Routed for approval. Added to payment batch." },
              { step: "5", title: "Period closed", detail: "Financial Close Assistant verifies everything. Bank reconciled. VAT complete. Trial balance verified. July closed." },
            ].map(item => (
              <div key={item.step} className="relative pl-10">
                <div className="absolute left-0 top-1.5 w-[4px] h-[4px] rounded-full bg-white/15 ring-4 ring-black" />
                <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-gray-700 mb-1">{item.step}</p>
                <p className="text-[15px] font-light">{item.title}</p>
                <p className="mt-1 text-[12px] text-gray-500 font-light leading-relaxed max-w-md">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINANCIAL PLATFORM */}
      <section className="relative overflow-hidden px-6 py-40">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.004] via-transparent to-white/[0.004] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-16">
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">Under the surface</p>
            <h2 className="text-2xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
              The galaxy beneath.
            </h2>
            <p className="mt-5 text-[13px] text-gray-500 font-light max-w-md leading-relaxed">
              Most property systems stop at billing. AssetFlow includes a complete financial operating system.
            </p>
          </div>

          <div className="grid gap-[0.5px] bg-white/[0.025] rounded-xl overflow-hidden">
            {[
              "General Ledger — built from posted journals. Always in balance.",
              "Trial Balance — derived in real time. Must balance before period close.",
              "Income Statement — revenue, expenses, NOI. Per property or consolidated.",
              "Balance Sheet — assets, liabilities, equity. Period-end snapshot.",
              "Cash Flow — operating, investing, financing. From bank ledger.",
              "VAT Engine — output, input, VAT201. Residential income automatically exempt.",
              "Budgeting — annual and monthly. Variance analysis with explanations.",
              "Financial Close Assistant — month-end intelligence. Warnings, not blocks.",
            ].map(item => (
              <div key={item} className="px-6 py-3.5 bg-black">
                <p className="text-[12px] text-gray-400 font-light">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-4xl px-6 py-40">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">Why we exist</p>
        <h2 className="text-2xl font-light tracking-[-0.02em] md:text-4xl leading-[1.12]">
          Built because commercial
          <br />
          <span className="text-gray-400">property deserved better.</span>
        </h2>
        <p className="mt-6 text-[13px] text-gray-500 font-light leading-relaxed max-w-lg">
          One of the world's largest asset classes still operates on disconnected software, 
          spreadsheets, and manual processes. We built AssetFlow to change that.
        </p>
        <div className="mt-10 grid gap-[0.5px] bg-white/[0.025] rounded-lg overflow-hidden">
          {[
            { left: "Traditional", right: "Separate systems for leasing, billing, maintenance, and reporting. They don't talk." },
            { left: "AssetFlow", right: "One operating system. Every event updates operations, financials, and intelligence simultaneously." },
          ].map(item => (
            <div key={item.left} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-8 px-5 py-3.5 bg-black">
              <p className="text-[10px] text-gray-700 font-light w-24 flex-shrink-0 uppercase tracking-wider">{item.left}</p>
              <p className="text-[12px] text-gray-400 font-light">{item.right}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="mx-auto max-w-4xl px-6 py-32">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-6">Trust</p>
        <h2 className="text-2xl font-light tracking-[-0.02em] md:text-4xl leading-[1.12]">
          Built for the
          <br />
          <span className="text-gray-400">numbers that matter.</span>
        </h2>
        <div className="mt-10 grid gap-[0.5px] bg-white/[0.025] rounded-lg overflow-hidden">
          {[
            "Role-based permissions — control what every user can see and do",
            "Complete audit trail — every action logged with actor, timestamp, and correlation ID",
            "Every financial number is explainable — drill down to the source business event",
            "Enterprise-grade security — encryption at rest and in transit, row-level security, MFA",
            "Financial integrity checks — trial balance must balance before period close",
            "Daily backups — your data is safe, always",
          ].map(item => (
            <div key={item} className="px-5 py-3 bg-black">
              <p className="text-[12px] text-gray-400 font-light">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-5xl px-6 py-40">
        <div className="mb-16 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-700 mb-4">Pricing</p>
          <h2 className="text-2xl font-light tracking-[-0.02em] md:text-4xl">One platform. Everything included.</h2>
          <p className="mt-3 text-[13px] text-gray-500 font-light">No feature tiers. No modules to unlock. Priced by portfolio.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { leases: "1–100", price: "2,995", users: "4" },
            { leases: "101–250", price: "4,995", users: "6", featured: true },
            { leases: "251–500", price: "8,995", users: "10" },
            { leases: "501–1,000", price: "18,995", users: "12" },
          ].map(tier => (
            <div key={tier.leases} className={`rounded-xl border p-6 text-center transition-all duration-500 ${tier.featured ? 'border-white/12 bg-white/[0.015]' : 'border-white/[0.03] bg-transparent hover:border-white/[0.06]'}`}>
              <p className="text-[11px] text-gray-500 font-light">{tier.leases} active leases</p>
              <p className="mt-3 text-4xl font-light tracking-[-0.02em]">R{tier.price}</p>
              <p className="text-[11px] text-gray-600 mt-1 font-light">per month</p>
              <p className="text-[11px] text-gray-600 mt-3 font-light">{tier.users} users included</p>
              <a href="#apply" className={`mt-5 block w-full rounded-full py-2 text-[11px] font-medium transition-all duration-300 ${tier.featured ? 'bg-white text-black hover:bg-gray-100' : 'border border-white/[0.06] hover:border-white/15'}`}>
                {tier.featured ? 'Apply for access' : 'Get started'}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-[11px] text-gray-600 font-light">1,000+ leases? <Link href="/contact" className="text-white hover:text-gray-300 underline underline-offset-4">Enterprise pricing</Link></p>
          <p className="text-[10px] text-gray-700 font-light">Additional users R175/mo · Tenants, suppliers, and brokers always free</p>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="text-xl font-light italic text-gray-400 leading-relaxed md:text-3xl">
          "Simple on top.
          <br />
          <span className="text-white">Galaxy beneath."</span>
        </p>
        <p className="mt-5 text-[11px] text-gray-700 font-light">The system recommends. The human approves. Everything is explainable.</p>
      </section>

      {/* APPLY */}
      <section id="apply" className="mx-auto max-w-lg px-6 py-20 pb-44">
        <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-b from-white/[0.008] to-transparent p-10 text-center">
          <h2 className="text-lg font-light tracking-[-0.02em]">Apply for access</h2>
          <p className="mt-2 text-[12px] text-gray-500 font-light leading-relaxed">
            We're inviting a limited number of commercial portfolios to become our founding customers.
          </p>

          {betaSubmitted ? (
            <div className="mt-8">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.04] mb-4">
                <span className="text-base">✓</span>
              </div>
              <p className="text-[13px] font-light">Application received.</p>
              <p className="text-[11px] text-gray-500 font-light mt-1">We'll be in touch within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleBetaSubmit} className="mt-6 space-y-3">
              <input type="text" value={betaCompany} onChange={(e) => setBetaCompany(e.target.value)} required className="w-full rounded-lg border border-white/[0.05] bg-white/[0.01] px-4 py-2.5 text-[12px] text-white outline-none focus:border-white/12 transition-all duration-500 font-light" placeholder="Company name" />
              <input type="email" value={betaEmail} onChange={(e) => setBetaEmail(e.target.value)} required className="w-full rounded-lg border border-white/[0.05] bg-white/[0.01] px-4 py-2.5 text-[12px] text-white outline-none focus:border-white/12 transition-all duration-500 font-light" placeholder="Work email" />
              <select value={betaPortfolio} onChange={(e) => setBetaPortfolio(e.target.value)} required className="w-full rounded-lg border border-white/[0.05] bg-white/[0.01] px-4 py-2.5 text-[12px] text-white outline-none focus:border-white/12 transition-all duration-500 font-light appearance-none">
                <option value="">Portfolio size</option>
                <option value="1-50">1–50 properties</option>
                <option value="51-200">51–200 properties</option>
                <option value="201-500">201–500 properties</option>
                <option value="500+">500+ properties</option>
              </select>
              <button type="submit" className="w-full rounded-lg bg-white py-2.5 text-[12px] font-medium text-black hover:bg-gray-100 transition-all duration-300">
                Submit application
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.02] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 md:flex-row">
          <p className="text-[10px] text-gray-800 font-light">© 2026 AssetFlow</p>
          <div className="flex items-center gap-6 text-[10px] text-gray-800 font-light">
            <Link href="/about" className="hover:text-gray-500 transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-gray-500 transition-colors">Pricing</Link>
            <Link href="/security" className="hover:text-gray-500 transition-colors">Security</Link>
            <Link href="/contact" className="hover:text-gray-500 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
