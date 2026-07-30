import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';

const VALUES = [
  { title: 'Property First', desc: 'Built by property professionals, not software people learning the industry.' },
  { title: 'Simple on Top', desc: 'Users experience clarity. The complexity lives beneath the surface.' },
  { title: 'Galaxy Beneath', desc: 'Enterprise-grade accounting, automation, and intelligence power every action.' },
  { title: 'Client Obsessed', desc: 'We exist to make commercial property operations effortless for our customers.' },
];

export default function CompanyPage() {
  return (
    <Section id="company" className="pt-32 md:pt-48 pb-24">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">Company</p>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Built by property people.
            <br />
            <span className="text-zinc-400">For property people.</span>
          </h1>
          <p className="mt-6 text-zinc-500 max-w-lg mx-auto text-sm leading-relaxed">
            AssetFlow was designed by professionals who have worked in administration, leasing, property management, and portfolio management. Not software people trying to understand property — property people building the software they wish had existed.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 max-w-3xl mx-auto">
          {VALUES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5 text-center hover:border-white/[0.08] transition-all duration-500">
              <h3 className="text-sm font-medium text-white">{item.title}</h3>
              <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
