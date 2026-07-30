import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';

const RESOURCES = [
  { title: 'Blog', desc: 'Insights on commercial property management, financial operations, and portfolio strategy.' },
  { title: 'Guides', desc: 'In-depth guides on billing, recoveries, financial close, and property operations.' },
  { title: 'Webinars', desc: 'Live and recorded sessions with property industry experts and AssetFlow customers.' },
  { title: 'Documentation', desc: 'Technical documentation, API references, and integration guides.' },
  { title: 'Case Studies', desc: 'How commercial portfolios use AssetFlow to connect operations and finance.' },
  { title: 'Help Centre', desc: 'Searchable knowledge base with answers to common questions.' },
];

export default function ResourcesPage() {
  return (
    <Section id="resources" className="pt-32 md:pt-48 pb-24">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">Resources</p>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Learn how AssetFlow
            <br />
            <span className="text-zinc-400">transforms property operations.</span>
          </h1>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            Guides, articles, and resources to help you get the most from your commercial property platform.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
          {RESOURCES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 hover:border-white/[0.08] transition-all duration-500">
              <h3 className="text-sm font-medium text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              <p className="mt-4 text-xs text-zinc-600">Coming soon</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
