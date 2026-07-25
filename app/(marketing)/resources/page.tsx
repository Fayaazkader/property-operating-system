import type { Metadata } from 'next';
import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';

export const metadata: Metadata = {
  title: 'Resources — Learn Property Operations',
  description: 'Blog, guides, and webinars on commercial property management, finance, and operations.',
};

export default function ResourcesPage() {
  return (
    
      <Section id="resources" className="pt-32 md:pt-48 pb-20">
        <Container>
          <div className="text-center mb-20">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">Resources</p>
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">Learn how AssetFlow<br /><span className="text-zinc-400">transforms property operations.</span></h1>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto">
            {[{ title: 'Blog', desc: 'Insights on commercial property management, finance, and operations.' },{ title: 'Guides', desc: 'In-depth guides on billing, recoveries, and financial close.' },{ title: 'Webinars', desc: 'Live and recorded sessions with property industry experts.' }].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 text-center"><h3 className="text-sm font-medium text-white">{item.title}</h3><p className="mt-2 text-xs text-zinc-500 leading-relaxed">{item.desc}</p><p className="mt-4 text-xs text-zinc-600">Coming soon</p></div>
            ))}
          </div>
        </Container>
      </Section>
    
  );
}
