import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';
import { RevenuePreview } from '@/components/marketing/previews/RevenuePreview';
import { TrialBalancePreview } from '@/components/marketing/previews/TrialBalancePreview';
import { WorkOrdersPreview } from '@/components/marketing/previews/WorkOrdersPreview';
import { PortfolioPreview } from '@/components/marketing/previews/PortfolioPreview';
import { FeatureChips } from '@/components/marketing/sections/FeatureChips';

const CAPABILITIES = [
  {
    title: 'Revenue Operations',
    description: 'Automated billing, statements, escalations, recoveries, and arrears management — all from active leases.',
    chips: ['Automated billing', 'Utility recoveries', 'Escalation engine', 'Arrears management'],
    preview: RevenuePreview,
  },
  {
    title: 'Financial Platform',
    description: 'Full double-entry accounting engine. General ledger, trial balance, income statement, balance sheet, and VAT.',
    chips: ['General Ledger', 'Trial Balance', 'Income Statement', 'VAT Engine'],
    preview: TrialBalancePreview,
  },
  {
    title: 'Property Operations',
    description: 'Work orders, inspections, compliance tracking, supplier management, and purchase orders — connected to financials.',
    chips: ['Work orders', 'Inspections', 'Compliance', 'Suppliers'],
    preview: WorkOrdersPreview,
  },
  {
    title: 'Portfolio Intelligence',
    description: 'Morning Brief delivers daily clarity. Drill down from any number to the source transaction.',
    chips: ['Morning Brief', 'Executive KPIs', 'Budget vs Actual', 'Drill-down'],
    preview: PortfolioPreview,
  },
];

export default function PlatformPage() {
  return (
    <Section id="platform" className="pt-32 md:pt-48 pb-24">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">Platform</p>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            The Operating System
            <br />
            <span className="text-zinc-400">for Commercial Property</span>
          </h1>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            One platform where every operational event flows into financial truth — from lease creation to portfolio intelligence.
          </p>
        </div>

        <div className="space-y-24">
          {CAPABILITIES.map((cap, i) => {
            const Preview = cap.preview;
            const isReversed = i % 2 === 1;
            return (
              <div key={cap.title} className="grid md:grid-cols-2 gap-10 items-center">
                <div className={isReversed ? 'order-2 md:order-1' : ''}>
                  <Preview />
                </div>
                <div className={isReversed ? 'order-1 md:order-2' : ''}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/60 mb-3">{cap.title}</p>
                  <h3 className="text-xl font-light text-white leading-relaxed">{cap.description}</h3>
                  <div className="mt-4">
                    <FeatureChips items={cap.chips} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
