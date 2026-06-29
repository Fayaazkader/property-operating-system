'use client';

import { useState } from 'react';
import Link from 'next/link';

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
    if (res.ok) setBetaSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <h1 className="text-xl font-bold tracking-tight text-white">AssetFlow</h1>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-400 transition-colors hover:text-white">Sign In</Link>
            <a href="#beta" className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black">Request Access</a>
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
          <div className="space-y-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Commercial Property Operating System</p>
            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Good Morning.
              <br />
              <span className="text-gray-400">Your portfolio is talking.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-400">
              The commercial property operating system. Leases, billing, cash books and communications — finally working together.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <a href="#beta" className="rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black transition hover:bg-white/90">Request Beta Access</a>
              <Link href="/login" className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-medium text-white transition hover:border-white/30">Sign In</Link>
            </div>
            <p className="text-xs text-gray-600 pt-4">Built for: Portfolio Managers · Property Managers · Finance Teams · Asset Managers · Managing Agents</p>
          </div>

          <div className="mt-16 overflow-hidden rounded-2xl border border-white/5 bg-white/5 shadow-2xl">
            <img src="/screenshots/morning-brief-1.png" alt="AssetFlow Morning Brief — Commercial Property Operating System" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* THE PROBLEM */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">The Problem</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Your team works in five different systems.</h2>
          <p className="mt-2 text-gray-400">That's five places for things to go wrong.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Leasing", tool: "Excel", color: "border-l-emerald-500/40" },
            { label: "Finance", tool: "MRI / MDA", color: "border-l-amber-500/40" },
            { label: "Maintenance", tool: "Email", color: "border-l-blue-500/40" },
            { label: "Reporting", tool: "Power BI", color: "border-l-purple-500/40" },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border border-white/5 bg-white/5 p-5 border-l-2 ${card.color}`}>
              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">{card.label}</p>
              <p className="text-lg text-white mt-1">{card.tool}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <p className="text-2xl text-white font-semibold">One portfolio. One team. One operating system.</p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* THE OPERATING SYSTEM */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">The Operating System</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Every workspace. One platform.</h2>
        </div>
        <div className="space-y-3">
          {[
            { workspace: "Morning Brief", purpose: "Start your day with priorities, risks, and actions" },
            { workspace: "Revenue Operations", purpose: "Billing, statements, utilities, and distribution" },
            { workspace: "Cash Book", purpose: "Bank import, reconciliation, and allocation" },
            { workspace: "Communications", purpose: "WhatsApp, email, and tenant messaging" },
            { workspace: "Tasks", purpose: "Workflow orchestration across your portfolio" },
            { workspace: "Properties", purpose: "Asset management, occupancy, and financials" },
            { workspace: "Tenants", purpose: "Customer accounts, leases, and communications" },
          ].map(item => (
            <div key={item.workspace} className="flex justify-between items-center py-3 border-b border-white/5 text-sm">
              <span className="text-white font-medium">{item.workspace}</span>
              <span className="text-gray-500 text-right max-w-xs">{item.purpose}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* PRODUCT TOUR — 3 screenshots */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Product Tour</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">See AssetFlow in action.</h2>
        </div>

        <div className="space-y-16">
          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Revenue Operations</p>
              <p className="text-sm text-gray-400">Scope-driven billing with real-time health metrics. Know exactly what's billed, what's not, and what needs attention.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5 shadow-2xl">
              <img src="/screenshots/revenue-ops.png" alt="AssetFlow Revenue Operations" className="w-full h-auto" />
            </div>
          </div>

          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Cash Book</p>
              <p className="text-sm text-gray-400">Import bank statements, auto-match transactions, and allocate with confidence scores. Post when ready.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5 shadow-2xl">
              <img src="/screenshots/cash-book.png" alt="AssetFlow Cash Book" className="w-full h-auto" />
            </div>
          </div>

          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Property Intelligence Workspace</p>
              <p className="text-sm text-gray-400">Asset health scoring, tenant concentration, occupancy metrics, and financial performance — per property.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5 shadow-2xl">
              <img src="/screenshots/property-workspace.png" alt="AssetFlow Property Workspace" className="w-full h-auto" />
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-white/5 bg-white/5 p-6 text-center">
          <p className="text-sm text-gray-400">Also included:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-300">
            <span>✓ Tenant Workspace</span>
            <span>✓ Communications Engine</span>
            <span>✓ Tasks & Workflows</span>
            <span>✓ Audit Trail</span>
            <span>✓ Document Management</span>
            <span>✓ Operational Calendar</span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTELLIGENCE */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Intelligence</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">What your portfolio is trying to tell you.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-amber-500/10 bg-amber-500/5 p-8">
            <div className="text-4xl font-bold text-amber-400">3</div>
            <p className="mt-2 text-lg font-medium text-white">Parking bays have no billing rule</p>
            <p className="mt-1 text-sm text-gray-400">Potential loss: R31,500 annually. Flagged before it hits your P&L.</p>
          </div>
          <div className="rounded-3xl border border-amber-500/10 bg-amber-500/5 p-8">
            <div className="text-4xl font-bold text-amber-400">44</div>
            <p className="mt-2 text-lg font-medium text-white">Vacant units across your portfolio</p>
            <p className="mt-1 text-sm text-gray-400">Daily revenue loss: R30,247. Vacancy cost clock tracks every day.</p>
          </div>
          <div className="rounded-3xl border border-red-500/10 bg-red-500/5 p-8">
            <div className="text-4xl font-bold text-red-400">5</div>
            <p className="mt-2 text-lg font-medium text-white">Leases expire within 90 days</p>
            <p className="mt-1 text-sm text-gray-400">Revenue exposed: R2.1m annually. Renewal alerts before it's too late.</p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* COMPARISON */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Why AssetFlow</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Built for how property teams actually work.</h2>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-5 text-gray-400 font-normal">Capability</th>
                <th className="text-center py-3 px-5 text-emerald-400 font-normal">AssetFlow</th>
                <th className="text-center py-3 px-5 text-gray-600 font-normal">Traditional</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Single Operating Workspace", "✓", "×"],
                ["Morning Brief", "✓", "×"],
                ["Revenue Leakage Detection", "✓", "×"],
                ["Vacancy Cost Clock", "✓", "×"],
                ["WhatsApp Communications", "✓", "×"],
                ["Universal Search", "✓", "×"],
                ["AI-Powered Insights", "✓", "×"],
              ].map(row => (
                <tr key={row[0]} className="border-b border-white/5 last:border-0">
                  <td className="py-3 px-5 text-white">{row[0]}</td>
                  <td className="py-3 px-5 text-center text-emerald-400">{row[1]}</td>
                  <td className="py-3 px-5 text-center text-gray-600">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/* TRUST */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="border-t border-white/5 pt-16">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Built by property professionals</p>
          <p className="mt-4 text-lg text-gray-400 leading-relaxed">
            Designed by people who have worked in administration, leasing, property management, and portfolio management.
          </p>
          <p className="mt-2 text-white font-medium">
            Not software people trying to understand property. Property people building software.
          </p>
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
            Enterprise underneath."
          </p>
          <div className="mt-6 space-y-2 text-sm text-gray-500">
            <p>Most systems expose complexity.</p>
            <p className="text-white">AssetFlow hides it until you need it.</p>
            <p>The system recommends. <span className="text-white">The human approves.</span></p>
          </div>
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
                <input type="text" value={betaCompany} onChange={(e) => setBetaCompany(e.target.value)} required className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30" placeholder="Acme Property Group" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Email</label>
                <input type="email" value={betaEmail} onChange={(e) => setBetaEmail(e.target.value)} required className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30" placeholder="you@company.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Portfolio Size</label>
                <select value={betaPortfolio} onChange={(e) => setBetaPortfolio(e.target.value)} required className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30">
                  <option value="">Select...</option>
                  <option value="1-50">1-50 properties</option>
                  <option value="51-200">51-200 properties</option>
                  <option value="201-500">201-500 properties</option>
                  <option value="500+">500+ properties</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">Current System</label>
                <select value={betaSystem} onChange={(e) => setBetaSystem(e.target.value)} required className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30">
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
                <label className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-gray-500">What's your biggest operational headache?</label>
                <textarea value={betaHeadache} onChange={(e) => setBetaHeadache(e.target.value)} rows={2} className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-3 text-sm text-white outline-none focus:border-white/30" placeholder="Reconciliation, billing, arrears, lease renewals, reporting..." />
              </div>
              <button type="submit" className="w-full rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-white/90">Request Early Access</button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-sm text-gray-500">© 2026 AssetFlow — The Commercial Property Operating System</p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
  <a href="/about" className="transition-colors hover:text-white">About</a>
  <a href="/security" className="transition-colors hover:text-white">Security</a>
  <a href="/contact" className="transition-colors hover:text-white">Contact</a>
  <a href="/privacy" className="transition-colors hover:text-white">Privacy</a>
  <a href="/terms" className="transition-colors hover:text-white">Terms</a>
</div>
        </div>
      </footer>
    </div>
  );
}
