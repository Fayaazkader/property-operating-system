import type { Metadata } from 'next';
import { marketing } from '@/lib/marketing.config';
import { marketingAssets } from '@/lib/marketingAssets';
import { MarketingLayout } from '@/components/marketing/layout/MarketingLayout';
import { MarketingHomePage } from '@/components/marketing/pages/HomePage';

export const metadata: Metadata = {
  title: `${marketing.company.name} — ${marketing.company.tagline}`,
  description: marketing.company.description,
  openGraph: {
    title: `${marketing.company.name} — ${marketing.company.tagline}`,
    description: marketing.company.description,
    images: [{ url: marketingAssets.ogImage, width: 1200, height: 630 }],
  },
};

export default function Home() {
  return (
    <MarketingLayout>
      <MarketingHomePage />
    </MarketingLayout>
  );
}
