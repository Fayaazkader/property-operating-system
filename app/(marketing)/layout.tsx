import type { Metadata } from 'next';
import { marketing } from '@/lib/marketing.config';
import { marketingAssets } from '@/lib/marketingAssets';
import { MarketingProvider } from '@/components/marketing/providers/MarketingProvider';
import { GridBackground } from '@/components/marketing/background/GridBackground';
import { AmbientLight } from '@/components/marketing/background/AmbientLight';
import { Navbar } from '@/components/marketing/navigation/Navbar';
import { MarketingShell } from '@/components/marketing/layout/MarketingShell';
import { Footer } from '@/components/marketing/sections/Footer';
import '../../app/globals.css';

export const metadata: Metadata = {
  title: {
    default: `${marketing.company.name} — ${marketing.company.tagline}`,
    template: `%s — ${marketing.company.name}`,
  },
  description: marketing.company.description,
  openGraph: {
    title: `${marketing.company.name} — ${marketing.company.tagline}`,
    description: marketing.company.description,
    images: [{ url: marketingAssets.ogImage, width: 1200, height: 630 }],
  },
};

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
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
