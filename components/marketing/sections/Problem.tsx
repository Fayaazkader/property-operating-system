import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white text-center">
          Your portfolio runs on five systems.
          <br />
          <span className="text-zinc-400">None of them talk to each other.</span>
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-5">
          {['Leasing', 'Billing', 'Payments', 'Maintenance', 'Reports'].map((item) => (
            <div key={item} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-zinc-400">{item}</p>
              <p className="text-xs text-zinc-600 mt-1">Disconnected</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
