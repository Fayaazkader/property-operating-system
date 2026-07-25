import type { Metadata } from 'next';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';

export const metadata: Metadata = {
  title: 'Company — Built by Property People',
  description: 'AssetFlow was designed by professionals in leasing, property management, and portfolio management.',
};

export default function CompanyPage() {
  return (
    <MarketingLayout>
      <Section id="company" className="pt-32 md:pt-48 pb-20">
        <Container>
          <div className="text-center mb-20">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">Company</p>
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">Built by property people.<br /><span className="text-zinc-400">For property people.</span></h1>
            <p className="mt-6 text-zinc-400 max-w-lg mx-auto text-sm leading-relaxed">AssetFlow was designed by professionals who have worked in administration, leasing, property management, and portfolio management. Not software people trying to understand property — property people building the software they wish had existed.</p>
          </div>
        </Container>
      </Section>
    </MarketingLayout>
  );
}
