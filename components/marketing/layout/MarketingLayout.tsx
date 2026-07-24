import { PropsWithChildren } from 'react';
import { MarketingProvider } from '../providers/MarketingProvider';
import { GridBackground } from '../background/GridBackground';
import { AmbientLight } from '../background/AmbientLight';
import { Navbar } from '../navigation/Navbar';
import { MarketingShell } from './MarketingShell';
import { Footer } from '../sections/Footer';

export function MarketingLayout({ children }: PropsWithChildren) {
  return (
    <MarketingProvider>
      <GridBackground />
      <AmbientLight />
      <Navbar />
      <MarketingShell>{children}</MarketingShell>
      <Footer />
    </MarketingProvider>
  );
}
