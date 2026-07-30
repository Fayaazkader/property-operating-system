import Link from 'next/link';
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

        <div className="mt-20 pt-16 border-t border-white/[0.04]">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-10 font-medium">Our Philosophy</p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-light flex-wrap max-w-xl mx-auto">
            <div className="rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1.5">Fragmented Software</div>
            <span className="text-zinc-700">→</span>
            <div className="rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1.5">Disconnected Workflows</div>
            <span className="text-zinc-700">→</span>
            <div className="rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1.5">AssetFlow Vision</div>
            <span className="text-zinc-700">→</span>
            <div className="rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1.5">Unified Platform</div>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/[0.04] mt-20 pt-16 pb-8 text-center">
        <Container>
          <h2 className="text-2xl md:text-3xl font-light tracking-tight text-white">Run your commercial property portfolio from one platform.</h2>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">Book a Demo</Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-6 py-3 text-sm font-light text-zinc-400 hover:text-white transition-all">See the Platform</Link>
          </div>
        </Container>
      </div>
    </Section>
  );
}
