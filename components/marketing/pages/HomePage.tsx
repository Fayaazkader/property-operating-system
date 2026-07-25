import { Hero } from '../sections/Hero';
import { Problem } from '../sections/Problem';
import { EverythingFlows } from '../sections/EverythingFlows';
import { Journey } from '../sections/Journey';
import { Trust } from '../sections/Trust';
import { CTA } from '../sections/CTA';

export function MarketingHomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <EverythingFlows />
      <Journey />
      <Trust />
      <CTA />
    </>
  );
}
