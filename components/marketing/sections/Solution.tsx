import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { SolutionVisual } from './SolutionVisual';

export function Solution() {
  return (
    <Section id="solution" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6 font-medium">The Solution</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Everything connects through
            <br />
            <span className="text-emerald-400">AssetFlow.</span>
          </h2>
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
            AssetFlow replaces disconnected tools with one operational platform that manages the complete commercial property lifecycle — from lease to financial truth.
          </p>
        </div>

        <SolutionVisual />

        <div className="mt-16 max-w-2xl mx-auto">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-8 font-medium">The Complete Lifecycle</p>
          <div className="flex flex-col items-center gap-1">
            {['Lease', 'Billing Rules', 'Invoices', 'Payments', 'Reconciliation', 'Portfolio Intelligence'].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-2 text-xs text-emerald-300 font-light w-48 text-center">
                  {step}
                </div>
                {i < 5 && <span className="text-emerald-600 text-lg font-light">↓</span>}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
