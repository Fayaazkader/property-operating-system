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
      </Container>
    </Section>
  );
}
