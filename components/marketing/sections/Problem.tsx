import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white text-center">
          Your portfolio runs on five systems.
          <br />
          <span className="text-zinc-400">None of them talk to each other.</span>
        </h2>
        <p className="mt-4 text-center text-zinc-600 text-sm">
          Full visual redesign coming — floating application windows instead of cards.
        </p>
      </Container>
    </Section>
  );
}
