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
    <div className="min-h-screen bg-black text-white selection:bg-white/10">
      
      {/* NAV */}
      <nav className="fixed top-0 z-50 w-full bg-black/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">AssetFlow</Link>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors duration-500">Sign in</Link>
            <a href="#apply" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-all duration-300">Apply for access</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 pt-16">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[700px] bg-gradient-to-b from-white/[0.02] via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl">
          <h1 className="text-[3.5rem] font-light leading-[1.05] tracking-[-0.02em] md:text-[5.5rem] lg:text-[7rem]">
            Commercial property.
            <br />
            <span className="text-gray-400">Finally connected.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-gray-400 font-light">
            One operating system for leases, billing, financials, and operations.
            Everything your portfolio needs, working as one.
          </p>

          <div className="mt-10">
            <a href="#apply" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-medium text-black hover:bg-gray-100 transition-all duration-300">
              Apply for access
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </a>
          </div>
        </div>

        {/* HERO SCREENSHOT — Morning Brief */}
        <div className="relative z-10 mt-20 w-full max-w-5xl">
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              </div>
              <span className="text-[11px] text-gray-500 ml-3">Morning Brief</span>
            </div>
            {/* PLACEHOLDER — Replace with screenshot */}
            <div className="aspect-[16/9] bg-white/[0.01] flex items-center justify-center">
              <img 
                src="/screenshots/morning-brief.png" 
                alt="AssetFlow Morning Brief — Commercial Property Operating System" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<p class=\"text-gray-600 text-sm font-light\">Morning Brief screenshot</p>';
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="mx-auto max-w-5xl px-6 py-48">
        <div className="grid gap-20 md:grid-cols-2 items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">The problem</p>
            <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.1]">
              Your portfolio runs on
              <br />
              <span className="text-gray-400">separate systems.</span>
            </h2>
            <p className="mt-6 text-base text-gray-500 font-light leading-relaxed max-w-sm">
              Leasing in spreadsheets. Billing in legacy software. Payments in a bank portal. None of them talk to each other.
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
              <div key={item.label} className="flex justify-between items-center py-4 border-b border-white/[0.04] last:border-0">
                <p className="text-xs text-gray-500 font-light w-24">{item.label}</p>
                <p className="text-sm text-gray-300 font-light">{item.tool}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MORNING BRIEF */}
      <section className="mx-auto max-w-5xl px-6 py-40">
        <div className="mb-16">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">Your morning</p>
          <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
            Good morning.
            <br />
            <span className="text-gray-400">Your portfolio is talking.</span>
          </h2>
          <p className="mt-4 text-base text-gray-500 font-light max-w-sm">
            Every day starts with clarity. Not a dashboard. Just what needs attention.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.05] bg-gradient-to-b from-white/[0.01] to-transparent overflow-hidden">
          <div className="p-10 md:p-14">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-600 mb-8">Today — 15 July 2027</p>
            <div className="space-y-7">
              <div className="border-l border-l-amber-400/40 pl-5">
                <p className="text-[11px] text-gray-500 font-light mb-1">07:00</p>
                <p className="text-lg font-light text-amber-400/90">3 leases expire within 90 days</p>
                <p className="text-sm text-gray-500 font-light mt-0.5">Combined annual value: R2.1m</p>
              </div>
              <div className="border-l border-l-white/[0.06] pl-5">
                <p className="text-[11px] text-gray-500 font-light mb-1">07:00</p>
                <p className="text-lg font-light text-white">R842,000 collected overnight</p>
                <p className="text-sm text-gray-500 font-light mt-0.5">312 tenants. 3 payments outstanding.</p>
              </div>
              <div className="border-l border-l-white/[0.06] pl-5">
                <p className="text-[11px] text-gray-500 font-light mb-1">07:01</p>
                <p className="text-lg font-light text-white">Municipality invoice awaiting approval</p>
                <p className="text-sm text-gray-500 font-light mt-0.5">Rosebank Office Park. R120,000 due 22 July.</p>
              </div>
              <div className="border-l border-l-white/[0.06] pl-5">
                <p className="text-[11px] text-gray-500 font-light mb-1">07:01</p>
                <p className="text-lg font-light text-white">2 inspections completed</p>
                <p className="text-sm text-gray-500 font-light mt-0.5">No critical findings.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ONE WORKFLOW + SCREENSHOTS */}
      <section className="mx-auto max-w-5xl px-6 py-40">
        <div className="mb-16">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">How it works</p>
          <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
            One lease.
            <br />
            <span className="text-gray-400">End to end.</span>
          </h2>
        </div>

        <div className="space-y-24">
          {/* Step 1 + Revenue Ops screenshot */}
          <div className="grid gap-10 md:grid-cols-2 items-center">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-600 mb-2">01</p>
              <h3 className="text-xl font-light text-white">Lease activated</h3>
              <p className="mt-2 text-sm text-gray-500 font-light leading-relaxed">
                Tenant signs. AssetFlow schedules billing, registers the deposit, and updates portfolio occupancy automatically.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.05] overflow-hidden bg-white/[0.01]">
              <img 
                src="/screenshots/revenue-ops.png" 
                alt="AssetFlow Revenue Operations" 
                className="w-full h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class=\"aspect-[16/10] flex items-center justify-center\"><p class=\"text-gray-600 text-xs font-light\">Revenue Operations screenshot</p></div>';
                }}
              />
            </div>
          </div>

          {/* Step 3 + Cash Book screenshot */}
          <div className="grid gap-10 md:grid-cols-2 items-center">
            <div className="order-2 md:order-1 rounded-xl border border-white/[0.05] overflow-hidden bg-white/[0.01]">
              <img 
                src="/screenshots/cash-book.png" 
                alt="AssetFlow Cash Book" 
                className="w-full h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class=\"aspect-[16/10] flex items-center justify-center\"><p class=\"text-gray-600 text-xs font-light\">Cash Book screenshot</p></div>';
                }}
              />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-600 mb-2">02</p>
              <h3 className="text-xl font-light text-white">Payment received. Bank reconciles.</h3>
              <p className="mt-2 text-sm text-gray-500 font-light leading-relaxed">
                Tenant pays. Bank import matches the transaction automatically. One click confirms. Cash Book and General Ledger update simultaneously.
              </p>
            </div>
          </div>

          {/* Step 5 + Financial Platform screenshot */}
          <div className="grid gap-10 md:grid-cols-2 items-center">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-600 mb-2">03</p>
              <h3 className="text-xl font-light text-white">Financial period closes</h3>
              <p className="mt-2 text-sm text-gray-500 font-light leading-relaxed">
                Month-end. The Financial Close Assistant checks everything: bank reconciled, VAT calculated, trial balance verified. Period closed with confidence.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.05] overflow-hidden bg-white/[0.01]">
              <img 
                src="/screenshots/financial-platform.png" 
                alt="AssetFlow Financial Platform" 
                className="w-full h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class=\"aspect-[16/10] flex items-center justify-center\"><p class=\"text-gray-600 text-xs font-light\">Financial Platform screenshot</p></div>';
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FINANCIAL PLATFORM */}
      <section className="relative overflow-hidden px-6 py-40">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.004] via-transparent to-white/[0.004] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-16">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">Under the surface</p>
            <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.08]">
              The galaxy beneath.
            </h2>
            <p className="mt-5 text-base text-gray-500 font-light max-w-md leading-relaxed">
              Most property systems stop at billing. AssetFlow includes a complete financial operating system — general ledger, trial balance, financial statements, VAT, and budgeting. All from the same operational events.
            </p>
          </div>

          <div className="grid gap-[0.5px] bg-white/[0.03] rounded-xl overflow-hidden">
            {[
              "General Ledger — built from posted journals. Always in balance.",
              "Trial Balance — derived in real time. Must balance before period close.",
              "Income Statement — revenue, expenses, NOI. Per property or consolidated.",
              "Balance Sheet — assets, liabilities, equity. Period-end snapshot.",
              "Cash Flow Statement — operating, investing, financing. From bank ledger.",
              "VAT Engine — output, input, VAT201. Residential income automatically exempt.",
              "Budgeting — annual and monthly. Variance analysis with explanations.",
              "Financial Close Assistant — month-end intelligence. Warnings, not blocks.",
            ].map(item => (
              <div key={item} className="px-6 py-4 bg-black">
                <p className="text-sm text-gray-400 font-light">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-4xl px-6 py-40">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">Why we exist</p>
        <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.1]">
          Built because commercial
          <br />
          <span className="text-gray-400">property deserved better.</span>
        </h2>
        <p className="mt-6 text-base text-gray-500 font-light leading-relaxed max-w-lg">
          One of the world's largest asset classes still operates on disconnected software and spreadsheets. We built AssetFlow to change that.
        </p>
      </section>

      {/* TRUST */}
      <section className="mx-auto max-w-4xl px-6 py-32">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">Trust</p>
        <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl leading-[1.1]">
          Built for the
          <br />
          <span className="text-gray-400">numbers that matter.</span>
        </h2>
        <div className="mt-10 grid gap-[0.5px] bg-white/[0.03] rounded-xl overflow-hidden">
          {[
            "Role-based permissions — control what every user can see and do",
            "Complete audit trail — every action logged with actor and timestamp",
            "Every financial number is drillable to its source business event",
            "Enterprise-grade encryption — at rest and in transit",
            "Financial integrity checks — trial balance must balance before period close",
            "Daily backups — your data is safe, always",
          ].map(item => (
            <div key={item} className="px-6 py-4 bg-black">
              <p className="text-sm text-gray-400 font-light">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-5xl px-6 py-40">
        <div className="mb-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 mb-6">Pricing</p>
          <h2 className="text-3xl font-light tracking-[-0.02em] md:text-5xl">One platform. Everything included.</h2>
          <p className="mt-3 text-base text-gray-500 font-light">No feature tiers. No modules to unlock. Priced by portfolio.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {[
            { leases: "1–25", price: "995", users: "2" },
            { leases: "1–100", price: "2,995", users: "4" },
            { leases: "101–250", price: "4,995", users: "6", highlight: true },
            { leases: "251–500", price: "8,995", users: "10" },
            { leases: "501–1,000", price: "18,995", users: "12" },
          ].map(tier => (
            <div key={tier.leases} className={`rounded-xl border p-6 text-center transition-all duration-500 ${tier.highlight ? 'border-white/15 bg-white/[0.02]' : 'border-white/[0.05] bg-transparent hover:border-white/[0.08]'}`}>
              <p className="text-xs text-gray-500 font-light">{tier.leases} active leases</p>
              <p className="mt-3 text-4xl font-light tracking-[-0.02em]">R{tier.price}</p>
              <p className="text-xs text-gray-500 mt-1 font-light">per month</p>
              <p className="text-xs text-gray-500 mt-3 font-light">{tier.users} users included</p>
              <a href="#apply" className={`mt-5 block w-full rounded-full py-2 text-xs font-medium transition-all duration-300 ${tier.highlight ? 'bg-white text-black hover:bg-gray-100' : 'border border-white/[0.08] text-white hover:border-white/20'}`}>
                {tier.highlight ? 'Apply for access' : 'Get started'}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-500 font-light">1,000+ leases? <Link href="/contact" className="text-white underline underline-offset-4 hover:text-gray-300">Enterprise pricing</Link></p>
          <p className="text-xs text-gray-600 font-light">Additional users R175/mo · Tenants, suppliers, and brokers always free</p>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="text-2xl font-light italic text-gray-400 leading-relaxed md:text-3xl">
          "Simple on top.
          <br />
          <span className="text-white">Galaxy beneath."</span>
        </p>
        <p className="mt-5 text-sm text-gray-600 font-light">The system recommends. The human approves. Everything is explainable.</p>
      </section>

      {/* APPLY */}
      <section id="apply" className="mx-auto max-w-lg px-6 py-16 pb-44">
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.01] to-transparent p-10 text-center">
          <h2 className="text-xl font-light tracking-[-0.02em]">Apply for access</h2>
          <p className="mt-2 text-sm text-gray-500 font-light leading-relaxed">
            We're inviting a limited number of commercial portfolios to become our founding customers.
          </p>

          {betaSubmitted ? (
            <div className="mt-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] mb-4">
                <span className="text-lg">✓</span>
              </div>
              <p className="text-base font-light">Application received.</p>
              <p className="text-sm text-gray-500 font-light mt-1">We'll be in touch within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleBetaSubmit} className="mt-6 space-y-3">
              <input type="text" value={betaCompany} onChange={(e) => setBetaCompany(e.target.value)} required className="w-full rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3 text-sm text-white outline-none focus:border-white/15 transition-all duration-500 font-light" placeholder="Company name" />
              <input type="email" value={betaEmail} onChange={(e) => setBetaEmail(e.target.value)} required className="w-full rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3 text-sm text-white outline-none focus:border-white/15 transition-all duration-500 font-light" placeholder="Work email" />
              <select value={betaPortfolio} onChange={(e) => setBetaPortfolio(e.target.value)} required className="w-full rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3 text-sm text-white outline-none focus:border-white/15 transition-all duration-500 font-light appearance-none">
                <option value="">Portfolio size</option>
                <option value="1-25">1–25 properties</option>
                <option value="26-100">26–100 properties</option>
                <option value="101-250">101–250 properties</option>
                <option value="251-500">251–500 properties</option>
                <option value="500+">500+ properties</option>
              </select>
              <button type="submit" className="w-full rounded-lg bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all duration-300">
                Submit application
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-xs text-gray-600 font-light">© 2026 AssetFlow</p>
          <div className="flex items-center gap-8 text-xs text-gray-600 font-light">
            <Link href="/about" className="hover:text-gray-400 transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-gray-400 transition-colors">Pricing</Link>
            <Link href="/security" className="hover:text-gray-400 transition-colors">Security</Link>
            <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
