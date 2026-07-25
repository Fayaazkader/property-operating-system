import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { FeatureChips } from './FeatureChips';
import { RevenuePreview } from '../previews/RevenuePreview';
import { TrialBalancePreview } from '../previews/TrialBalancePreview';
import { WorkOrdersPreview } from '../previews/WorkOrdersPreview';
import { PortfolioPreview } from '../previews/PortfolioPreview';

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
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
            AssetFlow replaces six disconnected systems with a single platform
            where every operational event flows into financial truth.
          </p>
        </div>

        <div className="space-y-16">
          {/* Revenue Operations */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Revenue Operations</p>
              <h3 className="text-xl font-light text-white">Leases become recurring billing automatically.</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-md">
                Every active lease generates invoices, statements, and recoveries without manual intervention.
              </p>
              <FeatureChips items={['Automated billing', 'Utility recoveries', 'Escalation engine', 'Arrears management']} />
            </div>
            <RevenuePreview />
          </div>

          {/* Financial Platform */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <TrialBalancePreview />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Financial Platform</p>
              <h3 className="text-xl font-light text-white">Operational events flow directly into financial reporting.</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-md">
                Every invoice, receipt, and payment posts double-entry journals automatically.
              </p>
              <FeatureChips items={['General Ledger', 'Trial Balance', 'Income Statement', 'Balance Sheet']} />
            </div>
          </div>

          {/* Property Operations */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Property Operations</p>
              <h3 className="text-xl font-light text-white">Maintenance, compliance, suppliers, and finance remain connected.</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-md">
                Work orders link to suppliers. Every cost flows into the property's financial record.
              </p>
              <FeatureChips items={['Work orders', 'Inspections', 'Compliance', 'Suppliers']} />
            </div>
            <WorkOrdersPreview />
          </div>

          {/* Portfolio Intelligence */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <PortfolioPreview />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-3">Portfolio Intelligence</p>
              <h3 className="text-xl font-light text-white">Real-time portfolio insight without manual reporting.</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-md">
                Morning Brief delivers daily clarity. Drill down from any number to the source transaction.
              </p>
              <FeatureChips items={['Morning Brief', 'KPIs', 'Budget vs Actual', 'Drill-down']} />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
