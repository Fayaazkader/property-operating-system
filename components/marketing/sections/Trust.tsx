import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { CheckCircleIcon, ClockIcon, ShieldIcon, BuildingIcon } from './TrustIcons';

const TRUST_ITEMS = [
  {
    title: 'Financial Integrity',
    description: 'Double-entry accounting. Trial balance verified before period close. Journals are traceable and explainable.',
    icon: CheckCircleIcon,
  },
  {
    title: 'Complete Audit Trail',
    description: 'Key operational actions are logged with timestamps and user attribution. Drill down from reports to source events.',
    icon: ClockIcon,
  },
  {
    title: 'Enterprise Security',
    description: 'Row-level data isolation. Role-based access control. Encryption at rest and in transit. Multi-entity architecture.',
    icon: ShieldIcon,
  },
  {
    title: 'Built for Scale',
    description: 'Designed to support commercial property portfolios ranging from tens to thousands of leases within a single platform.',
    icon: BuildingIcon,
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
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
            When you're managing millions in leases, payments, and financial reporting,
            the platform needs to be as trustworthy as your team.
          </p>
        </div>

        <ul className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto" role="list">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 hover:border-white/[0.08] hover:-translate-y-0.5 transition-all duration-500 flex gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-amber-500/60" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
