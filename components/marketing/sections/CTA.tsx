import Link from 'next/link';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

export function CTA() {
  return (
    <Section id="cta" className="relative overflow-hidden py-24">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white leading-[1.12]">
            Run your entire commercial
            <br />
            <span className="text-zinc-400">property portfolio from one platform.</span>
          </h2>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-medium text-black hover:bg-gray-100 transition-all duration-300 hover:-translate-y-0.5"
            >
              Book a Demo
              <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/login"
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
