import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

export function Journey() {
  return (
    <Section id="journey" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">The Platform</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            One operating system.
            <br />
            <span className="text-zinc-400">Every workflow connected.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            AssetFlow replaces six disconnected systems with a single platform
            where every operational event flows into financial truth.
          </p>
        </div>

        <div className="space-y-12">
          {/* Revenue Operations */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Revenue Operations</p>
              <h3 className="text-xl font-light text-white">Leases become recurring billing automatically.</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Every active lease generates invoices, statements, and recoveries without manual intervention. 
                Escalations apply on schedule. Deposits register automatically.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Automated billing', 'Utility recoveries', 'Escalation engine', 'Arrears management'].map(tag => (
                  <span key={tag} className="text-[10px] px-3 py-1 rounded-full border border-white/[0.06] text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-3">
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Active Leases</span><span className="text-white font-medium">247</span></div>
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Invoices This Month</span><span className="text-white font-medium">R842k</span></div>
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Statements Sent</span><span className="text-emerald-400 font-medium">247</span></div>
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Recoveries Billed</span><span className="text-white font-medium">R124k</span></div>
            </div>
          </div>

          {/* Financial Platform */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Trial Balance — July 2026</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-zinc-500">Rental Income</span><span className="text-white tabular-nums">R842,000</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Operating Expenses</span><span className="text-white tabular-nums">R312,000</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Net Income</span><span className="text-emerald-400 tabular-nums">R530,000</span></div>
                <div className="border-t border-white/[0.04] pt-2 flex justify-between"><span className="text-zinc-400 font-medium">Balance</span><span className="text-emerald-400 font-medium">✓ Balanced</span></div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Financial Platform</p>
              <h3 className="text-xl font-light text-white">Operational events flow directly into financial reporting.</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Every invoice, receipt, and payment posts double-entry journals automatically. 
                General ledger, trial balance, and financial statements are always current.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['General Ledger', 'Trial Balance', 'Income Statement', 'Balance Sheet'].map(tag => (
                  <span key={tag} className="text-[10px] px-3 py-1 rounded-full border border-white/[0.06] text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Property Operations */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Property Operations</p>
              <h3 className="text-xl font-light text-white">Maintenance, compliance, suppliers, and finance remain connected.</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Work orders link to suppliers. Inspections trigger compliance updates. 
                Every cost flows into the property's financial record.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Work orders', 'Inspections', 'Compliance', 'Suppliers'].map(tag => (
                  <span key={tag} className="text-[10px] px-3 py-1 rounded-full border border-white/[0.06] text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">#142 Blocked Drain</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">In Progress</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">#143 AC Repair</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Completed</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Fire Compliance Check</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Scheduled</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Generator Service</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Due Soon</span>
              </div>
            </div>
          </div>

          {/* Portfolio Intelligence */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-[9px] uppercase text-zinc-600 mb-1">Occupancy</p><p className="text-xl font-light text-white">94%</p></div>
                <div><p className="text-[9px] uppercase text-zinc-600 mb-1">NOI</p><p className="text-xl font-light text-white">R530k</p></div>
                <div><p className="text-[9px] uppercase text-zinc-600 mb-1">Arrears</p><p className="text-xl font-light text-amber-400/80">2.1%</p></div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Portfolio Intelligence</p>
              <h3 className="text-xl font-light text-white">Real-time portfolio insight without manual reporting.</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-md">
                Morning Brief delivers daily clarity. Drill down from any number to the source transaction. 
                Budget vs actual. Forecast vs trend.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Morning Brief', 'KPIs', 'Budget vs Actual', 'Drill-down'].map(tag => (
                  <span key={tag} className="text-[10px] px-3 py-1 rounded-full border border-white/[0.06] text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
