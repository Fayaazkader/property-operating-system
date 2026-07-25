import Link from 'next/link';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { ROUTES } from '@/lib/routes';

export function CTA() {
  return (
    <Section id="cta" className="relative overflow-hidden">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white leading-[1.12]">
            Ready to see it
            <br />
            <span className="text-zinc-400">in action?</span>
          </h2>
          <p className="mt-6 text-zinc-500 text-sm leading-relaxed max-w-md mx-auto">
            Book a personalised demo and see how AssetFlow connects your entire
            commercial property portfolio into one intelligent operating system.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
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
        </div>
      </Container>
    </Section>
  );
}
