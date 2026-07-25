import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

const TIERS = [
  { leases: '1–25', price: '995', users: '2', messages: '500', desc: 'For boutique portfolios' },
  { leases: '26–100', price: '2,995', users: '4', messages: '1,000', desc: 'For growing portfolios' },
  { leases: '101–250', price: '4,995', users: '6', messages: '2,500', desc: 'For established operators', featured: true },
  { leases: '251–500', price: '8,995', users: '10', messages: '5,000', desc: 'For large portfolios' },
  { leases: '501–1,000', price: '18,995', users: '12', messages: '10,000', desc: 'For institutional portfolios' },
];

const ALL_FEATURES = [
  'Full AssetFlow Platform', 'Revenue Operations', 'Financial Platform (GL, AP, AR)',
  'Property Operations', 'Brokerage Operations', 'Cash Book & Reconciliation',
  'Portfolio Intelligence', 'Morning Brief', 'Conversation Platform',
  'Document Intelligence', 'Automation Engine', 'Notifications (Email, WhatsApp, In-App)',
  'Unlimited Properties', 'Unlimited Tenants', 'Unlimited Suppliers', 'Unlimited Brokers',
  'Secure Cloud Hosting', 'Automatic Platform Updates',
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <Section id="pricing" className="pt-32 md:pt-48 pb-20">
        <Container>
          <div className="text-center mb-20">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">Pricing</p>
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
              One platform.
              <br />
              <span className="text-zinc-400">Everything included.</span>
            </h1>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
              No feature tiers. No modules to unlock. Priced by portfolio size.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5 mb-20">
            {TIERS.map((tier) => (
              <div key={tier.leases} className={`rounded-2xl border p-6 text-center transition-all duration-500 ${tier.featured ? 'border-amber-500/30 bg-amber-500/[0.03] ring-1 ring-amber-500/20' : 'border-white/[0.05] bg-white/[0.01] hover:border-white/[0.08]'}`}>
                {tier.featured && <p className="text-[10px] font-medium text-amber-400 mb-3 uppercase tracking-wider">Most Popular</p>}
                <p className="text-xs text-zinc-500 font-light">{tier.leases} active leases</p>
                <p className="mt-3 text-4xl font-light tracking-tight text-white">R{tier.price}<span className="text-sm text-zinc-500 font-light">/mo</span></p>
                <p className="text-xs text-zinc-500 mt-2 font-light">{tier.users} users · {tier.messages} WhatsApp msgs</p>
                <p className="text-xs text-zinc-600 mt-3 font-light italic">{tier.desc}</p>
                <Link href={ROUTES.PUBLIC.CONTACT} className={`mt-5 block w-full rounded-full py-2.5 text-xs font-medium transition-all duration-300 ${tier.featured ? 'bg-white text-black hover:bg-zinc-200' : 'border border-white/[0.08] text-white hover:border-white/20'}`}>{tier.featured ? 'Book a Demo' : 'Get Started'}</Link>
              </div>
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-zinc-500 font-light">1,000+ leases? <Link href={ROUTES.PUBLIC.CONTACT} className="text-white underline underline-offset-4 hover:text-zinc-300">Contact us</Link> for enterprise pricing.</p>
            <p className="text-xs text-zinc-600 mt-2 font-light">Additional users R175/mo · Tenants, suppliers, and brokers always free</p>
          </div>

          <div className="mt-20 border-t border-white/[0.04] pt-16">
            <h2 className="text-xl font-light text-white text-center mb-10">Everything included in every plan</h2>
            <div className="grid gap-3 md:grid-cols-3 max-w-3xl mx-auto">
              {ALL_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-zinc-400 font-light">
                  <span className="text-amber-500/60 text-xs">✓</span> {feature}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </MarketingLayout>
  );
}
