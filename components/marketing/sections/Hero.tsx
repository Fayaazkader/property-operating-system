import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { marketing } from '@/lib/marketing.config';

export function Hero() {
  return (
    <Section id="hero" className="pt-32 md:pt-48 pb-20">
      <Container className="text-center">
        <h1 className="text-5xl md:text-7xl font-light tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
          {marketing.company.tagline}
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          {marketing.company.description}
        </p>
        <div className="mt-10">
          <a
            href="/contact"
            className="inline-flex rounded-full bg-white px-8 py-4 text-sm font-medium text-black hover:bg-zinc-200 transition-colors duration-200"
          >
            Book a Demo
          </a>
        </div>
      </Container>
    </Section>
  );
}
