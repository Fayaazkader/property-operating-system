import { Container } from '@/components/marketing/layout/Container';
import { Section } from '@/components/marketing/layout/Section';
import Link from 'next/link';

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

        <div className="max-w-lg mx-auto text-center">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-10">
            <p className="text-sm font-medium text-white">Knowledge Centre</p>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              We&apos;re building a comprehensive library of guides, articles, and resources for commercial property teams.
            </p>
            <p className="mt-4 text-xs text-zinc-600">Launching soon</p>
            <div className="mt-6">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-6 py-2.5 text-xs font-light text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all duration-300">
                Get notified when we launch
              </Link>
            </div>
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
