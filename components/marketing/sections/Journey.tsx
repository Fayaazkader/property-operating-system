import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const CAPABILITIES = [
  {
    title: 'Revenue Operations',
    description: 'Automated billing, statements, escalations, recoveries, and arrears management. Every charge accounted for.',
    items: ['Lease billing', 'Utility recoveries', 'Automated statements', 'Arrears tracking'],
  },
  {
    title: 'Financial Platform',
    description: 'Full double-entry accounting. General ledger, trial balance, financial statements, VAT, and budgeting.',
    items: ['General Ledger', 'Trial Balance', 'Income Statement', 'Balance Sheet'],
  },
  {
    title: 'Property Operations',
    description: 'Work orders, inspections, compliance, suppliers, and purchase orders. Complete asset lifecycle.',
    items: ['Work orders', 'Inspections', 'Compliance tracking', 'Supplier management'],
  },
  {
    title: 'Portfolio Intelligence',
    description: 'Occupancy, NOI, cash flow, budget variance, and trends across your entire portfolio.',
    items: ['Morning Brief', 'Executive KPIs', 'Budget vs Actual', 'Drill-down reports'],
  },
];

export function Journey() {
  return (
    <Section id="journey" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">
            The Platform
          </p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            One operating system.
            <br />
            <span className="text-zinc-400">Every workflow connected.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            AssetFlow replaces the six disconnected systems with a single platform
            where every operational event flows into financial truth.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="group rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-500"
            >
              <h3 className="text-lg font-light text-white group-hover:text-amber-400/80 transition-colors duration-300">
                {cap.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                {cap.description}
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.04]">
                <div className="grid grid-cols-2 gap-2">
                  {cap.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="w-1 h-1 rounded-full bg-amber-500/40 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
