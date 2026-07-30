import Link from 'next/link';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { marketing } from '@/lib/marketing.config';
import { ROUTES } from '@/lib/routes';

export function Hero() {
  return (
    <Section id="hero" className="pt-48 md:pt-56 pb-36 relative overflow-hidden">

      <Container className="text-center relative z-10">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">
          Commercial Property Operating System
        </p>

        <h1 className="text-5xl md:text-7xl lg:text-7xl xl:text-8xl font-light tracking-tight text-white max-w-3xl mx-auto leading-[1.06]">
          The Operating System
          <br />
          <span className="text-zinc-400">for Commercial Property</span>
        </h1>

        <p className="mt-8 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
          AssetFlow connects leasing, revenue, finance, operations and executive reporting into one intelligent platform, giving every team a single source of operational and financial truth.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={ROUTES.PUBLIC.CONTACT}
            className="group inline-flex items-center gap-2 rounded-full border border-amber-500/50 px-8 py-4 text-sm font-medium text-white hover:bg-amber-500 hover:text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10"
          >
            Book a Demo
            <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href={ROUTES.PUBLIC.PLATFORM}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-8 py-4 text-sm font-light text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all duration-300"
          >
            Explore Platform
          </Link>
        </div>

        <p className="mt-16 text-xs text-zinc-400 font-light">
          Built for commercial property owners, portfolio managers, finance teams, and managing agents.
        </p>
      </Container>
    </Section>
  );
}
