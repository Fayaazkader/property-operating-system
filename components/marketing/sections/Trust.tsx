import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const TRUST_ITEMS = [
  {
    title: 'Financial Integrity',
    description: 'Double-entry accounting. Trial balance verified before period close. Journals are traceable and explainable.',
    icon: (
      <svg className="w-5 h-5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Complete Audit Trail',
    description: 'Key operational actions are logged with timestamps and user attribution. Drill down from reports to source events.',
    icon: (
      <svg className="w-5 h-5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Enterprise Security',
    description: 'Row-level data isolation. Role-based access control. Encryption at rest and in transit. Multi-entity architecture.',
    icon: (
      <svg className="w-5 h-5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Built for Scale',
    description: 'Designed to support commercial property portfolios ranging from tens to thousands of leases within a single platform.',
    icon: (
      <svg className="w-5 h-5 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75-3.75v3.75m0 0H3m18 0v18H3V3" />
      </svg>
    ),
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

        <ul className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto" role="list">
          {TRUST_ITEMS.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 hover:border-white/[0.08] transition-all duration-500 flex gap-4"
            >
              <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
