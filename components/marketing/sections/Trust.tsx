import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const TRUST_ITEMS = [
  {
    title: 'Financial Integrity',
    description: 'Double-entry accounting. Trial balance must balance before period close. Every journal is explainable.',
  },
  {
    title: 'Complete Audit Trail',
    description: 'Every action logged with actor, timestamp, and correlation ID. Drill down from any number to its source.',
  },
  {
    title: 'Enterprise Security',
    description: 'Row-level security. Role-based access control. Encryption at rest and in transit. Multi-entity isolation.',
  },
  {
    title: 'Built for Scale',
    description: 'Commercial property portfolios from 10 to 10,000 leases. Same architecture. Same performance.',
  },
];

export function Trust() {
  return (
    <Section id="trust" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">Trust</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Built for the
            <br />
            <span className="text-zinc-400">numbers that matter.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            When you're managing millions in leases, payments, and financial reporting,
            the platform needs to be as trustworthy as your team.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 hover:border-white/[0.08] transition-all duration-500"
            >
              <h3 className="text-sm font-medium text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
