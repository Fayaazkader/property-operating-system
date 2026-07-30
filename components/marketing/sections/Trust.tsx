import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const PILLARS = [
  { title: 'Financial Integrity', description: 'Double-entry accounting. Trial balance verified before period close. Every journal is traceable and explainable.' },
  { title: 'Enterprise Security', description: 'Row-level data isolation. Role-based access control. Encryption at rest and in transit. Multi-entity architecture.' },
  { title: 'Governance-First', description: 'Approval workflows, permission boundaries, and compliance checks built into every operational workflow.' },
];

const SUPPORTING = [
  { title: 'Built for Scale', description: 'Designed for commercial property portfolios from tens to thousands of leases within a single platform.' },
  { title: 'Complete Audit Trail', description: 'Every operational action is logged with timestamps and user attribution. Drill down from reports to source events.' },
  { title: 'Client-Centric', description: 'Tenant statements, WhatsApp communications, and self-service access. Your tenants are part of the platform.' },
];

export function Trust() {
  return (
    <Section id="trust" className="relative overflow-hidden py-24">
      <Container>
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">Trust</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Built for the
            <br />
            <span className="text-zinc-400">numbers that matter.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            When you're managing millions in leases, payments, and financial reporting, the platform needs to be as trustworthy as your team.
          </p>
        </div>

        {/* Pillars — larger */}
        <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto mb-6">
          {PILLARS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-white/[0.1] transition-all duration-500">
              <h3 className="text-base font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Supporting — smaller */}
        <div className="grid gap-3 md:grid-cols-3 max-w-3xl mx-auto">
          {SUPPORTING.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/[0.04] bg-transparent p-4 hover:border-white/[0.06] transition-all duration-500">
              <h3 className="text-sm font-medium text-zinc-300">{item.title}</h3>
              <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
